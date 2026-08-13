"""
Это сервер на FastAPI. Он делает две вещи:
1. Отдаёт файлы вебаппа (index.html, style.css, app.js) — то, что видит
   пользователь, когда открывает приложение внутри Telegram.
2. Предоставляет API (/api/...) — вебапп через JavaScript обращается сюда,
   чтобы сохранить заметку, поставить напоминание, отметить день цикла,
   записать самочувствие, воду, вес и т.д.

Каждый запрос к /api/... проверяется через функцию validate_init_data —
это гарантирует, что запрос действительно пришёл от Telegram, а не от
случайного человека, который угадал адрес.
"""

from fastapi import FastAPI, Header, HTTPException, Depends
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import config
import database as db
import security

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


async def get_current_user(x_telegram_init_data: str = Header(...)):
    """
    Эта функция — 'зависимость' FastAPI (Depends). Она автоматически
    выполняется перед каждым запросом, где указана, достаёт заголовок
    X-Telegram-Init-Data, проверяет его подлинность и возвращает
    telegram_id пользователя, который сделал запрос.
    """
    user = security.validate_init_data(x_telegram_init_data, config.BOT_TOKEN)
    if not user:
        raise HTTPException(status_code=401, detail="Не удалось проверить пользователя Telegram")

    user_id = user["id"]
    username = user.get("username") or user.get("first_name")
    await db.upsert_user(user_id, username)
    return user_id


# ---------- Схемы входящих данных ----------

class CycleSettingsIn(BaseModel):
    cycle_length: int
    period_length: int
    last_period_start: str  # формат "2026-08-01"


class ToggleDayIn(BaseModel):
    date: str


class NoteIn(BaseModel):
    title: str
    content: str = ""
    category: str = "general"


class ReminderIn(BaseModel):
    text: str
    remind_at: str  # формат ISO, например "2026-08-10T09:00:00"
    note_id: int | None = None


class DailyLogIn(BaseModel):
    date: str
    mood: str | None = None
    symptoms: list[str] | None = None
    flow: str | None = None
    note: str | None = None


class WaterIn(BaseModel):
    date: str
    ml: int


class WeightIn(BaseModel):
    date: str
    weight: float


class WaterGoalIn(BaseModel):
    water_goal_ml: int


class ThemeIn(BaseModel):
    theme: str


class PartnerRedeemIn(BaseModel):
    code: str


# ---------- Цикл ----------

@app.get("/api/cycle")
async def api_get_cycle(user_id: int = Depends(get_current_user)):
    user = await db.get_user(user_id)
    days = await db.get_period_days(user_id)
    return {"settings": user, "period_days": days}


@app.post("/api/cycle/settings")
async def api_update_cycle_settings(data: CycleSettingsIn, user_id: int = Depends(get_current_user)):
    await db.update_cycle_settings(
        user_id, data.cycle_length, data.period_length, data.last_period_start
    )
    return {"ok": True}


@app.post("/api/cycle/toggle-day")
async def api_toggle_day(data: ToggleDayIn, user_id: int = Depends(get_current_user)):
    await db.toggle_period_day(user_id, data.date)
    return {"ok": True}


@app.get("/api/insights")
async def api_get_insights(user_id: int = Depends(get_current_user)):
    cycle_insights = await db.get_cycle_insights(user_id)
    symptom_stats = await db.get_symptom_stats(user_id)
    weight_logs = await db.get_weight_logs(user_id, limit=10)
    return {
        "cycle": cycle_insights,
        "symptoms": symptom_stats,
        "weight_logs": weight_logs,
    }


# ---------- Ежедневный дневник ----------

@app.get("/api/daily/{date_str}")
async def api_get_daily(date_str: str, user_id: int = Depends(get_current_user)):
    log = await db.get_daily_log(user_id, date_str)
    return log or {"date": date_str, "mood": None, "symptoms": None, "flow": None, "note": None, "water_ml": 0}


@app.post("/api/daily")
async def api_post_daily(data: DailyLogIn, user_id: int = Depends(get_current_user)):
    symptoms_str = ",".join(data.symptoms) if data.symptoms is not None else None
    await db.upsert_daily_log(
        user_id, data.date, mood=data.mood, symptoms=symptoms_str, flow=data.flow, note=data.note
    )
    return {"ok": True}


@app.post("/api/daily/water")
async def api_add_water(data: WaterIn, user_id: int = Depends(get_current_user)):
    new_total = await db.add_water(user_id, data.date, data.ml)
    return {"water_ml": new_total}


@app.post("/api/settings/water-goal")
async def api_set_water_goal(data: WaterGoalIn, user_id: int = Depends(get_current_user)):
    await db.update_water_goal(user_id, data.water_goal_ml)
    return {"ok": True}


