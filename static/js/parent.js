const STATE_KEY = 'spectrum_parent_state';

const screens = {};
document.querySelectorAll('.pr-screen').forEach((el) => {
  screens[el.dataset.screen] = el;
});

const titleEl = document.getElementById('screen-title');
const backBtn = document.getElementById('back-btn');

let owlTips = [];
let mindfulness = [];
let state = loadState();
let dailyTip = null;
let activePractice = null;

const navStack = ['hub'];

function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem(STATE_KEY) || 'null');
    if (s && typeof s === 'object') return Object.assign(defaultState(), s);
  } catch (_) {}
  return defaultState();
}

function defaultState() {
  return {
    daily_tip_id: null,
    daily_tip_date: null,
    days_applied: 0,
    last_applied_date: null,
    streak: 0,
    practice_history: [], // {practice_id, ts}
  };
}

function saveState() {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  } catch (_) {}
}

function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

function show(name, title) {
  Object.values(screens).forEach((el) => (el.hidden = true));
  if (screens[name]) screens[name].hidden = false;
  if (title) titleEl.textContent = title;
}

function pushScreen(name, title) {
  navStack.push(name);
  show(name, title);
}

function popScreen() {
  if (navStack.length > 1) navStack.pop();
  const prev = navStack[navStack.length - 1];
  const titles = {
    hub: 'Родителю',
    tip: 'Совет дня',
    mindfulness: 'Практики',
    practice: 'Практика',
    progress: 'Прогресс',
  };
  show(prev, titles[prev] || 'Родителю');
}

backBtn.addEventListener('click', () => {
  if (navStack.length <= 1) {
    location.href = '/';
  } else {
    popScreen();
  }
});

async function loadData() {
  const res = await fetch('/static/data/parent_tips.json');
  const data = await res.json();
  owlTips = data.owl_tips || [];
  mindfulness = data.mindfulness || [];
}

function pickDailyTip() {
  const today = todayStr();
  if (state.daily_tip_date === today && state.daily_tip_id) {
    const found = owlTips.find((t) => t.id === state.daily_tip_id);
    if (found) return found;
  }
  // Pick deterministically by day, so the same date always gives the same tip
  // and rotates as days progress.
  const seed = Math.abs(
    [...today].reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) | 0, 0)
  );
  const tip = owlTips[seed % owlTips.length];
  state.daily_tip_id = tip.id;
  state.daily_tip_date = today;
  saveState();
  return tip;
}

// ─── Hub ────────────────────────────────────────────
function renderHub() {
  const hour = new Date().getHours();
  let greeting;
  if (hour < 5) greeting = 'Спокойной ночи 🌙';
  else if (hour < 12) greeting = 'Доброе утро';
  else if (hour < 18) greeting = 'Добрый день';
  else greeting = 'Добрый вечер';
  document.getElementById('greeting').textContent = greeting;

  dailyTip = pickDailyTip();
  if (dailyTip) {
    document.getElementById('tip-preview').textContent = dailyTip.title;
  }

  const streakEl = document.getElementById('streak-pill');
  if (state.streak > 0) {
    streakEl.hidden = false;
    streakEl.innerHTML = '🌱 Серия применений: ' + state.streak +
      (state.streak === 1 ? ' день' : (state.streak < 5 ? ' дня' : ' дней'));
  } else {
    streakEl.hidden = true;
  }
}

document.querySelectorAll('.pr-mode').forEach((btn) => {
  btn.addEventListener('click', () => {
    const action = btn.dataset.action;
    if (action === 'open-tip') {
      openTip();
    } else if (action === 'open-mindfulness') {
      renderMindfulnessList();
      pushScreen('mindfulness', 'Практики');
      window.SP.event('parent_mindfulness_open', {});
    } else if (action === 'open-progress') {
      renderProgress();
      pushScreen('progress', 'Прогресс');
      window.SP.event('parent_progress_open', {});
    }
  });
});

