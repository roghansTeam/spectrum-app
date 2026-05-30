const STORAGE_KEY = 'spectrum_emotions_progress';
const QUESTIONS_PER_LEVEL = 8;
const PASS_THRESHOLD = 6;  // 6 из 8 — уровень пройден

const screens = {};
document.querySelectorAll('.em-screen').forEach((el) => {
  screens[el.dataset.screen] = el;
});

const titleEl = document.getElementById('screen-title');
const backBtn = document.getElementById('back-btn');

let levels = [];
let emotions = {};
let progress = loadProgress(); // { completed: [1,2], current_level: 3 }
let activeLevel = null;
let questionIdx = 0;
let questionPlan = []; // массив сгенерированных вопросов на уровень
let answers = []; // { correct, emotion_id }
let streak = 0;

function loadProgress() {
  try {
    const p = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (p && Array.isArray(p.completed)) return p;
  } catch (_) {}
  return { completed: [], current_level: 1 };
}

function saveProgress() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch (_) {}
}

function show(name, title) {
  Object.values(screens).forEach((el) => (el.hidden = true));
  if (screens[name]) screens[name].hidden = false;
  if (title !== undefined) titleEl.textContent = title;
}

backBtn.addEventListener('click', () => {
  const currentScreen = Object.entries(screens).find(([, el]) => !el.hidden)?.[0];
  if (currentScreen === 'game' || currentScreen === 'done') {
    show('menu', 'Эмоции');
    renderLevels();
  } else {
    location.href = '/';
  }
});

async function loadData() {
  const res = await fetch('/static/data/emotion_levels.json');
  const data = await res.json();
  levels = data.levels || [];
  emotions = data.emotions || {};
}

// ─── Menu ────────────────────────────────────────────
function renderLevels() {
  const list = document.getElementById('levels');
  list.innerHTML = '';
  levels.forEach((lv) => {
    const completed = progress.completed.includes(lv.id);
    const unlocked = lv.id === 1 || progress.completed.includes(lv.id - 1);
    const btn = document.createElement('button');
    btn.className =
      'em-level' +
      (completed ? ' em-level-completed' : '') +
      (unlocked && !completed ? ' em-level-unlocked' : '') +
      (!unlocked ? ' em-level-locked' : '');
    btn.innerHTML =
      '<div class="em-level-num">' + lv.id + '</div>' +
      '<div class="em-level-label">' + lv.description + '</div>' +
      (completed ? '<div class="em-level-star">⭐</div>' : '');
    btn.addEventListener('click', () => startLevel(lv));
    list.appendChild(btn);
  });
}

// ─── Game ────────────────────────────────────────────
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildQuestion(level) {
  if (level.mode === 'context') {
    const scenarios = level.scenarios || [];
    const sc = scenarios[Math.floor(Math.random() * scenarios.length)];
    const correctEmotionId = sc.correct[Math.floor(Math.random() * sc.correct.length)];
    const optionIds = shuffle([correctEmotionId, ...sc.distractors]).slice(0, level.options_count);
    return {
      mode: 'context',
      text: sc.text,
      face: null,
      correct_id: correctEmotionId,
      correct_ids: sc.correct, // допустимы несколько правильных
      options: optionIds.map((id) => ({ id, ...emotions[id] })),
    };
  }

  // face_to_label или label_to_face
  const pool = level.pool;
  const correctId = pool[Math.floor(Math.random() * pool.length)];
  const distractors = shuffle(pool.filter((id) => id !== correctId)).slice(0, level.options_count - 1);
  const optionIds = shuffle([correctId, ...distractors]);

  if (level.mode === 'label_to_face') {
    // Показываем подпись, варианты — лица
    return {
      mode: 'label_to_face',
      text: emotions[correctId].label,
      face: null,
      correct_id: correctId,
      correct_ids: [correctId],
      options: optionIds.map((id) => ({ id, ...emotions[id] })),
    };
  }

  // face_to_label (default)
  return {
    mode: 'face_to_label',
    text: null,
    face: emotions[correctId].icon,
    correct_id: correctId,
    correct_ids: [correctId],
    options: optionIds.map((id) => ({ id, ...emotions[id] })),
  };
}

function startLevel(level) {
  activeLevel = level;
  questionIdx = 0;
  questionPlan = Array.from({ length: QUESTIONS_PER_LEVEL }, () => buildQuestion(level));
  answers = [];
  streak = 0;
  document.getElementById('game-level-label').textContent = level.label;
  show('game', level.label);
  renderQuestion();
  window.SP.event('emotions_level_start', { level: level.id, mode: level.mode });
}

