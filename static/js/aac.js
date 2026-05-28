const VOCAB = [
  { word: 'я',      icon: '🧒' },
  { word: 'хочу',   icon: '🤲' },
  { word: 'ещё',    icon: '➕' },
  { word: 'помоги', icon: '🆘' },
  { word: 'да',     icon: '✅' },
  { word: 'нет',    icon: '❌' },
  { word: 'играть', icon: '🎲' },
  { word: 'кушать', icon: '🍎' },
  { word: 'пить',   icon: '🥛' },
  { word: 'мама',   icon: '👩' },
  { word: 'папа',   icon: '👨' },
  { word: 'спать',  icon: '🛏️' },
];

const grid = document.getElementById('grid');
const strip = document.getElementById('strip');
const btnSay = document.getElementById('btn-say');
const btnClear = document.getElementById('btn-clear');

let sentence = [];

function renderGrid() {
  grid.innerHTML = '';
  VOCAB.forEach(({ word, icon }) => {
    const card = document.createElement('button');
    card.className = 'aac-card';
    card.innerHTML =
      '<span class="aac-card-icon">' + icon + '</span>' +
      '<span class="aac-card-label">' + word + '</span>';
    card.addEventListener('click', () => onCardTap(word, icon));
    grid.appendChild(card);
  });
}

function renderStrip() {
  if (sentence.length === 0) {
    strip.innerHTML = '<span class="aac-strip-empty">Выбери карточки</span>';
    return;
  }
  strip.innerHTML = sentence.map(({ word, icon }) =>
    '<div class="aac-strip-card">' +
      '<span class="aac-strip-card-icon">' + icon + '</span>' +
      '<span>' + word + '</span>' +
    '</div>'
  ).join('');
}

function onCardTap(word, icon) {
  sentence.push({ word, icon });
  renderStrip();
  window.SP.tts.speak(word);
  window.SP.event('aac_card_tap', { word, sentence_length: sentence.length });
}

btnSay.addEventListener('click', () => {
  if (sentence.length === 0) return;
  const phrase = sentence.map(s => s.word).join(' ');
  window.SP.tts.speak(phrase);
  window.SP.event('aac_phrase_say', { phrase, length: sentence.length });
});

btnClear.addEventListener('click', () => {
  sentence = [];
  renderStrip();
  window.SP.event('aac_clear', {});
});

renderGrid();
renderStrip();
window.SP.event('aac_open', {});
