const STORAGE_KEY = 'spectrum_custom_routines';
const ICON_PALETTE = [
  '🌅','🌆','🌙','🏠','🏫','🏞️','🏪','🏥',
  '🚗','🚌','🚲','🛒','🎒','🎂','🎁','🎈',
  '🍎','🥣','🥪','🍽️','🛁','🛏️','🪥','📚',
];

const screens = {};
document.querySelectorAll('.day-screen').forEach((el) => {
  screens[el.dataset.screen] = el;
});

const titleEl = document.getElementById('screen-title');
const backBtn = document.getElementById('back-btn');

let activities = [];
let activitiesIndex = {};
let builtinRoutines = [];
let customRoutines = [];

// ─── Navigation ──────────────────────────────────────
const history = ['hub'];
const SCREEN_TITLES = {
  hub: 'День',
  firstthen: 'Сейчас → Потом',
  routines: 'Распорядки',
  builder: 'Свой распорядок',
  'routine-active': 'Распорядок',
  'routine-finished': 'Готово',
};

function show(name, title) {
  Object.values(screens).forEach((el) => (el.hidden = true));
  if (screens[name]) screens[name].hidden = false;
  if (title !== undefined) titleEl.textContent = title;
}

function pushScreen(name, title) {
  history.push(name);
  show(name, title || SCREEN_TITLES[name]);
}

function popScreen() {
  if (history.length > 1) history.pop();
  const prev = history[history.length - 1];
  if (prev === 'routines') renderRoutinesList();
  show(prev, SCREEN_TITLES[prev] || 'День');
}

backBtn.addEventListener('click', () => {
  if (history.length <= 1) {
    location.href = '/';
  } else {
    popScreen();
  }
});

// ─── Data loading ────────────────────────────────────
async function loadData() {
  const [aRes, rRes] = await Promise.all([
    fetch('/static/data/day_activities.json'),
    fetch('/static/data/routine_templates.json'),
  ]);
  const aData = await aRes.json();
  const rData = await rRes.json();
  activities = aData.groups || [];
  builtinRoutines = (rData.templates || []).map((t) => ({ ...t, builtin: true }));
  activities.forEach((g) => {
    g.items.forEach((it) => {
      activitiesIndex[it.id] = it;
    });
  });
  loadCustomRoutines();
}

function loadCustomRoutines() {
  try {
    const arr = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    customRoutines = Array.isArray(arr) ? arr.map((r) => ({ ...r, builtin: false })) : [];
  } catch (_) {
    customRoutines = [];
  }
}

function saveCustomRoutines() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(
        customRoutines.map(({ id, label, icon, steps }) => ({ id, label, icon, steps }))
      )
    );
  } catch (_) {}
}

// ─── Hub ─────────────────────────────────────────────
document.querySelectorAll('.day-mode').forEach((btn) => {
  btn.addEventListener('click', () => {
    const action = btn.dataset.action;
    if (action === 'open-firstthen') {
      pushScreen('firstthen', 'Сейчас → Потом');
      window.SP.event('day_firstthen_open', {});
    } else if (action === 'open-routines') {
      renderRoutinesList();
      pushScreen('routines', 'Распорядки');
      window.SP.event('day_routines_open', { custom: customRoutines.length });
    }
  });
});

// ─── First-Then ──────────────────────────────────────
let ftSlots = { first: null, then: null };
let pickerTarget = null; // 'first' | 'then' | 'builder-step'

function renderFt() {
  ['first', 'then'].forEach((slot) => {
    const el = document.getElementById('ft-' + slot);
    const it = ftSlots[slot];
    if (it) {
      el.classList.remove('ft-slot-empty');
      el.innerHTML =
        '<span class="ft-slot-icon">' + it.icon + '</span>' +
        '<span class="ft-slot-text">' + it.label + '</span>';
    } else {
      el.classList.add('ft-slot-empty');
      el.innerHTML = '<span class="ft-slot-plus">+</span>';
    }
  });
  document.getElementById('ft-clear').hidden = !(ftSlots.first || ftSlots.then);
}

['first', 'then'].forEach((slot) => {
  document.getElementById('ft-' + slot).addEventListener('click', () => {
    pickerTarget = slot;
    openPicker();
  });
});

