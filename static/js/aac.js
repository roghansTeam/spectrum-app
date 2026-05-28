const grid = document.getElementById('grid');
const strip = document.getElementById('strip');
const tabs = document.getElementById('tabs');
const btnSay = document.getElementById('btn-say');
const btnClear = document.getElementById('btn-clear');

let sentence = [];
let categories = [];
let activeCategoryId = null;

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
    card.className = 'aac-card';
    card.innerHTML =
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

function onCardTap(word, icon, categoryId) {
  sentence.push({ word, icon });
  renderStrip();
  window.SP.tts.speak(word);
  window.SP.event('aac_card_tap', {
    word,
    category: categoryId,
    sentence_length: sentence.length,
  });
}

btnSay.addEventListener('click', () => {
  if (sentence.length === 0) return;
  const phrase = sentence.map((s) => s.word).join(' ');
  window.SP.tts.speak(phrase);
  window.SP.event('aac_phrase_say', { phrase, length: sentence.length });
});

btnClear.addEventListener('click', () => {
  sentence = [];
  renderStrip();
  window.SP.event('aac_clear', {});
});

(async function init() {
  await loadVocabulary();
  renderTabs();
  renderGrid();
  renderStrip();
  window.SP.event('aac_open', { categories: categories.length });
})();
