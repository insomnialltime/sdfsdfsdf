// ==============================
// Инициализация Telegram WebApp
// ==============================
const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

const INIT_DATA = tg.initData;
const TG_USER = (tg.initDataUnsafe && tg.initDataUnsafe.user) || {};

async function api(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-Telegram-Init-Data": INIT_DATA,
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`API error ${res.status}: ${errText}`);
  }
  return res.status === 204 ? null : res.json();
}

function todayStr() { return formatDate(new Date()); }

function formatDate(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ==============================
// Навигация между экранами
// ==============================
function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");

  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.screen === id);
  });

  if (id === "screen-notes") loadNotes();
  if (id === "screen-reminders") loadReminders();
  if (id === "screen-insights") loadInsights();
  if (id === "screen-more") loadMoreScreenState();
  if (id === "screen-partner") loadPartnerScreen();
  if (id === "screen-partner-view") loadPartnerView();
}

document.querySelectorAll(".nav-btn").forEach(btn => {
  btn.addEventListener("click", () => showScreen(btn.dataset.screen));
});

document.querySelectorAll("[data-nav]").forEach(el => {
  el.addEventListener("click", () => showScreen(el.dataset.nav));
});

// ==============================
// ПРИВЕТСТВИЕ И ЦИТАТА ДНЯ
// ==============================
const QUOTES = [
  "Твоё тело — не враг, а союзник. Слушай его сигналы с добротой.",
  "Отдых — это тоже продуктивность. Разреши себе притормозить сегодня.",
  "Маленькие привычки — вода, сон, движение — складываются в большое самочувствие.",
  "Ты не обязана быть идеальной каждый день цикла. Будь просто собой.",
  "Замечать свои эмоции — уже большой шаг к заботе о себе.",
  "Плохое самочувствие — это информация, а не повод себя ругать.",
  "Сегодня отличный день, чтобы сказать себе доброе слово.",
  "Забота о себе — не эгоизм, а необходимость.",
  "Твой цикл уникален, как и ты. Сравнение с другими тут неуместно.",
  "Даже маленький стакан воды — это уже забота о себе прямо сейчас.",
  "Ты справляешься лучше, чем тебе кажется.",
  "Позволь себе отдохнуть без чувства вины — тело скажет спасибо.",
  "Не всё нужно успевать сегодня. Часть дел подождёт до завтра.",
  "Твоё настроение имеет право быть любым — не только хорошим.",
  "Маленький шаг вперёд — тоже шаг. Не обесценивай его.",
  "Тело меняется каждый день цикла — это не слабость, а норма.",
  "Разреши себе один момент тишины сегодня, без телефона и задач.",
  "Ты не обязана объяснять всем, почему тебе тяжело именно сегодня.",
  "Забота о себе — это последовательность маленьких решений, а не один большой рывок.",
  "Хорошее самочувствие строится из мелочей: сна, воды, движения, тепла.",
  "Твои границы важны — даже если кому-то неудобно их слышать.",
  "Сравнение своего цикла с 'нормой' в интернете редко помогает — доверяй своим ощущениям.",
  "Можно ничего не хотеть делать сегодня. Это нормально.",
  "Отмечать симптомы — это забота, а не жалобы.",
  "Ты имеешь право на плохой день без чувства вины.",
  "Твоё тело меняется циклично — и это не повод его критиковать.",
  "Иногда лучшая продуктивность — это разрешить себе отдохнуть.",
  "Записывать мысли — хороший способ разгрузить голову.",
  "У тебя есть право на паузу в любой день цикла.",
  "Забота о себе выглядит по-разному каждый день — и это нормально.",
];

const CYCLE_FACTS = [
  "Средняя длина цикла у большинства людей — от 21 до 35 дней, и это всё считается нормой.",
  "Овуляция обычно происходит примерно за 14 дней до начала следующих месячных, а не строго в середине цикла.",
  "Цикл может немного сбиваться из-за стресса, смены часовых поясов или недосыпа — это не всегда повод для тревоги.",
  "Базальная температура тела чуть повышается после овуляции — на этом основаны некоторые методы отслеживания.",
  "ПМС может проявляться по-разному от цикла к циклу — это не значит, что что-то идёт не так.",
  "Уровень энергии часто выше в фолликулярной фазе — хорошее время для новых начинаний.",
  "Тяга к сладкому перед месячными частично связана с колебаниями серотонина.",
  "У цикла нет 'эталонной' длины — важнее твоя собственная стабильная норма.",
  "Железо теряется во время месячных — продукты, богатые железом, могут помочь самочувствию.",
  "Лёгкая физическая активность может облегчать спазмы за счёт улучшения кровообращения.",
];