document.getElementById('ft-clear').addEventListener('click', () => {
  ftSlots = { first: null, then: null };
  renderFt();
  window.SP.event('day_firstthen_clear', {});
});

// ─── Routines list ────────────────────────────────────
function renderRoutinesList() {
  const list = document.getElementById('rt-list');
  list.innerHTML = '';

  if (builtinRoutines.length) {
    const head = document.createElement('div');
    head.className = 'rt-section-header';
    head.textContent = 'Готовые';
    list.appendChild(head);
    builtinRoutines.forEach((r) => list.appendChild(renderRoutineCard(r)));
  }

  if (customRoutines.length) {
    const head = document.createElement('div');
    head.className = 'rt-section-header';
    head.textContent = 'Свои';
    list.appendChild(head);
    customRoutines.forEach((r) => list.appendChild(renderRoutineCard(r)));
  }
}

function renderRoutineCard(r) {
  const wrap = document.createElement('div');
  wrap.style.display = 'flex';
  wrap.style.gap = '6px';
  wrap.style.alignItems = 'stretch';

  const card = document.createElement('button');
  card.className = 'rt-card';
  card.style.flex = '1';
  card.innerHTML =
    '<span class="rt-card-icon">' + r.icon + '</span>' +
    '<div class="rt-card-body">' +
      '<div class="rt-card-label">' + escapeHtml(r.label) + '</div>' +
      '<div class="rt-card-sub">' + r.steps.length + ' ' + pluralSteps(r.steps.length) + '</div>' +
    '</div>' +
    '<span class="rt-card-arrow">→</span>';
  card.addEventListener('click', () => startRoutine(r));
  wrap.appendChild(card);

  if (!r.builtin) {
    const edit = document.createElement('button');
    edit.className = 'rt-edit-btn';
    edit.setAttribute('aria-label', 'Изменить');
    edit.textContent = '✎';
    edit.addEventListener('click', (e) => {
      e.stopPropagation();
      openBuilder(r);
    });
    wrap.appendChild(edit);
  }

  return wrap;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function pluralSteps(n) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'шаг';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'шага';
  return 'шагов';
}

// ─── Routine in progress ──────────────────────────────
let activeRoutine = null;
let currentStep = 0;

function startRoutine(r) {
  activeRoutine = r;
  currentStep = 0;
  renderRoutineActive();
  pushScreen('routine-active', r.label);
  window.SP.event('routine_start', {
    routine_id: r.id,
    steps: r.steps.length,
    custom: !r.builtin,
  });
}

function renderRoutineActive() {
  if (!activeRoutine) return;
  const stepId = activeRoutine.steps[currentStep];
  const it = activitiesIndex[stepId];
  if (!it) return;
  const total = activeRoutine.steps.length;
  document.getElementById('rt-progress-bar').style.width =
    Math.round((currentStep / total) * 100) + '%';
  document.getElementById('rt-current').innerHTML =
    '<div class="rt-current-icon">' + it.icon + '</div>' +
    '<div class="rt-current-label">' + escapeHtml(it.label) + '</div>' +
    '<div class="rt-current-step">' + (currentStep + 1) + ' из ' + total + '</div>';

  const upcoming = document.getElementById('rt-upcoming');
  upcoming.innerHTML = '';
  activeRoutine.steps.forEach((id, i) => {
    const a = activitiesIndex[id];
    if (!a) return;
    let cls = 'rt-upcoming-card';
    if (i < currentStep) cls += ' rt-upcoming-card-done';
    else if (i === currentStep) cls += ' rt-upcoming-card-current';
    upcoming.innerHTML +=
      '<div class="' + cls + '">' +
        '<div class="rt-upcoming-card-icon">' + a.icon + '</div>' +
        '<div>' + escapeHtml(a.label) + '</div>' +
      '</div>';
  });
}

function advanceRoutine(skipped) {
  const stepId = activeRoutine.steps[currentStep];
  window.SP.event(skipped ? 'routine_skip' : 'routine_step_done', {
    routine_id: activeRoutine.id,
    step_idx: currentStep,
    step_id: stepId,
  });
  currentStep++;
  if (currentStep >= activeRoutine.steps.length) {
    finishRoutine();
  } else {
    renderRoutineActive();
  }
}

