const grid = document.getElementById('grid');
const strip = document.getElementById('strip');
const tabs = document.getElementById('tabs');
const btnSay = document.getElementById('btn-say');
const btnClear = document.getElementById('btn-clear');
const modeToggle = document.getElementById('mode-toggle');
const modeBanner = document.getElementById('mode-banner');
const modeBannerClose = document.getElementById('mode-banner-close');
const titleEl = document.getElementById('aac-title');

let sentence = [];
let categories = [];
let activeCategoryId = null;
let recordMode = false;
let customWords = new Set(); // слова с записанным голосом

async function loadVocabulary() {
  try {
    const res = await fetch('/static/data/core_vocabulary.json');
    const data = await res.json();
    categories = data.categories || [];
    activeCategoryId = categories[0]?.id || null;
  } catch (e) {
    console.error('Failed to load vocabulary', e);
    categories = [];
  }
}

async function refreshCustomWords() {
  if (!window.SP.voice || !window.SP.voice.isSupported()) return;
  try {
    const words = await window.SP.voice.listWords();
    customWords = new Set(words);
  } catch (e) {
    customWords = new Set();
  }
}

function renderTabs() {
  tabs.innerHTML = '';
  let activeEl = null;
  categories.forEach((cat) => {
    const tab = document.createElement('button');
    const isActive = cat.id === activeCategoryId;
    tab.className = 'aac-tab' + (isActive ? ' aac-tab-active' : '');
    tab.innerHTML =
      '<span class="aac-tab-icon">' + cat.icon + '</span>' +
      '<span class="aac-tab-label">' + cat.label + '</span>';
    tab.addEventListener('click', () => {
      activeCategoryId = cat.id;
      renderTabs();
      renderGrid();
      window.SP.event('aac_category_switch', { category: cat.id });
    });
    tabs.appendChild(tab);
    if (isActive) activeEl = tab;
  });
  if (activeEl && activeEl.scrollIntoView) {
    activeEl.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }
}

function renderGrid() {
  grid.innerHTML = '';
  const cat = categories.find((c) => c.id === activeCategoryId);
  if (!cat) return;
  cat.words.forEach(({ word, icon }) => {
    const card = document.createElement('button');
    card.className = 'aac-card' + (recordMode ? ' aac-card-recording-mode' : '');
    const badge = customWords.has(word)
      ? '<span class="aac-card-badge">✓</span>'
      : '';
    card.innerHTML =
      badge +
      '<span class="aac-card-icon">' + icon + '</span>' +
      '<span class="aac-card-label">' + word + '</span>';
    card.addEventListener('click', () => onCardTap(word, icon, cat.id));
    grid.appendChild(card);
  });
}

function renderStrip() {
  if (sentence.length === 0) {
    strip.innerHTML = '<span class="aac-strip-empty">Выбери карточки</span>';
    return;
  }
  strip.innerHTML = sentence
    .map(
      ({ word, icon }) =>
        '<div class="aac-strip-card">' +
        '<span class="aac-strip-card-icon">' + icon + '</span>' +
        '<span>' + word + '</span>' +
        '</div>'
    )
    .join('');
  strip.scrollLeft = strip.scrollWidth;
}

async function speakWord(word) {
  if (customWords.has(word) && window.SP.voice) {
    const played = await window.SP.voice.play(word);
    if (played) return;
  }
  window.SP.tts.speak(word);
}

async function speakPhrase(words) {
  // Проигрываем карточки последовательно: каждая через свой голос или TTS.
  for (const w of words) {
    if (customWords.has(w) && window.SP.voice) {
      const rec = await window.SP.voice.get(w);
      if (rec && rec.blob) {
        await new Promise((resolve) => {
          const audio = new Audio(URL.createObjectURL(rec.blob));
          audio.onended = () => resolve();
          audio.onerror = () => resolve();
          audio.play().catch(() => resolve());
        });
        continue;
      }
    }
    window.SP.tts.speak(w);
    // Пауза эквивалентная произнесению слова (приближённо)
    await new Promise((r) => setTimeout(r, 600));
  }
}

function onCardTap(word, icon, categoryId) {
  if (recordMode) {
    openRecorder(word, icon, categoryId);
    return;
  }
  sentence.push({ word, icon });
  renderStrip();
  speakWord(word);
  window.SP.event('aac_card_tap', {
    word,
    category: categoryId,
    sentence_length: sentence.length,
    has_custom_voice: customWords.has(word),
  });
}

btnSay.addEventListener('click', async () => {
  if (sentence.length === 0) return;
  const phrase = sentence.map((s) => s.word).join(' ');
  window.SP.event('aac_phrase_say', { phrase, length: sentence.length });
  await speakPhrase(sentence.map((s) => s.word));
});

btnClear.addEventListener('click', () => {
  sentence = [];
  renderStrip();
  window.SP.event('aac_clear', {});
});

// ─── Record mode toggle ─────────────────────────────────
function setRecordMode(on) {
  recordMode = on;
  modeToggle.classList.toggle('aac-mode-btn-active', on);
  modeBanner.hidden = !on;
  titleEl.textContent = on ? 'Запись голоса' : 'Голос';
  renderGrid();
  window.SP.event('aac_mode_change', { record: on });
}

