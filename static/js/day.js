const screens = {};
document.querySelectorAll('.day-screen').forEach((el) => {
  screens[el.dataset.screen] = el;
});

const titleEl = document.getElementById('screen-title');
const backBtn = document.getElementById('back-btn');

let activities = [];
let activitiesIndex = {};
let routines = [];

// History для back navigation
const history = ['hub'];

function show(name, title) {
  Object.values(screens).forEach((el) => (el.hidden = true));
  if (screens[name]) screens[name].hidden = false;
  if (title !== undefined) titleEl.textContent = title;
  // hub → no back navigation, just go to /
  backBtn.dataset.target = name === 'hub' ? '/' : 'back';
}

function pushScreen(name, title) {
  history.push(name);
  show(name, title);
}

function popScreen() {
  if (history.length > 1) history.pop();
  const prev = history[history.length - 1];
  const titles = {
    hub: 'День',
    firstthen: 'Сейчас → Потом',
    routines: 'Распорядки',
    'routine-active': 'Распорядок',
    'routine-finished': 'Готово',
  };
  show(prev, titles[prev] || 'День');
}

backBtn.addEventListener('click', () => {
  if (history.length <= 1) {
    location.href = '/';
  } else {
    popScreen();
  }
});

async function loadData() {
  const [aRes, rRes] = await Promise.all([
    fetch('/static/data/day_activities.json'),
    fetch('/static/data/routine_templates.json'),
  ]);
  const aData = await aRes.json();
  const rData = await rRes.json();
  activities = aData.groups || [];
  routines = rData.templates || [];
  activities.forEach((g) => {
    g.items.forEach((it) => {
      activitiesIndex[it.id] = it;
    });
  });
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
      window.SP.event('day_routines_open', {});
    }
  });
});

// ─── First-Then ──────────────────────────────────────
let ftSlots = { first: null, then: null };
let pickerTarget = null; // 'first' | 'then' | 'routine-add'

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
  routines.forEach((r) => {
    const card = document.createElement('button');
    card.className = 'rt-card';
    card.innerHTML =
      '<span class="rt-card-icon">' + r.icon + '</span>' +
      '<div class="rt-card-body">' +
        '<div class="rt-card-label">' + r.label + '</div>' +
        '<div class="rt-card-sub">' + r.steps.length + ' ' + pluralSteps(r.steps.length) + '</div>' +
      '</div>' +
      '<span class="rt-card-arrow">→</span>';
    card.addEventListener('click', () => startRoutine(r));
    list.appendChild(card);
  });
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
  window.SP.event('routine_start', { routine_id: r.id, steps: r.steps.length });
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
    '<div class="rt-current-label">' + it.label + '</div>' +
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
        '<div>' + a.label + '</div>' +
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
  window.SP.event('routine_finish', { routine_id: activeRoutine.id });
}

document.getElementById('rt-done').addEventListener('click', () => advanceRoutine(false));
document.getElementById('rt-skip').addEventListener('click', () => advanceRoutine(true));
document.getElementById('rt-finish-back').addEventListener('click', () => {
  history.length = 1;
  history.push('routines');
  renderRoutinesList();
  show('routines', 'Распорядки');
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
        '<span class="picker-item-label">' + it.label + '</span>';
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
  }
  closePicker();
}

document.getElementById('picker-back').addEventListener('click', closePicker);

// ─── Init ─────────────────────────────────────────────
(async function init() {
  await loadData();
  show('hub', 'День');
  window.SP.event('day_open', {});
})();
