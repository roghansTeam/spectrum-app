/**
 * Bug-report floating action button + modal.
 * Always available, never intrusive (low-opacity FAB until hovered).
 */
(function () {
  if (window.__sp_bugreport_inited__) return;
  window.__sp_bugreport_inited__ = true;

  // FAB
  const fab = document.createElement('button');
  fab.className = 'sp-bug-fab';
  fab.setAttribute('aria-label', 'Сообщить о проблеме');
  fab.title = 'Сообщить о проблеме';
  fab.textContent = '🐞';

  // Modal
  const modal = document.createElement('div');
  modal.className = 'sp-bug-modal';
  modal.hidden = true;
  modal.innerHTML =
    '<div class="sp-bug-backdrop"></div>' +
    '<div class="sp-bug-panel">' +
      '<button class="sp-bug-close" aria-label="Закрыть">×</button>' +
      '<h2 class="sp-bug-title">Что не работает?</h2>' +
      '<p class="sp-bug-sub">Опишите проблему — что вы сделали и что произошло.</p>' +
      '<textarea class="sp-bug-textarea" maxlength="1000" rows="5" placeholder="например: открыл «День», нажал «+ Свой распорядок», и ничего не происходит"></textarea>' +
      '<p class="sp-bug-privacy">Отправляется только текст + URL страницы. Никаких личных данных.</p>' +
      '<div class="sp-bug-actions">' +
        '<button class="sp-bug-btn sp-bug-btn-secondary sp-bug-cancel">Отмена</button>' +
        '<button class="sp-bug-btn sp-bug-btn-primary sp-bug-send">Отправить</button>' +
      '</div>' +
      '<div class="sp-bug-status" hidden></div>' +
    '</div>';

  const toast = document.createElement('div');
  toast.className = 'sp-bug-toast';
  toast.hidden = true;

  function attach() {
    document.body.appendChild(fab);
    document.body.appendChild(modal);
    document.body.appendChild(toast);
  }

  if (document.body) attach();
  else document.addEventListener('DOMContentLoaded', attach);

  const get = (sel) => modal.querySelector(sel);

  fab.addEventListener('click', () => {
    modal.hidden = false;
    setTimeout(() => get('.sp-bug-textarea').focus(), 50);
    if (window.SP && window.SP.event) window.SP.event('bug_modal_open', {});
  });

  function close() {
    modal.hidden = true;
    get('.sp-bug-textarea').value = '';
    const st = get('.sp-bug-status');
    st.hidden = true;
    st.textContent = '';
    get('.sp-bug-send').disabled = false;
  }

  modal.addEventListener('click', (e) => {
    if (e.target.classList.contains('sp-bug-backdrop')) close();
  });
  modal.querySelector('.sp-bug-close').addEventListener('click', close);
  modal.querySelector('.sp-bug-cancel').addEventListener('click', close);

  function showToast(msg) {
    toast.textContent = msg;
    toast.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { toast.hidden = true; }, 2800);
  }

  modal.querySelector('.sp-bug-send').addEventListener('click', async () => {
    const ta = get('.sp-bug-textarea');
    const text = ta.value.trim();
    const st = get('.sp-bug-status');
    if (!text) {
      st.hidden = false;
      st.textContent = 'Опишите проблему чтобы я мог помочь.';
      return;
    }
    if (text.length > 1000) {
      st.hidden = false;
      st.textContent = 'Сократите описание (до 1000 символов).';
      return;
    }
    get('.sp-bug-send').disabled = true;
    st.hidden = false;
    st.textContent = 'Отправляю…';
    const payload = {
      text,
      page_url: location.pathname + location.search,
      module: (location.pathname.replace(/^\//, '').split('/')[0] || 'hub'),
      user_agent: navigator.userAgent,
    };
    try {
      const r = await fetch('/api/bug-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await r.json();
      if (!data.ok) throw new Error(data.error || 'unknown');
      if (window.SP && window.SP.event) {
        window.SP.event('bug_submit', { module: payload.module, len: text.length });
      }
      close();
      showToast('Спасибо! Я постараюсь починить.');
    } catch (e) {
      st.hidden = false;
      st.textContent = 'Не удалось отправить. Проверьте сеть и попробуйте ещё раз.';
      get('.sp-bug-send').disabled = false;
      if (window.SP && window.SP.event) {
        window.SP.event('bug_submit_error', { error: String(e.message || e) });
      }
    }
  });
})();