@app.post("/api/settings/theme")
async def api_set_theme(data: ThemeIn, user_id: int = Depends(get_current_user)):
    await db.update_theme(user_id, data.theme)
    return {"ok": True}


# ---------- Вес ----------

@app.get("/api/weight")
async def api_get_weight(user_id: int = Depends(get_current_user)):
    return await db.get_weight_logs(user_id)


@app.post("/api/weight")
async def api_post_weight(data: WeightIn, user_id: int = Depends(get_current_user)):
    await db.add_weight_log(user_id, data.date, data.weight)
    return {"ok": True}


# ---------- Заметки ----------

@app.get("/api/notes")
async def api_get_notes(user_id: int = Depends(get_current_user)):
    return await db.get_notes(user_id)


@app.post("/api/notes")
async def api_create_note(data: NoteIn, user_id: int = Depends(get_current_user)):
    note_id = await db.create_note(user_id, data.title, data.content, data.category)
    return {"id": note_id}


@app.post("/api/notes/{note_id}/pin")
async def api_pin_note(note_id: int, user_id: int = Depends(get_current_user)):
    result = await db.toggle_note_pin(user_id, note_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Заметка не найдена")
    return {"pinned": bool(result)}


@app.delete("/api/notes/{note_id}")
async def api_delete_note(note_id: int, user_id: int = Depends(get_current_user)):
    await db.delete_note(user_id, note_id)
    return {"ok": True}


# ---------- Напоминания ----------

@app.get("/api/reminders")
async def api_get_reminders(user_id: int = Depends(get_current_user)):
    return await db.get_reminders(user_id)


@app.post("/api/reminders")
async def api_create_reminder(data: ReminderIn, user_id: int = Depends(get_current_user)):
    reminder_id = await db.create_reminder(user_id, data.text, data.remind_at, data.note_id)
    return {"id": reminder_id}


@app.delete("/api/reminders/{reminder_id}")
async def api_delete_reminder(reminder_id: int, user_id: int = Depends(get_current_user)):
    await db.delete_reminder(user_id, reminder_id)
    return {"ok": True}


# ---------- Партнёрский доступ ----------
# Владелица сама создаёт код в своём интерфейсе и сама решает, кому его дать.
# Партнёр получает только чтение (цикл, статистика, заметки) и только пока
# доступ не отключён — владелицей или им самим.

@app.post("/api/partner/generate-code")
async def api_partner_generate_code(user_id: int = Depends(get_current_user)):
    return await db.create_partner_invite(user_id)


@app.get("/api/partner/status")
async def api_partner_status(user_id: int = Depends(get_current_user)):
    return {
        "as_owner": await db.get_owner_link_status(user_id),
        "as_partner": await db.get_partner_link_for_partner(user_id),
    }


@app.post("/api/partner/redeem")
async def api_partner_redeem(data: PartnerRedeemIn, user_id: int = Depends(get_current_user)):
    result = await db.redeem_partner_code(user_id, data.code.strip())
    if "error" in result:
        messages = {
            "not_found": "Код не найден или уже использован",
            "self": "Нельзя ввести собственный код",
            "expired": "Срок действия кода истёк, попроси новый",
        }
        raise HTTPException(status_code=400, detail=messages.get(result["error"], "Неверный код"))
    return {"ok": True, "owner_id": result["owner_id"]}


@app.post("/api/partner/revoke")
async def api_partner_revoke(user_id: int = Depends(get_current_user)):
    """Владелица отключает доступ к своим данным."""
    await db.revoke_partner_link(user_id)
    return {"ok": True}


@app.post("/api/partner/leave")
async def api_partner_leave(user_id: int = Depends(get_current_user)):
    """Партнёр сам отключается от просмотра чужих данных."""
    await db.leave_partner_link(user_id)
    return {"ok": True}


@app.get("/api/partner/view")
async def api_partner_view(user_id: int = Depends(get_current_user)):
    link = await db.get_partner_link_for_partner(user_id)
    if not link:
        raise HTTPException(status_code=403, detail="Нет активного доступа к чьим-либо данным")
    owner_id = link["owner_id"]
    owner = await db.get_user(owner_id)
    return {
        "owner_username": owner.get("username") if owner else None,
        "settings": owner,
        "period_days": await db.get_period_days(owner_id),
        "insights": await db.get_cycle_insights(owner_id),
        "symptoms": await db.get_symptom_stats(owner_id),
        "notes": await db.get_notes(owner_id),
    }


# Отдаём файлы вебаппа. Должно быть подключено ПОСЛЕДНИМ,
# иначе перекроет собой все /api/ маршруты выше.
app.mount("/", StaticFiles(directory="webapp", html=True), name="webapp")