function dayOfYear(d) {
  const start = new Date(d.getFullYear(), 0, 0);
  const diff = d - start;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function renderGreeting() {
  const hour = new Date().getHours();
  const name = TG_USER.first_name ? `, ${TG_USER.first_name}` : "";
  let greet = "Привет";
  if (hour < 5) greet = "Доброй ночи";
  else if (hour < 12) greet = "Доброе утро";
  else if (hour < 18) greet = "Добрый день";
  else greet = "Добрый вечер";

  document.getElementById("greeting-title").textContent = `${greet}${name} 🌷`;
  document.getElementById("today-date").textContent =
    new Date().toLocaleDateString("ru-RU", { day: "numeric", month: "long", weekday: "long" });

  const quote = QUOTES[dayOfYear(new Date()) % QUOTES.length];
  document.getElementById("daily-quote").textContent = quote;

  const factEl = document.getElementById("daily-fact");
  if (factEl) {
    factEl.textContent = CYCLE_FACTS[dayOfYear(new Date()) % CYCLE_FACTS.length];
  }
}

// ==============================
// ЭКРАН "ЦИКЛ" + прогноз/фаза на "Сегодня"
// ==============================
let cycleSettings = null;
let periodDays = new Set();
let calendarViewDate = new Date();

async function loadCycle() {
  const data = await api("/api/cycle");
  cycleSettings = data.settings;
  periodDays = new Set(data.period_days);

  document.getElementById("input-cycle-length").value = cycleSettings.cycle_length;
  document.getElementById("input-period-length").value = cycleSettings.period_length;
  document.getElementById("input-last-period").value = cycleSettings.last_period_start || "";
  document.getElementById("input-water-goal").value = cycleSettings.water_goal_ml || 2000;

  renderPhaseCard();
  renderCalendar();
  applyTheme(cycleSettings.theme || "auto", false);
}

function getCycleDayInfo() {
  if (!cycleSettings || !cycleSettings.last_period_start) return null;
  const lastStart = new Date(cycleSettings.last_period_start);
  const cycleLength = cycleSettings.cycle_length;
  const periodLength = cycleSettings.period_length;
  const today = new Date();
  const msInDay = 1000 * 60 * 60 * 24;
  const daysSinceStart = Math.floor((today - lastStart) / msInDay);
  const dayOfCycle = ((daysSinceStart % cycleLength) + cycleLength) % cycleLength + 1;
  const ovulationDay = Math.max(1, cycleLength - 14);
  const fertileStart = Math.max(1, ovulationDay - 5);
  const fertileEnd = ovulationDay + 1;

  let phase, tip;
  if (dayOfCycle <= periodLength) {
    phase = "Менструация";
    tip = "Больше отдыха, тепло на живот и лёгкая растяжка помогут облегчить спазмы. Пей достаточно воды и не забывай про железо в питании.";
  } else if (dayOfCycle < fertileStart) {
    phase = "Фолликулярная фаза";
    tip = "Энергии обычно больше — хорошее время для новых задач и активных тренировок.";
  } else if (dayOfCycle <= fertileEnd) {
    phase = dayOfCycle === ovulationDay ? "Овуляция" : "Фертильное окно";
    tip = "Самое высокое либидо и энергия у многих именно сейчас. Если планируете беременность — это ключевые дни.";
  } else {
    phase = "Лютеиновая фаза";
    tip = "Возможны ПМС-симптомы: перепады настроения, тяга к сладкому, вздутие. Это нормально — будь к себе бережнее.";
  }

  const daysUntilNext = cycleLength - dayOfCycle + 1;
  const nextDate = new Date(today);
  nextDate.setDate(today.getDate() + daysUntilNext);

  return { dayOfCycle, phase, tip, daysUntilNext, nextDate, ovulationDay, fertileStart, fertileEnd, cycleLength };
}

function renderPhaseCard() {
  const el = document.getElementById("prediction-text");
  const pill = document.getElementById("phase-pill");
  const info = getCycleDayInfo();

  if (!info) {
    pill.textContent = "Нет данных";
    el.innerHTML = "Укажи дату последних месячных в настройках ⚙️, чтобы увидеть прогноз.";
    return;
  }

  const nextDateStr = info.nextDate.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
  pill.textContent = info.phase;
  el.innerHTML = `
    <div class="phase-day">День цикла: ${info.dayOfCycle}</div>
    <div class="phase-sub">Следующие месячные ожидаются ~ ${nextDateStr} (через ${info.daysUntilNext} дн.)</div>
    <div class="phase-tip">💡 ${info.tip}</div>
  `;
}

function getPredictedDays() {
  const predicted = new Set();
  const fertile = new Set();
  const ovulation = new Set();
  if (!cycleSettings || !cycleSettings.last_period_start) return { predicted, fertile, ovulation };

  const lastStart = new Date(cycleSettings.last_period_start);
  const cycleLength = cycleSettings.cycle_length;
  const periodLength = cycleSettings.period_length;
  const ovulationOffset = Math.max(1, cycleLength - 14);

  for (let cycleNum = 0; cycleNum <= 3; cycleNum++) {
    const start = new Date(lastStart);
    start.setDate(start.getDate() + cycleLength * cycleNum);

    if (cycleNum > 0) {
      for (let d = 0; d < periodLength; d++) {
        const day = new Date(start);
        day.setDate(day.getDate() + d);
        predicted.add(formatDate(day));
      }
    }

    const ovDay = new Date(start);
    ovDay.setDate(ovDay.getDate() + ovulationOffset - 1);
    ovulation.add(formatDate(ovDay));

    for (let d = -5; d <= 1; d++) {
      const day = new Date(ovDay);
      day.setDate(day.getDate() + d);
      fertile.add(formatDate(day));
    }
  }
  return { predicted, fertile, ovulation };
}

function renderCalendar() {
  const grid = document.getElementById("calendar-grid");
  grid.innerHTML = "";

  const year = calendarViewDate.getFullYear();
  const month = calendarViewDate.getMonth();

  document.getElementById("month-label").textContent =
    calendarViewDate.toLocaleDateString("ru-RU", { month: "long", year: "numeric" });

  const dayLabels = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
  dayLabels.forEach(l => {
    const el = document.createElement("div");
    el.className = "day-label";
    el.textContent = l;
    grid.appendChild(el);
  });

  const firstDay = new Date(year, month, 1);
  let startOffset = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const { predicted, fertile, ovulation } = getPredictedDays();
  const todayString = todayStr();

  for (let i = 0; i < startOffset; i++) {
    const empty = document.createElement("div");
    empty.className = "day-cell empty";
    grid.appendChild(empty);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const dateStr = formatDate(date);

    const cell = document.createElement("div");
    cell.className = "day-cell";
    cell.textContent = day;

    if (dateStr === todayString) cell.classList.add("today");
    if (periodDays.has(dateStr)) {
      cell.classList.add("period");
    } else if (ovulation.has(dateStr)) {
      cell.classList.add("ovulation");
    } else if (fertile.has(dateStr)) {
      cell.classList.add("fertile");
    } else if (predicted.has(dateStr)) {
      cell.classList.add("predicted");
    }

    cell.addEventListener("click", async () => {
      await api("/api/cycle/toggle-day", {
        method: "POST",
        body: JSON.stringify({ date: dateStr }),
      });
      if (periodDays.has(dateStr)) periodDays.delete(dateStr);
      else periodDays.add(dateStr);
      renderCalendar();
      renderPhaseCard();
    });

    grid.appendChild(cell);
  }
}

document.getElementById("prev-month").addEventListener("click", () => {
  calendarViewDate.setMonth(calendarViewDate.getMonth() - 1);
  renderCalendar();
});
document.getElementById("next-month").addEventListener("click", () => {
  calendarViewDate.setMonth(calendarViewDate.getMonth() + 1);
  renderCalendar();
});

document.getElementById("save-settings-btn").addEventListener("click", async () => {
  const cycle_length = parseInt(document.getElementById("input-cycle-length").value, 10);
  const period_length = parseInt(document.getElementById("input-period-length").value, 10);
  const last_period_start = document.getElementById("input-last-period").value;

  if (!last_period_start) {
    tg.showAlert("Укажи дату последних месячных");
    return;
  }

  await api("/api/cycle/settings", {
    method: "POST",
    body: JSON.stringify({ cycle_length, period_length, last_period_start }),
  });

  tg.HapticFeedback.notificationOccurred("success");
  await loadCycle();
  showScreen("screen-cycle");
});

// ==============================
// ЭКРАН "СЕГОДНЯ" — настроение, симптомы, заметка, вода
// ==============================
const SYMPTOMS = [
  "Головная боль", "Спазмы", "Вздутие", "Усталость", "Тошнота",
  "Акне", "Перепады настроения", "Боль в груди", "Бессонница", "Тяга к сладкому",
];

let selectedMood = null;
let selectedSymptoms = new Set();
let currentWaterMl = 0;
let currentWaterGoal = 2000;

function renderSymptomChips() {
  const wrap = document.getElementById("symptom-chips");
  wrap.innerHTML = "";
  SYMPTOMS.forEach(s => {
    const chip = document.createElement("button");
    chip.className = "chip toggle-chip";
    chip.textContent = s;
    chip.classList.toggle("selected", selectedSymptoms.has(s));
    chip.addEventListener("click", () => {
      if (selectedSymptoms.has(s)) selectedSymptoms.delete(s);
      else selectedSymptoms.add(s);
      chip.classList.toggle("selected");
    });
    wrap.appendChild(chip);
  });
}

document.querySelectorAll(".mood-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    selectedMood = btn.dataset.mood;
    document.querySelectorAll(".mood-btn").forEach(b => b.classList.remove("selected"));
    btn.classList.add("selected");
  });
});

