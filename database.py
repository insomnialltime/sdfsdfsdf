"""
Всё общение с базой данных SQLite происходит через этот файл.
Мы используем библиотеку aiosqlite — это асинхронная версия sqlite3,
она нужна потому что и бот, и сервер работают асинхронно (async/await),
и обычная sqlite3 их бы "тормозила".

База данных — это просто один файл flo.db, который создастся
рядом с проектом при первом запуске. Ничего дополнительно
устанавливать не нужно (в отличие от PostgreSQL/MongoDB).

В этой версии добавлены новые таблицы:
- daily_logs   — ежедневный дневник самочувствия (настроение, симптомы,
                  интенсивность выделений, вода, заметка дня)
- weight_logs  — трекер веса
- notes получили новые колонки: category (категория) и pinned (закреплена)
- users получили новые колонки: water_goal_ml (цель по воде) и theme (тема)
"""

import aiosqlite
from datetime import datetime, date, timedelta
from collections import Counter

DB_PATH = "flo.db"


async def _column_exists(db, table: str, column: str) -> bool:
    cursor = await db.execute(f"PRAGMA table_info({table})")
    cols = await cursor.fetchall()
    return any(c[1] == column for c in cols)


async def init_db():
    """Создаёт таблицы, если их ещё нет, и докатывает миграции для старых баз."""
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS users (
                user_id INTEGER PRIMARY KEY,
                username TEXT,
                cycle_length INTEGER DEFAULT 28,
                period_length INTEGER DEFAULT 5,
                last_period_start TEXT,
                created_at TEXT
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS cycle_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                date TEXT NOT NULL,
                is_period INTEGER DEFAULT 1,
                symptoms TEXT,
                UNIQUE(user_id, date)
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS notes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                content TEXT,
                created_at TEXT
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS reminders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                note_id INTEGER,
                text TEXT NOT NULL,
                remind_at TEXT NOT NULL,
                is_sent INTEGER DEFAULT 0
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS daily_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                date TEXT NOT NULL,
                mood TEXT,
                symptoms TEXT,
                flow TEXT,
                note TEXT,
                water_ml INTEGER DEFAULT 0,
                UNIQUE(user_id, date)
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS weight_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                date TEXT NOT NULL,
                weight REAL NOT NULL,
                UNIQUE(user_id, date)
            )
        """)

        # ---- Миграции для тех, у кого база уже существовала раньше ----
        if not await _column_exists(db, "notes", "category"):
            await db.execute("ALTER TABLE notes ADD COLUMN category TEXT DEFAULT 'general'")
        if not await _column_exists(db, "notes", "pinned"):
            await db.execute("ALTER TABLE notes ADD COLUMN pinned INTEGER DEFAULT 0")
        if not await _column_exists(db, "users", "water_goal_ml"):
            await db.execute("ALTER TABLE users ADD COLUMN water_goal_ml INTEGER DEFAULT 2000")
        if not await _column_exists(db, "users", "theme"):
            await db.execute("ALTER TABLE users ADD COLUMN theme TEXT DEFAULT 'auto'")

        await db.commit()


# ---------- Пользователи ----------

async def upsert_user(user_id: int, username: str | None):
    """Создаёт пользователя, если его ещё нет в базе (upsert = update or insert)."""
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            INSERT INTO users (user_id, username, created_at)
            VALUES (?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET username=excluded.username
        """, (user_id, username, datetime.utcnow().isoformat()))
        await db.commit()


async def get_user(user_id: int):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("SELECT * FROM users WHERE user_id = ?", (user_id,))
        row = await cursor.fetchone()
        return dict(row) if row else None


