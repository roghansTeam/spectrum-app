const STORAGE_KEY = 'spectrum_mood_history';
const HISTORY_LIMIT = 365; // храним до 365 записей

const screens = {};
document.querySelectorAll('.md-screen').forEach((el) => {
  screens[el.dataset.screen] = el;
});

const titleEl = document.getElementById('screen-title');
const backBtn = document.getElementById('back-btn');
const historyBtn = document.getElementById('history-btn');

let zones = [];
let triggers = [];
let triggerCategories = [];
let coping = [];

let current = {
  zone_id: null,
  trigger_ids: [],
};

const navStack = ['hub'];

function show(name, title) {
  Object.values(screens).forEach((el) => (el.hidden = true));
  if (screens[name]) screens[name].hidden = false;
  if (title) titleEl.textContent = title;
  historyBtn.hidden = !(name === 'hub');
}

function pushScreen(name, title) {
  navStack.push(name);
  show(name, title);
}

function popScreen() {
  if (navStack.length > 1) navStack.pop();
  const prev = navStack[navStack.length - 1];
  const titles = {
    hub: 'Настроение',
    triggers: 'Что повлияло?',
    coping: 'Что поможет',
    saved: 'Записано',
    history: 'История',
  };
  show(prev, titles[prev] || 'Настроение');
}

backBtn.addEventListener('click', () => {
  if (navStack.length <= 1) {
    location.href = '/';
  } else {
    popScreen();
  }
});

historyBtn.addEventListener('click', () => {
  renderHistory();
  pushScreen('history', 'История');
  window.SP.event('mood_history_open', {});
});

async function loadData() {
  const res = await fetch('/static/data/mood_data.json');
  const data = await res.json();
  zones = data.zones || [];
  triggers = data.triggers || [];
  triggerCategories = data.trigger_categories || [];
  coping = data.coping || [];
}

// ─── Storage ─────────────────────────────────────────
function loadHistory() {
  try {
    const arr = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(arr) ? arr : [];
  } catch (_) {
    return [];
  }
}

function saveHistory(entry) {
  const all = loadHistory();
  all.unshift(entry);
  if (all.length > HISTORY_LIMIT) all.length = HISTORY_LIMIT;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch (_) {}
}

// ─── Hub: zones ──────────────────────────────────────
function renderZones() {
  const wrap = document.getElementById('zones');
  wrap.innerHTML = '';
  zones.forEach((z) => {
    const btn = document.createElement('button');
    btn.className = 'md-zone';
    btn.style.background = z.color;
    btn.innerHTML =
      '<span class="md-zone-icon">' + z.icon + '</span>' +
      '<div>' +
        '<div class="md-zone-label">' + z.label + '</div>' +
        '<div class="md-zone-desc">' + z.description + '</div>' +
      '</div>';
    btn.addEventListener('click', () => onPickZone(z));
    wrap.appendChild(btn);
  });
}

function onPickZone(z) {
  current = { zone_id: z.id, trigger_ids: [] };
  renderZonePill();
  renderTriggers();
  pushScreen('triggers', 'Что повлияло?');
  window.SP.event('mood_zone_pick', { zone: z.id });
}

// ─── Triggers ────────────────────────────────────────
function renderZonePill() {
  const z = zones.find((x) => x.id === current.zone_id);
  if (!z) return;
  const pill = document.getElementById('zone-pill');
  pill.style.background = z.color;
  pill.innerHTML = '<span>' + z.icon + '</span><span>' + z.label + ' зона</span>';
}