// ─── Tip ────────────────────────────────────────────
function openTip(forceNew) {
  if (forceNew) {
    const idx = owlTips.findIndex((t) => t.id === dailyTip.id);
    dailyTip = owlTips[(idx + 1) % owlTips.length];
    state.daily_tip_id = dailyTip.id;
    state.daily_tip_date = todayStr();
    saveState();
  }
  document.getElementById('tip-track').textContent = dailyTip.track;
  document.getElementById('tip-title').textContent = dailyTip.title;
  document.getElementById('tip-body').textContent = dailyTip.body;
  pushScreen('tip', 'Совет дня');
  window.SP.event('parent_tip_open', { id: dailyTip.id, track: dailyTip.track });
}

document.getElementById('tip-next-btn').addEventListener('click', () => openTip(true));

document.getElementById('tip-done-btn').addEventListener('click', () => {
  const today = todayStr();
  if (state.last_applied_date !== today) {
    // Check streak: if last_applied was yesterday → +1, else reset to 1
    if (state.last_applied_date) {
      const last = new Date(state.last_applied_date);
      const diff = Math.round((Date.now() - last.getTime()) / 86400000);
      state.streak = diff === 1 ? state.streak + 1 : 1;
    } else {
      state.streak = 1;
    }
    state.last_applied_date = today;
    state.days_applied = (state.days_applied || 0) + 1;
    saveState();
  }
  window.SP.event('parent_tip_done', { id: dailyTip.id, streak: state.streak });
  popScreen();
  renderHub();
});

// ─── Mindfulness ────────────────────────────────────
function renderMindfulnessList() {
  const list = document.getElementById('mindfulness-list');
  list.innerHTML = '';
  mindfulness.forEach((m) => {
    const card = document.createElement('button');
    card.className = 'pr-mindfulness-card';
    card.innerHTML =
      '<div class="pr-mindfulness-card-body">' +
        '<div class="pr-mindfulness-card-title">' + m.title + '</div>' +
        '<div class="pr-mindfulness-card-duration">' + m.duration_min + ' мин</div>' +
      '</div>' +
      '<span class="pr-mindfulness-card-arrow">→</span>';
    card.addEventListener('click', () => openPractice(m));
    list.appendChild(card);
  });
}

function openPractice(m) {
  activePractice = m;
  document.getElementById('practice-title').textContent = m.title;
  document.getElementById('practice-meta').textContent = m.duration_min + ' мин · читайте медленно';
  const steps = document.getElementById('practice-steps');
  steps.innerHTML = '';
  m.instructions.forEach((line) => {
    const li = document.createElement('li');
    li.textContent = line;
    steps.appendChild(li);
  });
  pushScreen('practice', 'Практика');
  window.SP.event('parent_practice_open', { id: m.id, duration_min: m.duration_min });
}

document.getElementById('practice-back-btn').addEventListener('click', () => {
  popScreen();
});

document.getElementById('practice-done-btn').addEventListener('click', () => {
  state.practice_history.unshift({ id: activePractice.id, ts: new Date().toISOString() });
  if (state.practice_history.length > 100) state.practice_history.length = 100;
  saveState();
  window.SP.event('parent_practice_done', {
    id: activePractice.id,
    duration_min: activePractice.duration_min,
  });
  popScreen();
  popScreen();
  renderHub();
});