function renderQuestion() {
  const q = questionPlan[questionIdx];
  if (!q) return;
  const progressPct = Math.round((questionIdx / QUESTIONS_PER_LEVEL) * 100);
  document.getElementById('game-progress').style.width = progressPct + '%';
  document.getElementById('game-streak').textContent =
    streak > 0 ? `Серия: ${streak}` : '';

  const qEl = document.getElementById('game-question');
  if (q.mode === 'face_to_label') {
    qEl.innerHTML =
      '<div class="em-q-face">' + q.face + '</div>' +
      '<div class="em-q-prompt">Какая это эмоция?</div>';
  } else if (q.mode === 'label_to_face') {
    qEl.innerHTML =
      '<div class="em-q-text">«' + q.text + '»</div>' +
      '<div class="em-q-prompt">Какое лицо подходит?</div>';
  } else {
    qEl.innerHTML =
      '<div class="em-q-text">' + q.text + '</div>' +
      '<div class="em-q-prompt">Что он чувствует?</div>';
  }

  const optsEl = document.getElementById('game-options');
  optsEl.className = 'em-game-options';
  if (q.options.length === 2) optsEl.classList.add('cols-2');
  else if (q.options.length === 3) optsEl.classList.add('cols-3');

  optsEl.innerHTML = '';
  q.options.forEach((opt) => {
    const btn = document.createElement('button');
    btn.className = 'em-option';
    if (q.mode === 'label_to_face') {
      // Слово сверху — варианты только лица (без подписи под ними)
      btn.classList.add('em-option-face-only');
      btn.innerHTML = '<span class="em-option-face">' + opt.icon + '</span>';
    } else {
      // Лицо или сценарий сверху — варианты только текст
      // (без эмодзи-подсказок, иначе игра превращается в «найди такой же эмоджи»)
      btn.classList.add('em-option-text-only');
      btn.innerHTML = '<span class="em-option-label">' + opt.label + '</span>';
    }
    btn.addEventListener('click', () => onAnswer(opt, q));
    optsEl.appendChild(btn);
  });

  document.getElementById('feedback').hidden = true;
}

function onAnswer(opt, q) {
  const buttons = document.querySelectorAll('.em-option');
  buttons.forEach((b) => b.classList.add('em-option-disabled'));
  const isCorrect = q.correct_ids.includes(opt.id);
  answers.push({ correct: isCorrect, emotion_id: opt.id, expected_id: q.correct_id });
  streak = isCorrect ? streak + 1 : 0;

  buttons.forEach((b, i) => {
    const optionId = q.options[i].id;
    if (q.correct_ids.includes(optionId)) {
      b.classList.add('em-option-correct');
    } else if (b === buttons[Array.from(buttons).findIndex((x) => x === document.activeElement)]) {
      // ignore — find actual clicked
    }
  });
  if (!isCorrect) {
    const idx = q.options.findIndex((o) => o.id === opt.id);
    if (idx >= 0) buttons[idx].classList.add('em-option-wrong');
  }

  const fb = document.getElementById('feedback');
  fb.hidden = false;
  if (isCorrect) {
    fb.className = 'em-feedback em-feedback-correct';
    fb.textContent = 'Верно!';
  } else {
    fb.className = 'em-feedback em-feedback-wrong';
    const correctEmotion = emotions[q.correct_id];
    fb.textContent = 'Это ' + correctEmotion.label + ' ' + correctEmotion.icon;
  }

  window.SP.event('emotions_answer', {
    level: activeLevel.id,
    qidx: questionIdx,
    correct: isCorrect,
    chose: opt.id,
    expected: q.correct_id,
  });

  setTimeout(() => {
    questionIdx++;
    if (questionIdx >= QUESTIONS_PER_LEVEL) {
      finishLevel();
    } else {
      renderQuestion();
    }
  }, isCorrect ? 800 : 1600);
}

function finishLevel() {
  const correctCount = answers.filter((a) => a.correct).length;
  const passed = correctCount >= PASS_THRESHOLD;
  if (passed && !progress.completed.includes(activeLevel.id)) {
    progress.completed.push(activeLevel.id);
    progress.completed.sort((a, b) => a - b);
    saveProgress();
  }

  document.getElementById('done-sub').textContent = passed
    ? activeLevel.label + ' пройден'
    : `Правильно ${correctCount} из ${QUESTIONS_PER_LEVEL}. Можно попробовать ещё раз.`;
  document.getElementById('done-stats').textContent =
    `${correctCount} из ${QUESTIONS_PER_LEVEL}`;

  show('done', 'Готово');
  window.SP.event('emotions_level_finish', {
    level: activeLevel.id,
    correct: correctCount,
    total: QUESTIONS_PER_LEVEL,
    passed,
  });
}

document.getElementById('done-menu').addEventListener('click', () => {
  renderLevels();
  show('menu', 'Эмоции');
});

document.getElementById('done-next').addEventListener('click', () => {
  const nextId = activeLevel.id + 1;
  const next = levels.find((l) => l.id === nextId);
  if (next && (nextId === 1 || progress.completed.includes(nextId - 1))) {
    startLevel(next);
  } else {
    renderLevels();
    show('menu', 'Эмоции');
  }
});

// ─── Init ────────────────────────────────────────────
(async function init() {
  await loadData();
  renderLevels();
  show('menu', 'Эмоции');
  window.SP.event('emotions_open', {
    completed_count: progress.completed.length,
  });
})();
