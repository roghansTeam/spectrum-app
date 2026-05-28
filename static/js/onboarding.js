const STORAGE_KEY = 'spectrum_sensory_profile';

const PROFILES = {
  seeking: {
    icon: '🎢',
    label: 'Ищет стимуляцию',
    sub: 'Любит активность, движение, новые ощущения. Может перевозбуждаться, если нет канала для разрядки.',
    tip: 'Спектр предложит больше активных интерактивных элементов и сенсорных мини-игр.',
  },
  hyper: {
    icon: '🌙',
    label: 'Чувствителен к стимулам',
    sub: 'Реагирует на звук, свет, прикосновения сильнее обычного. Перегрузка наступает быстро.',
    tip: 'Спектр включит спокойную палитру, минимум анимаций, тихие звуки.',
  },
  hypo: {
    icon: '🌫️',
    label: 'Слабо реагирует',
    sub: 'Может «уходить в себя», не сразу замечать обращение и сигналы среды.',
    tip: 'Спектр сделает обратную связь более явной — крупнее шрифт, чёткие отклики на действия.',
  },
  mixed: {
    icon: '🌗',
    label: 'Смешанный профиль',
    sub: 'У вашего ребёнка особенности разных типов в равной мере. Это норма для РАС.',
    tip: 'Подстройку можно изменить в настройках в любой момент.',
  },
};

const stages = {};
document.querySelectorAll('.ob-stage').forEach((el) => {
  stages[el.dataset.stage] = el;
});

let questions = [];
let scale = [];
let answers = {};
let qIndex = 0;

function showStage(name) {
  Object.entries(stages).forEach(([k, el]) => {
    el.hidden = k !== name;
  });
}

async function loadQuestionnaire() {
  const res = await fetch('/static/data/sensory_questionnaire.json');
  const data = await res.json();
  questions = data.questions || [];
  scale = data.scale || [];
}

function renderQuestion() {
  const q = questions[qIndex];
  if (!q) return;
  document.getElementById('q-text').textContent = q.text;
  document.getElementById('q-count').textContent = `${qIndex + 1} / ${questions.length}`;
  document.getElementById('progress').style.width = `${((qIndex) / questions.length) * 100}%`;
  document.getElementById('btn-back').hidden = qIndex === 0;

  const scaleEl = document.getElementById('q-scale');
  scaleEl.innerHTML = '';
  scale.forEach((opt) => {
    const btn = document.createElement('button');
    btn.className = 'ob-q-option';
    btn.textContent = opt.label;
    if (answers[q.id] === opt.value) {
      btn.style.borderColor = 'var(--sp-accent)';
      btn.style.background = 'var(--sp-accent-soft)';
    }
    btn.addEventListener('click', () => onAnswer(q, opt.value));
    scaleEl.appendChild(btn);
  });
}

function onAnswer(q, value) {
  answers[q.id] = value;
  window.SP.event('onboarding_answer', { qid: q.id, group: q.group, value });
  if (qIndex < questions.length - 1) {
    qIndex++;
    renderQuestion();
  } else {
    finish();
  }
}

function scoreProfile() {
  const groups = { seeking: 0, hyper: 0, hypo: 0 };
  questions.forEach((q) => {
    const v = answers[q.id] ?? 0;
    if (groups[q.group] !== undefined) groups[q.group] += v;
  });
  const max = Math.max(groups.seeking, groups.hyper, groups.hypo);
  const total = groups.seeking + groups.hyper + groups.hypo;
  let dominant = 'mixed';
  if (total === 0) {
    dominant = 'mixed';
  } else if (max - Math.min(groups.seeking, groups.hyper, groups.hypo) < 2) {
    dominant = 'mixed';
  } else if (max === groups.seeking) {
    dominant = 'seeking';
  } else if (max === groups.hyper) {
    dominant = 'hyper';
  } else {
    dominant = 'hypo';
  }
  return { groups, dominant };
}

function renderResult(result) {
  const profile = PROFILES[result.dominant];
  const card = document.getElementById('result-card');
  const labels = { seeking: 'Поиск', hyper: 'Чувств.', hypo: 'Низкая' };
  const maxVal = 10; // 5 questions × max 2
  const barsHTML = ['seeking', 'hyper', 'hypo']
    .map((g) => {
      const val = result.groups[g];
      const pct = Math.round((val / maxVal) * 100);
      return (
        '<div class="ob-result-bar">' +
        `<div class="ob-result-bar-label">${labels[g]}</div>` +
        `<div class="ob-result-bar-track"><div class="ob-result-bar-fill" style="width:${pct}%"></div></div>` +
        `<div class="ob-result-bar-val">${val}</div>` +
        '</div>'
      );
    })
    .join('');
  card.innerHTML =
    `<div class="ob-result-icon">${profile.icon}</div>` +
    `<div class="ob-result-label">${profile.label}</div>` +
    `<div class="ob-result-sub">${profile.sub}</div>` +
    `<div class="ob-result-bars">${barsHTML}</div>`;
  document.getElementById('result-tip').textContent = profile.tip;
}

function finish() {
  const result = scoreProfile();
  const payload = {
    ...result,
    answered_at: new Date().toISOString(),
    version: 1,
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (_) {}
  window.SP.event('onboarding_complete', payload);
  document.getElementById('progress').style.width = '100%';
  renderResult(result);
  showStage('result');
}

document.getElementById('btn-start').addEventListener('click', () => {
  window.SP.event('onboarding_start', {});
  showStage('questions');
  renderQuestion();
});

document.getElementById('btn-skip').addEventListener('click', () => {
  window.SP.event('onboarding_skip', {});
  location.href = '/';
});

document.getElementById('btn-back').addEventListener('click', () => {
  if (qIndex > 0) {
    qIndex--;
    renderQuestion();
  }
});

document.getElementById('btn-done').addEventListener('click', () => {
  location.href = '/';
});

(async function init() {
  await loadQuestionnaire();
  showStage('intro');
  window.SP.event('onboarding_open', {});
})();