// ─── Progress dashboard ─────────────────────────────
function renderProgress() {
  const cards = document.getElementById('progress-cards');
  cards.innerHTML = '';

  // Sensory profile
  let sp = null;
  try { sp = JSON.parse(localStorage.getItem('spectrum_sensory_profile') || 'null'); } catch (_) {}
  const profileLabels = {
    seeking: 'Ищет стимуляцию 🎢',
    hyper: 'Чувствителен 🌙',
    hypo: 'Слабая реакция 🌫️',
    mixed: 'Смешанный 🌗',
  };
  cards.appendChild(card({
    icon: '✨',
    label: 'Сенсорный профиль',
    value: sp ? (profileLabels[sp.dominant] || '—') : '—',
    sub: sp
      ? 'Установлен. Эти настройки помогают подстроить интерфейс.'
      : 'Профиль ещё не определён. Пройдите Знакомство.',
  }));

  // Emotions
  let emo = null;
  try { emo = JSON.parse(localStorage.getItem('spectrum_emotions_progress') || 'null'); } catch (_) {}
  const completed = emo?.completed?.length || 0;
  cards.appendChild(card({
    icon: '😊',
    label: 'Эмоции',
    value: completed + ' / 8',
    sub: completed === 0
      ? 'Ещё не играли. Начните с первого уровня.'
      : completed === 8
        ? 'Все уровни пройдены — отличная база для распознавания эмоций.'
        : 'Уровней пройдено. Следующий уровень открыт.',
  }));

  // Mood entries
  let moodHist = [];
  try { moodHist = JSON.parse(localStorage.getItem('spectrum_mood_history') || '[]'); } catch (_) {}
  const last7 = moodHist.filter((e) => Date.now() - Date.parse(e.ts) < 7 * 86400 * 1000);
  cards.appendChild(card({
    icon: '🎚️',
    label: 'Настроение (7 дней)',
    value: last7.length + ' ' + pluralize(last7.length, 'запись', 'записи', 'записей'),
    sub: last7.length === 0
      ? 'Подросток ещё не вёл записи настроения.'
      : 'Регулярные записи помогают увидеть триггеры и паттерны.',
  }));

  // AAC voice recordings
  countVoiceRecordings().then((n) => {
    const aacCard = card({
      icon: '💬',
      label: 'Голос',
      value: n + ' ' + pluralize(n, 'запись', 'записи', 'записей'),
      sub: n === 0
        ? 'Ваш голос ещё не записан ни для одной карточки. Запись делает AAC теплее.'
        : 'Карточек с вашим голосом. Включается автоматически вместо синтезатора.',
    });
    cards.appendChild(aacCard);
  });

  // Day routine history
  let dayHist = [];
  try { dayHist = JSON.parse(localStorage.getItem('spectrum_day_history') || '[]'); } catch (_) {}
  const last7Day = dayHist.filter((e) => Date.now() - Date.parse(e.ts) < 7 * 86400 * 1000);
  cards.appendChild(card({
    icon: '📅',
    label: 'Распорядки (7 дней)',
    value: last7Day.length + ' ' + pluralize(last7Day.length, 'раз', 'раза', 'раз'),
    sub: last7Day.length === 0
      ? 'Распорядки ещё не использовались на этой неделе.'
      : 'Раз ребёнок прошёл распорядок. Регулярность снижает тревожность переходов.',
  }));

  // Parent self-care
  cards.appendChild(card({
    icon: '🌬️',
    label: 'Ваша забота о себе',
    value: state.practice_history.length + ' ' + pluralize(state.practice_history.length, 'практика', 'практики', 'практик'),
    sub: state.practice_history.length === 0
      ? 'Mindfulness работает на родителя сильнее, чем на ребёнка. Начните с 3-минутки.'
      : 'Регулярная практика — лучшая инвестиция в качество жизни всей семьи.',
  }));
}

function card({ icon, label, value, sub }) {
  const el = document.createElement('div');
  el.className = 'pr-progress-card';
  el.innerHTML =
    '<div class="pr-progress-head">' +
      '<span class="pr-progress-icon">' + icon + '</span>' +
      '<span class="pr-progress-label">' + label + '</span>' +
      '<span class="pr-progress-value">' + value + '</span>' +
    '</div>' +
    '<div class="pr-progress-sub">' + sub + '</div>';
  return el;
}

function pluralize(n, one, two, many) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return two;
  return many;
}

async function countVoiceRecordings() {
  if (!window.indexedDB) return 0;
  return new Promise((resolve) => {
    const req = indexedDB.open('spectrum_voice', 1);
    req.onsuccess = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('recordings')) {
        resolve(0); return;
      }
      const tx = db.transaction('recordings', 'readonly');
      const r = tx.objectStore('recordings').getAllKeys();
      r.onsuccess = () => resolve((r.result || []).length);
      r.onerror = () => resolve(0);
    };
    req.onerror = () => resolve(0);
  });
}

// ─── Init ────────────────────────────────────────────
(async function init() {
  await loadData();
  renderHub();
  show('hub', 'Родителю');
  window.SP.event('parent_open', {
    has_tip: !!dailyTip,
    streak: state.streak,
    practices_done: state.practice_history.length,
  });
})();