async function loadTodayLog() {
  const log = await api(`/api/daily/${todayStr()}`);
  selectedMood = log.mood || null;
  selectedSymptoms = new Set(log.symptoms ? log.symptoms.split(",").filter(Boolean) : []);
  document.getElementById("today-note").value = log.note || "";
  currentWaterMl = log.water_ml || 0;

  document.querySelectorAll(".mood-btn").forEach(b => b.classList.toggle("selected", b.dataset.mood === selectedMood));
  renderSymptomChips();
  renderWater();
}

function renderWater() {
  document.getElementById("water-amount").textContent = `${currentWaterMl} мл`;
  document.getElementById("water-goal-label").textContent = `из ${currentWaterGoal} мл`;
  const pct = Math.max(0, Math.min(100, (currentWaterMl / currentWaterGoal) * 100));
  document.getElementById("water-fill").style.height = `${pct}%`;
}

document.querySelectorAll(".water-btn").forEach(btn => {
  btn.addEventListener("click", async () => {
    let ml;
    if (btn.dataset.ml === "reset") {
      ml = -currentWaterMl;
    } else {
      ml = parseInt(btn.dataset.ml, 10);
    }
    const res = await api("/api/daily/water", {
      method: "POST",
      body: JSON.stringify({ date: todayStr(), ml }),
    });
    currentWaterMl = res.water_ml;
    renderWater();
    tg.HapticFeedback.impactOccurred("light");
  });
});