async def update_cycle_settings(user_id: int, cycle_length: int, period_length: int, last_period_start: str):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            UPDATE users
            SET cycle_length = ?, period_length = ?, last_period_start = ?
            WHERE user_id = ?
        """, (cycle_length, period_length, last_period_start, user_id))
        await db.commit()


async def update_water_goal(user_id: int, water_goal_ml: int):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "UPDATE users SET water_goal_ml = ? WHERE user_id = ?", (water_goal_ml, user_id)
        )
        await db.commit()


async def update_theme(user_id: int, theme: str):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("UPDATE users SET theme = ? WHERE user_id = ?", (theme, user_id))
        await db.commit()


# ---------- Дни цикла ----------

async def toggle_period_day(user_id: int, date_str: str):
    """Если день уже отмечен как 'месячные' — убираем отметку, если нет — ставим."""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            "SELECT id FROM cycle_logs WHERE user_id = ? AND date = ?", (user_id, date_str)
        )
        existing = await cursor.fetchone()
        if existing:
            await db.execute("DELETE FROM cycle_logs WHERE id = ?", (existing["id"],))
        else:
            await db.execute(
                "INSERT INTO cycle_logs (user_id, date, is_period) VALUES (?, ?, 1)",
                (user_id, date_str),
            )
        await db.commit()


async def get_period_days(user_id: int):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            "SELECT date FROM cycle_logs WHERE user_id = ? ORDER BY date", (user_id,)
        )
        rows = await cursor.fetchall()
        return [row["date"] for row in rows]


async def get_cycle_insights(user_id: int):
    """
    Считает реальную статистику по прошлым циклам на основе отмеченных
    дней месячных: находит начало каждого цикла (первый день блока
    подряд идущих дней) и меряет расстояние между стартами.
    """
    days = await get_period_days(user_id)
    if not days:
        return {"average_cycle_length": None, "cycles_tracked": 0, "regularity": None}

    parsed = sorted(date.fromisoformat(d) for d in days)
    starts = []
    prev = None
    for d in parsed:
        if prev is None or (d - prev).days > 1:
            starts.append(d)
        prev = d

    if len(starts) < 2:
        return {"average_cycle_length": None, "cycles_tracked": len(starts), "regularity": None}

    diffs = [(starts[i + 1] - starts[i]).days for i in range(len(starts) - 1)]
    avg = sum(diffs) / len(diffs)
    variance = sum((x - avg) ** 2 for x in diffs) / len(diffs)
    spread = variance ** 0.5

    if spread <= 1.5:
        regularity = "стабильный"
    elif spread <= 3.5:
        regularity = "почти стабильный"
    else:
        regularity = "нерегулярный"

    return {
        "average_cycle_length": round(avg, 1),
        "cycles_tracked": len(diffs),
        "regularity": regularity,
        "last_cycle_lengths": diffs[-6:],
    }


# ---------- Ежедневный дневник самочувствия ----------

async def upsert_daily_log(user_id: int, date_str: str, mood: str | None = None,
                            symptoms: str | None = None, flow: str | None = None,
                            note: str | None = None):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            "SELECT * FROM daily_logs WHERE user_id = ? AND date = ?", (user_id, date_str)
        )
        existing = await cursor.fetchone()
        if existing:
            await db.execute("""
                UPDATE daily_logs
                SET mood = COALESCE(?, mood),
                    symptoms = COALESCE(?, symptoms),
                    flow = COALESCE(?, flow),
                    note = COALESCE(?, note)
                WHERE id = ?
            """, (mood, symptoms, flow, note, existing["id"]))
        else:
            await db.execute("""
                INSERT INTO daily_logs (user_id, date, mood, symptoms, flow, note, water_ml)
                VALUES (?, ?, ?, ?, ?, ?, 0)
            """, (user_id, date_str, mood, symptoms, flow, note))
        await db.commit()


async def add_water(user_id: int, date_str: str, ml: int):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            "SELECT id, water_ml FROM daily_logs WHERE user_id = ? AND date = ?",
            (user_id, date_str),
        )
        existing = await cursor.fetchone()
        if existing:
            new_amount = max(0, existing["water_ml"] + ml)
            await db.execute(
                "UPDATE daily_logs SET water_ml = ? WHERE id = ?", (new_amount, existing["id"])
            )
        else:
            new_amount = max(0, ml)
            await db.execute("""
                INSERT INTO daily_logs (user_id, date, water_ml) VALUES (?, ?, ?)
            """, (user_id, date_str, new_amount))
        await db.commit()
        return new_amount


async def get_daily_log(user_id: int, date_str: str):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            "SELECT * FROM daily_logs WHERE user_id = ? AND date = ?", (user_id, date_str)
        )
        row = await cursor.fetchone()
        return dict(row) if row else None


async def get_daily_logs_range(user_id: int, start_str: str, end_str: str):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("""
            SELECT * FROM daily_logs
            WHERE user_id = ? AND date BETWEEN ? AND ?
            ORDER BY date
        """, (user_id, start_str, end_str))
        rows = await cursor.fetchall()
        return [dict(row) for row in rows]


async def get_symptom_stats(user_id: int, days_back: int = 90):
    start_str = (date.today() - timedelta(days=days_back)).isoformat()
    end_str = date.today().isoformat()
    logs = await get_daily_logs_range(user_id, start_str, end_str)

    symptom_counter = Counter()
    mood_counter = Counter()
    for log in logs:
        if log.get("symptoms"):
            for s in log["symptoms"].split(","):
                s = s.strip()
                if s:
                    symptom_counter[s] += 1
        if log.get("mood"):
            mood_counter[log["mood"]] += 1

    return {
        "top_symptoms": symptom_counter.most_common(5),
        "top_moods": mood_counter.most_common(3),
        "days_logged": len(logs),
    }


# ---------- Вес ----------

async def add_weight_log(user_id: int, date_str: str, weight: float):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            INSERT INTO weight_logs (user_id, date, weight)
            VALUES (?, ?, ?)
            ON CONFLICT(user_id, date) DO UPDATE SET weight=excluded.weight
        """, (user_id, date_str, weight))
        await db.commit()