function finishRoutine() {
  document.getElementById('rt-finish-sub').textContent =
    activeRoutine.label + ' — выполнено';
  pushScreen('routine-finished', 'Готово');
  try {
    const hist = JSON.parse(localStorage.getItem('spectrum_day_history') || '[]');
    hist.unshift({ routine_id: activeRoutine.id, ts: new Date().toISOString() });
    if (hist.length > 200) hist.length = 200;
    localStorage.setItem('spectrum_day_history', JSON.stringify(hist));
  } catch (_) {}
  setupShareButton(activeRoutine);
  window.SP.event('routine_finish', {
    routine_id: activeRoutine.id,
    custom: !activeRoutine.builtin,
  });
}

function setupShareButton(routine) {
  const btn = document.getElementById('rt-share-btn');
  const supported = !!(navigator.share || (window.Telegram && window.Telegram.WebApp));
  btn.hidden = !supported;
  if (!supported) return;
  btn.onclick = () => {
    const summary = routine.icon + ' Сегодня прошли распорядок «' + routine.label + '» в Спектре. ' + routine.steps.length + ' ' + pluralSteps(routine.steps.length) + ' позади.';
    window.SP.event('routine_share_click', { routine_id: routine.id });
    const tg = window.Telegram && window.Telegram.WebApp;
    if (tg && tg.openTelegramLink) {
      const url = 'https://t.me/share/url?url=' + encodeURIComponent('https://spectrum-app.fly.dev/day') +
        '&text=' + encodeURIComponent(summary);
      tg.openTelegramLink(url);
      return;
    }
    if (navigator.share) {
      navigator.share({ title: 'Спектр — День', text: summary }).catch(() => {});
    }
  };
}

document.getElementById('rt-done').addEventListener('click', () => advanceRoutine(false));
document.getElementById('rt-skip').addEventListener('click', () => advanceRoutine(true));
document.getElementById('rt-finish-back').addEventListener('click', () => {
  history.length = 1;
  history.push('routines');
  renderRoutinesList();
  show('routines', 'Распорядки');
});

// ─── Routine builder ─────────────────────────────────
let builderState = null;

document.getElementById('add-routine-btn').addEventListener('click', () => openBuilder(null));

function openBuilder(existing) {
  if (existing) {
    builderState = {
      id: existing.id,
      label: existing.label,
      icon: existing.icon,
      steps: [...existing.steps],
      is_new: false,
    };
  } else {
    builderState = {
      id: 'custom_' + Math.random().toString(36).slice(2, 9),
      label: '',
      icon: ICON_PALETTE[0],
      steps: [],
      is_new: true,
    };
  }
  document.getElementById('rb-title').value = builderState.label;
  document.getElementById('rb-delete-btn').hidden = builderState.is_new;
  renderIconPalette();
  renderBuilderSteps();
  pushScreen('builder', builderState.is_new ? 'Свой распорядок' : 'Изменить распорядок');
  window.SP.event('day_builder_open', {
    is_new: builderState.is_new,
    existing_steps: builderState.steps.length,
  });
}

document.getElementById('rb-title').addEventListener('input', (e) => {
  if (builderState) builderState.label = e.target.value;
});

function renderIconPalette() {
  const wrap = document.getElementById('rb-icons');
  wrap.innerHTML = '';
  ICON_PALETTE.forEach((ic) => {
    const btn = document.createElement('button');
    btn.className = 'rb-icon-btn' + (ic === builderState.icon ? ' rb-icon-btn-active' : '');
    btn.textContent = ic;
    btn.addEventListener('click', () => {
      builderState.icon = ic;
      renderIconPalette();
    });
    wrap.appendChild(btn);
  });
}