function renderTriggers() {
  const wrap = document.getElementById('triggers');
  wrap.innerHTML = '';
  triggerCategories.forEach((cat) => {
    const catTriggers = triggers.filter((t) => t.category === cat.id);
    if (!catTriggers.length) return;
    const group = document.createElement('div');
    group.className = 'md-trigger-group';
    group.innerHTML = '<div class="md-trigger-group-label">' + cat.label + '</div>';
    const chips = document.createElement('div');
    chips.className = 'md-trigger-chips';
    catTriggers.forEach((t) => {
      const chip = document.createElement('button');
      chip.className = 'md-chip';
      chip.textContent = t.label;
      chip.addEventListener('click', () => {
        const idx = current.trigger_ids.indexOf(t.id);
        if (idx >= 0) {
          current.trigger_ids.splice(idx, 1);
          chip.classList.remove('md-chip-active');
        } else {
          current.trigger_ids.push(t.id);
          chip.classList.add('md-chip-active');
        }
      });
      chips.appendChild(chip);
    });
    group.appendChild(chips);
    wrap.appendChild(group);
  });
}

document.getElementById('triggers-skip').addEventListener('click', () => {
  current.trigger_ids = [];
  proceedAfterTriggers(true);
});
document.getElementById('triggers-next').addEventListener('click', () => {
  proceedAfterTriggers(false);
});

function proceedAfterTriggers(skipped) {
  window.SP.event('mood_triggers_set', {
    zone: current.zone_id,
    count: current.trigger_ids.length,
    categories: Array.from(new Set(current.trigger_ids
      .map((id) => triggers.find((t) => t.id === id)?.category)
      .filter(Boolean))),
    skipped,
  });
  const z = current.zone_id;
  const hasCoping = coping.some((c) => c.for_zones.includes(z));
  if ((z === 'yellow' || z === 'red' || z === 'blue') && hasCoping) {
    renderCoping();
    pushScreen('coping', 'Что поможет');
  } else {
    finishEntry();
  }
}

// ─── Coping ──────────────────────────────────────────
function renderCoping() {
  const list = document.getElementById('coping');
  list.innerHTML = '';
  const opts = coping.filter((c) => c.for_zones.includes(current.zone_id));
  opts.forEach((c) => {
    const card = document.createElement('button');
    card.className = 'md-coping-card';
    card.innerHTML =
      '<span class="md-coping-icon">' + c.icon + '</span>' +
      '<div class="md-coping-body">' +
        '<div class="md-coping-label">' + c.label + '</div>' +
        '<div class="md-coping-desc">' + c.description + '</div>' +
      '</div>';
    card.addEventListener('click', () => {
      window.SP.event('mood_coping_pick', { coping_id: c.id, zone: current.zone_id });
      finishEntry(c.id);
    });
    list.appendChild(card);
  });
}

document.getElementById('coping-skip').addEventListener('click', () => {
  window.SP.event('mood_coping_skip', { zone: current.zone_id });
  finishEntry(null);
});

// ─── Save ────────────────────────────────────────────
function finishEntry(copingId) {
  const entry = {
    zone_id: current.zone_id,
    trigger_ids: [...current.trigger_ids],
    coping_id: copingId || null,
    ts: new Date().toISOString(),
  };
  saveHistory(entry);
  window.SP.event('mood_entry_save', {
    zone: entry.zone_id,
    triggers: entry.trigger_ids.length,
    coping_picked: !!copingId,
  });
  setupShareButton(entry);
  pushScreen('saved', 'Записано');
}

function setupShareButton(entry) {
  const btn = document.getElementById('saved-share');
  const supported = !!(navigator.share || (window.Telegram && window.Telegram.WebApp));
  btn.hidden = !supported;
  if (!supported) return;
  btn.onclick = async () => {
    const summary = buildShareSummary(entry);
    window.SP.event('mood_share_click', { zone: entry.zone_id });
    const tg = window.Telegram && window.Telegram.WebApp;
    if (tg && tg.openTelegramLink) {
      const url = 'https://t.me/share/url?url=' + encodeURIComponent('https://spectrum-app.fly.dev/mood') +
        '&text=' + encodeURIComponent(summary);
      tg.openTelegramLink(url);
      return;
    }
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Спектр — Настроение', text: summary });
      } catch (_) { /* user cancelled */ }
    }
  };
}