async def get_weight_logs(user_id: int, limit: int = 30):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("""
            SELECT * FROM weight_logs WHERE user_id = ?
            ORDER BY date DESC LIMIT ?
        """, (user_id, limit))
        rows = await cursor.fetchall()
        return list(reversed([dict(row) for row in rows]))


# ---------- Заметки ----------

async def create_note(user_id: int, title: str, content: str, category: str = "general"):
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute("""
            INSERT INTO notes (user_id, title, content, created_at, category, pinned)
            VALUES (?, ?, ?, ?, ?, 0)
        """, (user_id, title, content, datetime.utcnow().isoformat(), category))
        await db.commit()
        return cursor.lastrowid


async def get_notes(user_id: int):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            "SELECT * FROM notes WHERE user_id = ? ORDER BY pinned DESC, created_at DESC",
            (user_id,),
        )
        rows = await cursor.fetchall()
        return [dict(row) for row in rows]


async def toggle_note_pin(user_id: int, note_id: int):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            "SELECT pinned FROM notes WHERE id = ? AND user_id = ?", (note_id, user_id)
        )
        row = await cursor.fetchone()
        if row is None:
            return None
        new_val = 0 if row["pinned"] else 1
        await db.execute("UPDATE notes SET pinned = ? WHERE id = ?", (new_val, note_id))
        await db.commit()
        return new_val


async def delete_note(user_id: int, note_id: int):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "DELETE FROM notes WHERE id = ? AND user_id = ?", (note_id, user_id)
        )
        await db.commit()


# ---------- Напоминания ----------

async def create_reminder(user_id: int, text: str, remind_at: str, note_id: int | None = None):
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute("""
            INSERT INTO reminders (user_id, note_id, text, remind_at, is_sent)
            VALUES (?, ?, ?, ?, 0)
        """, (user_id, note_id, text, remind_at))
        await db.commit()
        return cursor.lastrowid


async def get_reminders(user_id: int):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            "SELECT * FROM reminders WHERE user_id = ? ORDER BY remind_at", (user_id,)
        )
        rows = await cursor.fetchall()
        return [dict(row) for row in rows]


async def delete_reminder(user_id: int, reminder_id: int):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "DELETE FROM reminders WHERE id = ? AND user_id = ?", (reminder_id, user_id)
        )
        await db.commit()


async def get_due_reminders(now_iso: str):
    """Используется планировщиком: находит все неотправленные напоминания, время которых уже наступило."""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("""
            SELECT * FROM reminders WHERE is_sent = 0 AND remind_at <= ?
        """, (now_iso,))
        rows = await cursor.fetchall()
        return [dict(row) for row in rows]


async def mark_reminder_sent(reminder_id: int):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("UPDATE reminders SET is_sent = 1 WHERE id = ?", (reminder_id,))
        await db.commit()