function renderBuilderSteps() {
  const wrap = document.getElementById('rb-steps');
  wrap.innerHTML = '';
  document.getElementById('rb-step-count').textContent =
    builderState.steps.length ? builderState.steps.length : '';
  builderState.steps.forEach((aid, idx) => {
    const a = activitiesIndex[aid];
    if (!a) return;
    const row = document.createElement('div');
    row.className = 'rb-step';
    const upBtn = '<button class="rb-step-btn" data-act="up" data-idx="' + idx + '"' +
      (idx === 0 ? ' disabled' : '') + ' aria-label="Вверх">↑</button>';
    const downBtn = '<button class="rb-step-btn" data-act="down" data-idx="' + idx + '"' +
      (idx === builderState.steps.length - 1 ? ' disabled' : '') + ' aria-label="Вниз">↓</button>';
    const delBtn = '<button class="rb-step-btn rb-step-btn-delete" data-act="del" data-idx="' + idx + '" aria-label="Удалить">×</button>';
    row.innerHTML =
      '<span class="rb-step-icon">' + a.icon + '</span>' +
      '<span class="rb-step-label">' + escapeHtml(a.label) + '</span>' +
      upBtn + downBtn + delBtn;
    wrap.appendChild(row);
  });
  wrap.querySelectorAll('.rb-step-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx, 10);
      const act = btn.dataset.act;
      if (act === 'del') {
        builderState.steps.splice(idx, 1);
      } else if (act === 'up' && idx > 0) {
        [builderState.steps[idx - 1], builderState.steps[idx]] =
          [builderState.steps[idx], builderState.steps[idx - 1]];
      } else if (act === 'down' && idx < builderState.steps.length - 1) {
        [builderState.steps[idx + 1], builderState.steps[idx]] =
          [builderState.steps[idx], builderState.steps[idx + 1]];
      }
      renderBuilderSteps();
    });
  });
}

document.getElementById('rb-add-step').addEventListener('click', () => {
  pickerTarget = 'builder-step';
  openPicker();
});

document.getElementById('rb-save-btn').addEventListener('click', () => {
  const label = (builderState.label || '').trim();
  if (!label) {
    alert('Назовите распорядок');
    return;
  }
  if (builderState.steps.length === 0) {
    alert('Добавьте хотя бы один шаг');
    return;
  }
  const entry = {
    id: builderState.id,
    label,
    icon: builderState.icon,
    steps: [...builderState.steps],
  };
  const existingIdx = customRoutines.findIndex((r) => r.id === entry.id);
  if (existingIdx >= 0) {
    customRoutines[existingIdx] = { ...entry, builtin: false };
  } else {
    customRoutines.push({ ...entry, builtin: false });
  }
  saveCustomRoutines();
  window.SP.event(builderState.is_new ? 'day_routine_create' : 'day_routine_edit', {
    id: entry.id,
    steps: entry.steps.length,
  });
  popScreen();
});

document.getElementById('rb-delete-btn').addEventListener('click', () => {
  if (!confirm('Удалить этот распорядок?')) return;
  customRoutines = customRoutines.filter((r) => r.id !== builderState.id);
  saveCustomRoutines();
  window.SP.event('day_routine_delete', { id: builderState.id });
  popScreen();
});

// ─── Activity picker ──────────────────────────────────
function openPicker() {
  const wrap = document.getElementById('picker-groups');
  wrap.innerHTML = '';
  activities.forEach((g) => {
    const groupEl = document.createElement('div');
    groupEl.innerHTML = '<div class="picker-group-label">' + g.label + '</div>';
    const items = document.createElement('div');
    items.className = 'picker-items';
    g.items.forEach((it) => {
      const btn = document.createElement('button');
      btn.className = 'picker-item';
      btn.innerHTML =
        '<span class="picker-item-icon">' + it.icon + '</span>' +
        '<span class="picker-item-label">' + escapeHtml(it.label) + '</span>';
      btn.addEventListener('click', () => pickActivity(it));
      items.appendChild(btn);
    });
    groupEl.appendChild(items);
    wrap.appendChild(groupEl);
  });
  screens.picker.hidden = false;
  window.SP.event('day_picker_open', { target: pickerTarget });
}

function closePicker() {
  screens.picker.hidden = true;
}

function pickActivity(it) {
  if (pickerTarget === 'first' || pickerTarget === 'then') {
    ftSlots[pickerTarget] = it;
    renderFt();
    window.SP.event('day_firstthen_set', { slot: pickerTarget, activity: it.id });
  } else if (pickerTarget === 'builder-step') {
    builderState.steps.push(it.id);
    renderBuilderSteps();
    window.SP.event('day_builder_add_step', { activity: it.id });
  }
  closePicker();
}

document.getElementById('picker-back').addEventListener('click', closePicker);

// ─── Init ─────────────────────────────────────────────
(async function init() {
  await loadData();
  show('hub', 'День');
  window.SP.event('day_open', {
    custom_routines: customRoutines.length,
  });
})();
