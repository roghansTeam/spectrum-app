/**
 * First-visit guided tour on the hub.
 * Shows up to ~5 lightweight overlays pointing at hub tiles + intro,
 * dismissable at any step, runs at most once (localStorage flag).
 *
 * Non-intrusive: triggered ONLY after sensory onboarding is done OR
 * if user explicitly clicks the 'Знакомство' banner. Skip-everywhere.
 */
(function () {
  if (!location.pathname.match(/^\/?$/)) return; // hub only
  if (window.__sp_tour_inited__) return;
  window.__sp_tour_inited__ = true;

  const SEEN_KEY = 'spectrum_tour_seen';
  try {
    if (localStorage.getItem(SEEN_KEY) === '1') return;
  } catch (_) {}

  const STEPS = [
    {
      anchor: null,
      title: 'Привет 👋',
      body:
        'Это короткий тур по Спектру — 4 шага, можно пропустить в любой момент.',
    },
    {
      anchorSelector: 'a[href="/aac"]',
      title: 'Голос',
      body:
        'AAC-карточки и фразы. Можно тапать или перетаскивать. Тут же родитель может записать свой голос для каждой карточки.',
    },
    {
      anchorSelector: 'a[href="/day"]',
      title: 'День',
      body:
        '«Сейчас → Потом» и распорядки по шагам. Снижает тревожность переходов. Можно собрать свой распорядок.',
    },
    {
      anchorSelector: 'a[href="/mood"]',
      title: 'Настроение',
      body:
        'Для подростков ASD Level 1: цветовые зоны, триггеры, что помогает. Все записи остаются на устройстве.',
    },
    {
      anchorSelector: 'a[href="/parent"]',
      title: 'Родителю',
      body:
        'Совет дня по методу Hanen, mindfulness 3–5 мин с голосом, и прогресс ребёнка по модулям.',
    },
  ];

  // Postpone until DOM ready
  function start() {
    let idx = 0;

    const backdrop = document.createElement('div');
    backdrop.className = 'sp-tour-backdrop';

    const card = document.createElement('div');
    card.className = 'sp-tour-card';
    card.innerHTML =
      '<div class="sp-tour-step"></div>' +
      '<h2 class="sp-tour-title"></h2>' +
      '<p class="sp-tour-body"></p>' +
      '<div class="sp-tour-actions">' +
        '<button class="sp-tour-skip">Пропустить</button>' +
        '<button class="sp-tour-next">Дальше</button>' +
      '</div>';

    document.body.appendChild(backdrop);
    document.body.appendChild(card);

    const stepEl = card.querySelector('.sp-tour-step');
    const titleEl = card.querySelector('.sp-tour-title');
    const bodyEl = card.querySelector('.sp-tour-body');
    const nextBtn = card.querySelector('.sp-tour-next');
    const skipBtn = card.querySelector('.sp-tour-skip');

    function clearHighlights() {
      document.querySelectorAll('.sp-tour-highlight').forEach((el) => {
        el.classList.remove('sp-tour-highlight');
      });
    }

    function show(i) {
      clearHighlights();
      const step = STEPS[i];
      if (!step) return finish();
      stepEl.textContent = `${i + 1} / ${STEPS.length}`;
      titleEl.textContent = step.title;
      bodyEl.textContent = step.body;
      nextBtn.textContent = i === STEPS.length - 1 ? 'Готово' : 'Дальше';
      if (step.anchorSelector) {
        const target = document.querySelector(step.anchorSelector);
        if (target) {
          target.classList.add('sp-tour-highlight');
          target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
      if (window.SP && window.SP.event) {
        window.SP.event('tour_step', { idx: i, title: step.title });
      }
    }

    function finish() {
      try { localStorage.setItem(SEEN_KEY, '1'); } catch (_) {}
      clearHighlights();
      backdrop.remove();
      card.remove();
      if (window.SP && window.SP.event) {
        window.SP.event('tour_finish', { last_idx: idx });
      }
    }

    function skip() {
      try { localStorage.setItem(SEEN_KEY, '1'); } catch (_) {}
      clearHighlights();
      backdrop.remove();
      card.remove();
      if (window.SP && window.SP.event) {
        window.SP.event('tour_skip', { at_idx: idx });
      }
    }

    nextBtn.addEventListener('click', () => {
      idx += 1;
      if (idx >= STEPS.length) finish();
      else show(idx);
    });
    skipBtn.addEventListener('click', skip);
    backdrop.addEventListener('click', skip);

    show(0);
    if (window.SP && window.SP.event) {
      window.SP.event('tour_start', { total: STEPS.length });
    }
  }

  // Wait until SP.event is ready + hub tiles rendered
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(start, 500));
  } else {
    setTimeout(start, 500);
  }
})();