document.getElementById("save-today-btn").addEventListener("click", async () => {
  await api("/api/daily", {
    method: "POST",
    body: JSON.stringify({
      date: todayStr(),
      mood: selectedMood,
      symptoms: Array.from(selectedSymptoms),
      note: document.getElementById("today-note").value.trim(),
    }),
  });
  tg.HapticFeedback.notificationOccurred("success");
  tg.showAlert("Сохранено! Спасибо, что заботишься о себе 🌸");
});

// ==============================
// ДЫХАТЕЛЬНАЯ ПАУЗА (4-7-8)
// ==============================
let breathingActive = false;
let breathingTimeout = null;

function breathingStep(circle, caption, phase) {
  if (!breathingActive) return;
  circle.classList.remove("inhale", "hold", "exhale");
  if (phase === "inhale") {
    circle.classList.add("inhale");
    circle.textContent = "Вдох";
    caption.textContent = "Медленно вдыхай через нос... 4 секунды";
    breathingTimeout = setTimeout(() => breathingStep(circle, caption, "hold"), 4000);
  } else if (phase === "hold") {
    circle.classList.add("hold");
    circle.textContent = "Держи";
    caption.textContent = "Задержи дыхание... 7 секунд";
    breathingTimeout = setTimeout(() => breathingStep(circle, caption, "exhale"), 7000);
  } else {
    circle.classList.add("exhale");
    circle.textContent = "Выдох";
    caption.textContent = "Медленно выдыхай через рот... 8 секунд";
    breathingTimeout = setTimeout(() => breathingStep(circle, caption, "inhale"), 8000);
  }
}

document.getElementById("breathing-circle").addEventListener("click", () => {
  const circle = document.getElementById("breathing-circle");
  const caption = document.getElementById("breathing-caption");
  if (breathingActive) {
    breathingActive = false;
    clearTimeout(breathingTimeout);
    circle.classList.remove("inhale", "hold", "exhale");
    circle.textContent = "Начать";
    caption.textContent = "Нажми на круг, чтобы снова начать паузу.";
  } else {
    breathingActive = true;
    breathingStep(circle, caption, "inhale");
  }
});

// ==============================
// ЭКРАН "ЗАМЕТКИ"
// ==============================
const CATEGORY_LABELS = { general: "Общее", health: "Здоровье", doctor: "К врачу", ideas: "Идеи" };
let activeNoteCategory = "all";
let allNotesCache = [];