function buildShareSummary(entry) {
  const z = zones.find((x) => x.id === entry.zone_id);
  const zoneLine = z ? z.icon + ' Я в ' + z.label.toLowerCase() + ' зоне' : 'Зона: —';
  const trigLabels = entry.trigger_ids
    .map((id) => triggers.find((t) => t.id === id)?.label)
    .filter(Boolean);
  const trigLine = trigLabels.length ? '\n📍 ' + trigLabels.join(', ') : '';
  const coping = entry.coping_id ? coping_db_get(entry.coping_id) : null;
  const cLine = coping ? '\n💡 Помогает: ' + coping.label : '';
  return zoneLine + trigLine + cLine;
}

function coping_db_get(id) {
  return coping.find((c) => c.id === id);
}

document.getElementById('saved-home').addEventListener('click', () => {
  location.href = '/';
});
document.getElementById('saved-history').addEventListener('click', () => {
  renderHistory();
  navStack.length = 1; // reset
  navStack.push('history');
  show('history', 'История');
});

// ─── History ─────────────────────────────────────────
function renderHistory() {
  const all = loadHistory();
  const stats = document.getElementById('history-stats');
  const last7 = all.filter((e) => Date.now() - Date.parse(e.ts) < 7 * 86400 * 1000);
  const last30 = all.filter((e) => Date.now() - Date.parse(e.ts) < 30 * 86400 * 1000);
  stats.innerHTML =
    '<div class="md-history-stat"><div class="md-history-stat-val">' + all.length + '</div><div class="md-history-stat-label">всего</div></div>' +
    '<div class="md-history-stat"><div class="md-history-stat-val">' + last7.length + '</div><div class="md-history-stat-label">7 дней</div></div>' +
    '<div class="md-history-stat"><div class="md-history-stat-val">' + last30.length + '</div><div class="md-history-stat-label">30 дней</div></div>';

  const list = document.getElementById('history-list');
  list.innerHTML = '';
  if (all.length === 0) {
    list.innerHTML = '<div class="md-history-empty">Пока пусто. Первая запись появится здесь.</div>';
    return;
  }
  all.slice(0, 50).forEach((e) => {
    const z = zones.find((x) => x.id === e.zone_id) || { color: '#999', icon: '?', label: '?' };
    const trigLabels = e.trigger_ids
      .map((id) => triggers.find((t) => t.id === id)?.label)
      .filter(Boolean);
    const row = document.createElement('div');
    row.className = 'md-history-row';
    row.innerHTML =
      '<div class="md-history-zone-dot" style="background:' + z.color + '">' + z.icon + '</div>' +
      '<div class="md-history-body">' +
        '<div class="md-history-when">' + formatWhen(e.ts) + ' • ' + z.label + '</div>' +
        (trigLabels.length
          ? '<div class="md-history-meta">' + trigLabels.join(', ') + '</div>'
          : '<div class="md-history-meta">без триггеров</div>') +
      '</div>';
    list.appendChild(row);
  });
}

function formatWhen(iso) {
  const d = new Date(iso);
  const today = new Date();
  const sameDay =
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const wasYesterday =
    d.getDate() === yesterday.getDate() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getFullYear() === yesterday.getFullYear();
  const time = d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
  if (sameDay) return 'Сегодня ' + time;
  if (wasYesterday) return 'Вчера ' + time;
  const months = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  return d.getDate() + ' ' + months[d.getMonth()] + ' ' + time;
}

document.getElementById('history-clear').addEventListener('click', () => {
  if (!confirm('Удалить всю историю настроения? Это необратимо.')) return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (_) {}
  renderHistory();
  window.SP.event('mood_history_clear', {});
});

// ─── Init ────────────────────────────────────────────
(async function init() {
  await loadData();
  renderZones();
  show('hub', 'Настроение');
  const count = loadHistory().length;
  window.SP.event('mood_open', { history_count: count });
})();