modeToggle.addEventListener('click', () => {
  if (!window.SP.voice || !window.SP.voice.isSupported()) {
    alert('Запись голоса не поддерживается на этом устройстве/браузере.');
    return;
  }
  setRecordMode(!recordMode);
});

modeBannerClose.addEventListener('click', () => setRecordMode(false));

// ─── Recorder modal ─────────────────────────────────────
const vrModal = document.getElementById('vr-modal');
const vrBackdrop = document.getElementById('vr-backdrop');
const vrClose = document.getElementById('vr-close');
const vrCardIcon = document.getElementById('vr-card-icon');
const vrCardLabel = document.getElementById('vr-card-label');
const vrStatus = document.getElementById('vr-status');
const vrRecord = document.getElementById('vr-record');
const vrPlay = document.getElementById('vr-play');
const vrDelete = document.getElementById('vr-delete');

let vrWord = null;
let vrIcon = null;
let lastRecordedBlob = null;

function setStatus(text, cls) {
  vrStatus.className = 'vr-status' + (cls ? ' ' + cls : '');
  vrStatus.textContent = text;
}

async function openRecorder(word, icon, categoryId) {
  vrWord = word;
  vrIcon = icon;
  lastRecordedBlob = null;
  vrCardIcon.textContent = icon;
  vrCardLabel.textContent = word;
  vrModal.hidden = false;
  const existing = customWords.has(word);
  if (existing) {
    setStatus('Запись есть — можно прослушать или перезаписать', 'vr-status-saved');
    vrPlay.hidden = false;
    vrDelete.hidden = false;
  } else {
    setStatus('Удерживайте кнопку — говорите слово');
    vrPlay.hidden = true;
    vrDelete.hidden = true;
  }
  window.SP.event('voice_modal_open', { word, has_existing: existing });
}

function closeRecorder() {
  vrModal.hidden = true;
  if (window.SP.recorder && window.SP.recorder.isRecording()) {
    window.SP.recorder.cancel();
  }
}

vrBackdrop.addEventListener('click', closeRecorder);
vrClose.addEventListener('click', closeRecorder);

let pressing = false;

async function startRecording() {
  if (pressing) return;
  pressing = true;
  try {
    await window.SP.recorder.start();
    setStatus('Запись… отпустите чтобы сохранить', 'vr-status-recording');
    vrRecord.classList.add('vr-record-recording');
    window.SP.event('voice_record_start', { word: vrWord });
  } catch (e) {
    pressing = false;
    if (String(e.message).includes('not_supported')) {
      setStatus('Запись не поддерживается в этом браузере');
    } else {
      setStatus('Нужен доступ к микрофону');
    }
    window.SP.event('voice_record_error', { word: vrWord, error: String(e.message || e) });
  }
}

async function finishRecording() {
  if (!pressing) return;
  pressing = false;
  vrRecord.classList.remove('vr-record-recording');
  try {
    const { blob, durationMs } = await window.SP.recorder.stop();
    if (durationMs < 300) {
      setStatus('Слишком коротко — попробуйте ещё раз');
      window.SP.event('voice_record_too_short', { word: vrWord, duration_ms: durationMs });
      return;
    }
    lastRecordedBlob = blob;
    await window.SP.voice.put(vrWord, blob, durationMs);
    window.SP.voice.invalidate(vrWord);
    customWords.add(vrWord);
    renderGrid();
    setStatus('Готово! Запись сохранена', 'vr-status-saved');
    vrPlay.hidden = false;
    vrDelete.hidden = false;
    window.SP.event('voice_record_save', { word: vrWord, duration_ms: durationMs, size: blob.size });
  } catch (e) {
    setStatus('Не удалось сохранить — попробуйте ещё раз');
    window.SP.event('voice_record_error', { word: vrWord, error: String(e.message || e) });
  }
}

// Press-and-hold для записи
vrRecord.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  startRecording();
});
vrRecord.addEventListener('pointerup', (e) => {
  e.preventDefault();
  finishRecording();
});
vrRecord.addEventListener('pointercancel', () => {
  if (pressing) {
    pressing = false;
    vrRecord.classList.remove('vr-record-recording');
    window.SP.recorder.cancel();
  }
});
vrRecord.addEventListener('pointerleave', () => {
  if (pressing) finishRecording();
});

vrPlay.addEventListener('click', () => {
  window.SP.voice.play(vrWord);
  window.SP.event('voice_record_play', { word: vrWord });
});

vrDelete.addEventListener('click', async () => {
  await window.SP.voice.remove(vrWord);
  window.SP.voice.invalidate(vrWord);
  customWords.delete(vrWord);
  renderGrid();
  setStatus('Запись удалена. Можно записать заново');
  vrPlay.hidden = true;
  vrDelete.hidden = true;
  window.SP.event('voice_record_delete', { word: vrWord });
});

// ─── Init ───────────────────────────────────────────────
(async function init() {
  await loadVocabulary();
  await refreshCustomWords();
  renderTabs();
  renderGrid();
  renderStrip();
  window.SP.event('aac_open', {
    categories: categories.length,
    custom_words: customWords.size,
    voice_supported: window.SP.voice && window.SP.voice.isSupported(),
  });
})();