document.querySelectorAll("#note-category-tabs .chip").forEach(chip => {
  chip.addEventListener("click", () => {
    document.querySelectorAll("#note-category-tabs .chip").forEach(c => c.classList.remove("active"));
    chip.classList.add("active");
    activeNoteCategory = chip.dataset.cat;
    renderNotesList();
  });
});

async function loadNotes() {
  allNotesCache = await api("/api/notes");
  renderNotesList();
}

function renderNotesList() {
  const list = document.getElementById("notes-list");
  list.innerHTML = "";
  const notes = activeNoteCategory === "all"
    ? allNotesCache
    : allNotesCache.filter(n => (n.category || "general") === activeNoteCategory);

  if (notes.length === 0) {
    list.innerHTML = `<div class="empty-state">Заметок пока нет.<br>Нажми ➕, чтобы добавить первую.</div>`;
    return;
  }

  notes.forEach(note => {
    const item = document.createElement("div");
    item.className = "list-item";
    const catLabel = CATEGORY_LABELS[note.category] || "Общее";
    item.innerHTML = `
      <div class="list-item-content">
        <div class="list-item-title">
          ${note.pinned ? "📌 " : ""}${escapeHtml(note.title)}
          <span class="note-category-badge">${catLabel}</span>
        </div>
        <div class="list-item-sub">${escapeHtml(note.content || "")}</div>
      </div>
      <div class="item-actions">
        <button class="pin-btn ${note.pinned ? "pinned" : ""}" data-id="${note.id}">📌</button>
        <button class="delete-btn" data-id="${note.id}">✕</button>
      </div>
    `;
    list.appendChild(item);
  });

  list.querySelectorAll(".delete-btn").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      await api(`/api/notes/${btn.dataset.id}`, { method: "DELETE" });
      loadNotes();
    });
  });

  list.querySelectorAll(".pin-btn").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      await api(`/api/notes/${btn.dataset.id}/pin`, { method: "POST" });
      loadNotes();
    });
  });
}

let selectedNewNoteCategory = "general";
document.querySelectorAll("#note-category-picker .chip").forEach(chip => {
  chip.addEventListener("click", () => {
    document.querySelectorAll("#note-category-picker .chip").forEach(c => c.classList.remove("active"));
    chip.classList.add("active");
    selectedNewNoteCategory = chip.dataset.cat;
  });
});

document.getElementById("add-note-btn").addEventListener("click", () => {
  document.getElementById("input-note-title").value = "";
  document.getElementById("input-note-content").value = "";
  document.getElementById("input-note-remind-at").value = "";
  selectedNewNoteCategory = "general";
  document.querySelectorAll("#note-category-picker .chip").forEach((c, i) => c.classList.toggle("active", i === 0));
  showScreen("screen-note-edit");
});

document.getElementById("note-edit-back-btn").addEventListener("click", () => showScreen("screen-notes"));

document.getElementById("save-note-btn").addEventListener("click", async () => {
  const title = document.getElementById("input-note-title").value.trim();
  const content = document.getElementById("input-note-content").value.trim();
  const remindAtLocal = document.getElementById("input-note-remind-at").value;

  if (!title) {
    tg.showAlert("Введи заголовок заметки");
    return;
  }

  const { id: noteId } = await api("/api/notes", {
    method: "POST",
    body: JSON.stringify({ title, content, category: selectedNewNoteCategory }),
  });

  if (remindAtLocal) {
    const remindAtUtc = new Date(remindAtLocal).toISOString();
    await api("/api/reminders", {
      method: "POST",
      body: JSON.stringify({ text: title, remind_at: remindAtUtc, note_id: noteId }),
    });
  }

  tg.HapticFeedback.notificationOccurred("success");
  showScreen("screen-notes");
  loadNotes();
});

// ==============================
// ЭКРАН "НАПОМИНАНИЯ"
// ==============================
async function loadReminders() {
  const reminders = await api("/api/reminders");
  const list = document.getElementById("reminders-list");
  list.innerHTML = "";

  if (reminders.length === 0) {
    list.innerHTML = `<div class="empty-state">Напоминаний пока нет.<br>Добавь их при создании заметки.</div>`;
    return;
  }

  reminders.forEach(r => {
    const date = new Date(r.remind_at);
    const dateStr = date.toLocaleString("ru-RU", {
      day: "numeric", month: "long", hour: "2-digit", minute: "2-digit"
    });

    const item = document.createElement("div");
    item.className = "list-item";
    item.innerHTML = `
      <div class="list-item-content">
        <div class="list-item-title">${escapeHtml(r.text)}</div>
        <div class="list-item-sub">${r.is_sent ? "✅ Отправлено" : "⏰ " + dateStr}</div>
      </div>
      <button class="delete-btn" data-id="${r.id}">✕</button>
    `;
    list.appendChild(item);
  });

  list.querySelectorAll(".delete-btn").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      await api(`/api/reminders/${btn.dataset.id}`, { method: "DELETE" });
      loadReminders();
    });
  });
}

