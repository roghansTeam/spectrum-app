const STORAGE_KEY = 'spectrum_stories_library';
const FORM_KEY = 'spectrum_stories_last_input';

const screens = {};
document.querySelectorAll('.st-screen').forEach((el) => {
  screens[el.dataset.screen] = el;
});

const titleEl = document.getElementById('screen-title');
const backBtn = document.getElementById('back-btn');
const libraryBtn = document.getElementById('library-btn');

const navStack = ['form'];

function show(name, title) {
  Object.values(screens).forEach((el) => (el.hidden = true));
  if (screens[name]) screens[name].hidden = false;
  if (title) titleEl.textContent = title;
  libraryBtn.hidden = !(name === 'form');
}

function pushScreen(name, title) {
  navStack.push(name);
  show(name, title);
}

function popScreen() {
  if (navStack.length > 1) navStack.pop();
  const prev = navStack[navStack.length - 1];
  const titles = {
    form: 'Истории',
    loading: 'Готовлю…',
    story: 'История',
    library: 'Сохранённые',
    error: 'Ошибка',
  };
  show(prev, titles[prev] || 'Истории');
}

backBtn.addEventListener('click', () => {
  if (navStack.length <= 1) {
    location.href = '/';
  } else {
    popScreen();
  }
});

libraryBtn.addEventListener('click', () => {
  renderLibrary();
  pushScreen('library', 'Сохранённые');
  window.SP.event('stories_library_open', {});
});

// ─── Form ────────────────────────────────────────────
const fName = document.getElementById('f-name');
const fAge = document.getElementById('f-age');
const fSituation = document.getElementById('f-situation');
const fExtra = document.getElementById('f-extra');
const generateBtn = document.getElementById('generate-btn');

(function restoreForm() {
  try {
    const last = JSON.parse(localStorage.getItem(FORM_KEY) || 'null');
    if (last) {
      fName.value = last.name || '';
      fAge.value = last.age || '';
      // Не восстанавливаем situation и extra — каждая история — новая ситуация.
    }
  } catch (_) {}
})();

function saveFormDefaults() {
  try {
    localStorage.setItem(
      FORM_KEY,
      JSON.stringify({ name: fName.value, age: fAge.value })
    );
  } catch (_) {}
}

let currentStory = null;
let currentInput = null;

async function generateStory() {
  const name = fName.value.trim();
  const age = fAge.value.trim();
  const situation = fSituation.value.trim();
  const extra = fExtra.value.trim();
  if (!name || !age || !situation) {
    alert('Заполните имя, возраст и ситуацию.');
    return;
  }
  currentInput = { name, age, situation, extra };
  saveFormDefaults();
  pushScreen('loading', 'Готовлю…');
  window.SP.event('stories_generate_start', { situation_len: situation.length });

  try {
    const startedAt = Date.now();
    const res = await fetch('/api/stories/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, age, situation, extra }),
    });
    const data = await res.json();
    const elapsedMs = Date.now() - startedAt;
    if (!data.ok) {
      showError(data.error || 'unknown_error', elapsedMs);
      return;
    }
    currentStory = data.story;
    renderStory(data.story);
    // history stack: form -> loading -> story (skip loading on back)
    navStack.length = 1;
    navStack.push('story');
    show('story', 'История');
    window.SP.event('stories_generate_success', {
      title: data.story.title,
      sentences: data.story.sentences.length,
      tokens_in: data.tokens?.input,
      tokens_out: data.tokens?.output,
      elapsed_ms: elapsedMs,
    });
  } catch (e) {
    showError(String(e.message || e), null);
  }
}

generateBtn.addEventListener('click', generateStory);

// ─── Story ───────────────────────────────────────────
function renderStory(story) {
  document.getElementById('story-title').textContent = story.title;
  const body = document.getElementById('story-body');
  body.innerHTML = '';
  story.sentences.forEach((s) => {
    const span = document.createElement('span');
    span.className = 'st-story-sentence st-story-sentence-' + s.type;
    span.textContent = s.text;
    body.appendChild(span);
  });
}

document.getElementById('story-new').addEventListener('click', () => {
  fSituation.value = '';
  fExtra.value = '';
  navStack.length = 1;
  show('form', 'Истории');
  window.SP.event('stories_new', {});
});

document.getElementById('story-save').addEventListener('click', () => {
  if (!currentStory || !currentInput) return;
  const all = loadLibrary();
  all.unshift({
    title: currentStory.title,
    sentences: currentStory.sentences,
    input: currentInput,
    ts: new Date().toISOString(),
  });
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all.slice(0, 50)));
  } catch (_) {}
  document.getElementById('story-save').textContent = 'Сохранено ✓';
  setTimeout(() => {
    document.getElementById('story-save').textContent = 'Сохранить';
  }, 1500);
  window.SP.event('stories_save', { title: currentStory.title });
});

// ─── Library ─────────────────────────────────────────
function loadLibrary() {
  try {
    const arr = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(arr) ? arr : [];
  } catch (_) {
    return [];
  }
}

function renderLibrary() {
  const list = document.getElementById('library-list');
  const all = loadLibrary();
  list.innerHTML = '';
  if (all.length === 0) {
    list.innerHTML = '<div class="st-library-empty">Здесь будут истории, которые ты сохранишь.</div>';
    return;
  }
  all.forEach((entry, idx) => {
    const card = document.createElement('button');
    card.className = 'st-library-card';
    const d = new Date(entry.ts);
    const meta =
      entry.input?.name + ' · ' + entry.input?.age + ' · ' +
      d.getDate() + '.' + (d.getMonth() + 1).toString().padStart(2, '0');
    card.innerHTML =
      '<div class="st-library-card-title">' + entry.title + '</div>' +
      '<div class="st-library-card-meta">' + meta + '</div>';
    card.addEventListener('click', () => {
      currentStory = entry;
      currentInput = entry.input;
      renderStory(entry);
      pushScreen('story', 'История');
      window.SP.event('stories_library_open_item', { idx });
    });
    list.appendChild(card);
  });
}

// ─── Error ───────────────────────────────────────────
function showError(reason, elapsedMs) {
  const messages = {
    api_key_missing: 'Сервис генерации временно недоступен. Попробуйте позже.',
    anthropic_sdk_missing: 'Сервис генерации не настроен.',
    parse_failed: 'ИИ вернул неожиданный ответ. Попробуйте сформулировать ситуацию иначе.',
    validation_failed: 'История не прошла проверку. Попробуйте ещё раз.',
    missing_fields: 'Заполните все обязательные поля.',
    fields_too_long: 'Слишком длинный текст — сократите описание.',
  };
  let msg = messages[reason];
  if (!msg && reason.startsWith('anthropic_call_failed')) {
    msg = 'Сервис генерации временно недоступен. Попробуйте через минуту.';
  }
  if (!msg) msg = 'Не удалось сгенерировать историю.';
  document.getElementById('error-sub').textContent = msg;
  navStack.length = 1;
  pushScreen('error', 'Ошибка');
  window.SP.event('stories_generate_error', { error: reason, elapsed_ms: elapsedMs });
}

document.getElementById('error-retry').addEventListener('click', () => {
  if (currentInput) {
    fName.value = currentInput.name;
    fAge.value = currentInput.age;
    fSituation.value = currentInput.situation;
    fExtra.value = currentInput.extra || '';
  }
  navStack.length = 1;
  show('form', 'Истории');
});

// ─── Init ────────────────────────────────────────────
show('form', 'Истории');
window.SP.event('stories_open', { library_count: loadLibrary().length });