// ==============================
// ЭКРАН "СТАТИСТИКА"
// ==============================
const ACHIEVEMENTS = [
  { id: "first_step", icon: "🌱", title: "Первые шаги", check: d => d.symptoms.days_logged >= 1 || d.cycle.cycles_tracked >= 1 },
  { id: "week_diary", icon: "📓", title: "Неделя дневника", check: d => d.symptoms.days_logged >= 7 },
  { id: "steady", icon: "📈", title: "Постоянство", check: d => d.cycle.cycles_tracked >= 3 },
  { id: "weight", icon: "⚖️", title: "Следишь за весом", check: d => d.weight_logs.length >= 1 },
  { id: "month", icon: "🌙", title: "Месяц с приложением", check: d => d.symptoms.days_logged >= 30 },
];

function renderAchievements(data) {
  const wrap = document.getElementById("achievements-wrap");
  if (!wrap) return;
  wrap.innerHTML = ACHIEVEMENTS.map(a => {
    const unlocked = a.check(data);
    return `
      <div class="achievement-badge ${unlocked ? "unlocked" : ""}">
        <span class="achievement-icon">${a.icon}</span>
        <span class="achievement-title">${a.title}</span>
      </div>
    `;
  }).join("");
}

async function loadInsights() {
  const data = await api("/api/insights");

  renderAchievements(data);

  document.getElementById("stat-avg-cycle").textContent =
    data.cycle.average_cycle_length ? `${data.cycle.average_cycle_length} дн.` : "—";
  document.getElementById("stat-regularity").textContent = data.cycle.regularity || "—";
  document.getElementById("stat-cycles-tracked").textContent =
    data.cycle.cycles_tracked > 0
      ? `Учтено циклов: ${data.cycle.cycles_tracked}`
      : "Отмечай месячные в календаре, чтобы увидеть статистику по циклам.";

  const barsWrap = document.getElementById("symptom-bars");
  const emptyEl = document.getElementById("symptom-empty");
  barsWrap.innerHTML = "";
  if (!data.symptoms.top_symptoms.length) {
    emptyEl.style.display = "block";
  } else {
    emptyEl.style.display = "none";
    const max = data.symptoms.top_symptoms[0][1];
    data.symptoms.top_symptoms.forEach(([name, count]) => {
      const row = document.createElement("div");
      row.className = "bar-row";
      row.innerHTML = `
        <div class="bar-label">${escapeHtml(name)}</div>
        <div class="bar-track"><div class="bar-fill" style="width:${(count / max) * 100}%"></div></div>
        <div>${count}</div>
      `;
      barsWrap.appendChild(row);
    });
  }

  const chart = document.getElementById("weight-chart");
  const weightEmpty = document.getElementById("weight-empty");
  chart.innerHTML = "";
  if (!data.weight_logs.length) {
    weightEmpty.style.display = "block";
  } else {
    weightEmpty.style.display = "none";
    const weights = data.weight_logs.map(w => w.weight);
    const min = Math.min(...weights);
    const max = Math.max(...weights);
    const range = (max - min) || 1;
    data.weight_logs.forEach(w => {
      const pct = 15 + ((w.weight - min) / range) * 85;
      const wrap = document.createElement("div");
      wrap.className = "weight-bar-wrap";
      const dateLabel = new Date(w.date).toLocaleDateString("ru-RU", { day: "numeric", month: "numeric" });
      wrap.innerHTML = `
        <div class="weight-bar" style="height:${pct}%"></div>
        <div class="weight-bar-label">${dateLabel}</div>
      `;
      chart.appendChild(wrap);
    });
  }
}

document.getElementById("add-weight-btn").addEventListener("click", async () => {
  const val = parseFloat(document.getElementById("input-weight").value);
  if (!val || val <= 0) {
    tg.showAlert("Введи корректный вес");
    return;
  }
  await api("/api/weight", { method: "POST", body: JSON.stringify({ date: todayStr(), weight: val }) });
  document.getElementById("input-weight").value = "";
  tg.HapticFeedback.notificationOccurred("success");
  loadInsights();
});

// ==============================
// ЭКРАН "ЕЩЁ" — цель по воде, тема
// ==============================
function loadMoreScreenState() {
  if (cycleSettings) {
    document.getElementById("input-water-goal").value = cycleSettings.water_goal_ml || 2000;
    currentWaterGoal = cycleSettings.water_goal_ml || 2000;
    highlightThemeOption(cycleSettings.theme || "auto");
  }
}

document.getElementById("save-water-goal-btn").addEventListener("click", async () => {
  const goal = parseInt(document.getElementById("input-water-goal").value, 10);
  if (!goal || goal < 500) {
    tg.showAlert("Введи цель не меньше 500 мл");
    return;
  }
  await api("/api/settings/water-goal", { method: "POST", body: JSON.stringify({ water_goal_ml: goal }) });
  currentWaterGoal = goal;
  renderWater();
  tg.HapticFeedback.notificationOccurred("success");
  tg.showAlert("Цель по воде обновлена 💧");
});

function highlightThemeOption(theme) {
  document.querySelectorAll(".theme-opt").forEach(opt => {
    opt.classList.toggle("selected", opt.dataset.theme === theme);
  });
}

function applyTheme(theme, persist) {
  if (theme === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
  } else if (theme === "light") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    // auto — доверяем цветам темы Telegram (переменные --tg-theme-*)
    if (tg.colorScheme === "dark") document.documentElement.setAttribute("data-theme", "dark");
    else document.documentElement.removeAttribute("data-theme");
  }
  highlightThemeOption(theme);
  if (persist) {
    api("/api/settings/theme", { method: "POST", body: JSON.stringify({ theme }) }).catch(() => {});
  }
}

document.querySelectorAll(".theme-opt").forEach(opt => {
  opt.addEventListener("click", () => applyTheme(opt.dataset.theme, true));
});

// ==============================
// Партнёр — доступ к данным по коду
// ==============================

async function loadPartnerScreen() {
  const container = document.getElementById("partner-content");
  container.innerHTML = `<p class="hint">Загрузка...</p>`;

  let status;
  try {
    status = await api("/api/partner/status");
  } catch (err) {
    container.innerHTML = `<p class="hint">Не удалось загрузить: ${escapeHtml(err.message)}</p>`;
    return;
  }

  const asOwner = status.as_owner;
  const asPartner = status.as_partner;

  let ownerBlock;
  if (asOwner && asOwner.status === "active") {
    ownerBlock = `
      <div class="partner-status-row">
        <span class="partner-status-dot active"></span>
        <span>Доступ есть у <b>${escapeHtml(asOwner.partner_username || "пользователя")}</b></span>
      </div>
      <p class="small-hint">:Я вижу календарь цикла, статистику симптомов и заметки. Ты можешь отключить это в любой момент.</p>
      <button class="secondary-btn danger-btn" id="partner-revoke-btn">Отключить доступ</button>
    `;
  } else if (asOwner && asOwner.status === "pending") {
    ownerBlock = `
      <p class="small-hint">Для того чтобы я мог видеть твою статистику скажи мне этот код. Код действует 30 минут и одноразовый.</p>
      <div class="partner-code">${asOwner.code.split("").join(" ")}</div>
      <button class="secondary-btn" id="partner-regenerate-btn">Создать новый код</button>
    `;
  } else {
    ownerBlock = `
      <p class="small-hint">Создай код, чтобы открыть мне доступ на чтение — календарь цикла, статистику и заметки. Отключить можно в любой момент.</p>
      <button class="primary-btn" id="partner-generate-btn">Создать код доступа</button>
    `;
  }

  let partnerBlock;
  if (asPartner) {
    partnerBlock = `
      <div class="partner-status-row">
        <span class="partner-status-dot active"></span>
        <span>Тебе открыт доступ к данным <b>${escapeHtml(asPartner.owner_username || "пользователя")}</b></span>
      </div>
      <button class="primary-btn" id="partner-open-view-btn">Открыть</button>
      <button class="secondary-btn danger-btn" id="partner-leave-btn" style="margin-top:8px;">Отключиться</button>
    `;
  } else {
    partnerBlock = `
      <p class="small-hint">Поле для ввода кода</p>
      <input type="text" id="partner-code-input" placeholder="Например: 482913" maxlength="6" inputmode="numeric">
      <button class="primary-btn" id="partner-redeem-btn">Подключиться</button>
    `;
  }

  container.innerHTML = `
    <div class="card">
      <p class="card-title mt-0">🩷 Доступ к моим данным</p>
      ${ownerBlock}
    </div>
    <div class="card">
      <p class="card-title mt-0">👀 Доступ, который есть у меня</p>
      ${partnerBlock}
    </div>
  `;

  const bind = (id, handler) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("click", handler);
  };

  bind("partner-generate-btn", async () => {
    try { await api("/api/partner/generate-code", { method: "POST" }); loadPartnerScreen(); }
    catch (err) { tg.showAlert("Ошибка: " + err.message); }
  });

  bind("partner-regenerate-btn", async () => {
    try { await api("/api/partner/generate-code", { method: "POST" }); loadPartnerScreen(); }
    catch (err) { tg.showAlert("Ошибка: " + err.message); }
  });

  bind("partner-revoke-btn", () => {
    tg.showConfirm("Отключить доступ к твоим данным?", async (confirmed) => {
      if (!confirmed) return;
      try { await api("/api/partner/revoke", { method: "POST" }); loadPartnerScreen(); }
      catch (err) { tg.showAlert("Ошибка: " + err.message); }
    });
  });

  bind("partner-leave-btn", () => {
    tg.showConfirm("Отключиться от просмотра этих данных?", async (confirmed) => {
      if (!confirmed) return;
      try { await api("/api/partner/leave", { method: "POST" }); loadPartnerScreen(); }
      catch (err) { tg.showAlert("Ошибка: " + err.message); }
    });
  });

  bind("partner-open-view-btn", () => showScreen("screen-partner-view"));

  bind("partner-redeem-btn", async () => {
    const input = document.getElementById("partner-code-input");
    const code = input.value.trim();
    if (!code) return;
    try {
      await api("/api/partner/redeem", { method: "POST", body: JSON.stringify({ code }) });
      loadPartnerScreen();
    } catch (err) {
      tg.showAlert(err.message.replace(/^API error \d+: /, ""));
    }
  });
}

async function loadPartnerView() {
  const titleEl = document.getElementById("partner-view-title");
  const container = document.getElementById("partner-view-content");
  container.innerHTML = `<p class="hint">Загрузка...</p>`;

  let data;
  try {
    data = await api("/api/partner/view");
  } catch (err) {
    container.innerHTML = `<p class="hint">${escapeHtml(err.message.replace(/^API error \d+: /, ""))}</p>`;
    return;
  }

  titleEl.textContent = data.owner_username ? `Цикл: ${data.owner_username}` : "Цикл";

  const insights = data.insights || {};
  const symptoms = data.symptoms || {};
  const periodDays = (data.period_days || []).slice(-10).reverse();
  const notes = data.notes || [];

  container.innerHTML = `
    <div class="card">
      <p class="card-title mt-0">Статистика цикла</p>
      <div class="stat-grid">
        <div class="stat-box">
          <div class="stat-value">${insights.average_cycle_length ?? "—"}</div>
          <div class="stat-label">Средняя длина цикла</div>
        </div>
        <div class="stat-box">
          <div class="stat-value">${insights.regularity ?? "—"}</div>
          <div class="stat-label">Регулярность</div>
        </div>
      </div>
    </div>

    <div class="card">
      <p class="card-title mt-0">Последние дни месячных</p>
      ${periodDays.length
        ? `<div class="chip-wrap">${periodDays.map(d => `<span class="chip static">${d}</span>`).join("")}</div>`
        : `<p class="empty-state">Пока нет отметок</p>`}
    </div>

    <div class="card">
      <p class="card-title mt-0">Частые симптомы (90 дней)</p>
      ${symptoms.top_symptoms && symptoms.top_symptoms.length
        ? symptoms.top_symptoms.map(([name, count]) => `
            <div class="list-item">
              <div class="list-item-content">
                <div class="list-item-title">${escapeHtml(name)}</div>
              </div>
              <span class="note-category-badge">${count}</span>
            </div>`).join("")
        : `<p class="empty-state">Нет данных</p>`}
    </div>

    <div class="card">
      <p class="card-title mt-0">Заметки</p>
      ${notes.length
        ? notes.map(n => `
            <div class="list-item">
              <div class="list-item-content">
                <div class="list-item-title">${n.pinned ? "📌 " : ""}${escapeHtml(n.title)}</div>
                <div class="list-item-sub">${escapeHtml(n.content || "")}</div>
              </div>
            </div>`).join("")
        : `<p class="empty-state">Заметок пока нет</p>`}
    </div>
  `;
}

// ==============================
// Старт приложения
// ==============================
renderGreeting();
Promise.all([loadCycle(), loadTodayLog()]).catch(err => {
  console.error(err);
  tg.showAlert("Ошибка загрузки данных: " + err.message);
});
