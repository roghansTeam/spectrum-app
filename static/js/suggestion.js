/**
 * Suggestion / contact floating action button + modal.
 * Stacked above the bug-report FAB. Different purpose:
 * - 🐞 bug = что не работает
 * - 💡 suggestion = идея / вопрос / обращение, опционально с contact
 */
(function () {
  if (window.__sp_suggestion_inited__) return;
  window.__sp_suggestion_inited__ = true;

  const fab = document.createElement('button');
  fab.className = 'sp-sg-fab';
  fab.setAttribute('aria-label', 'Идея или обращение');
  fab.title = 'Идея или обращение';
  fab.textContent = '💡';

  const modal = document.createElement('div');
  modal.className = 'sp-sg-modal';
  modal.hidden = true;
  modal.innerHTML =
    '<div class="sp-sg-backdrop"></div>' +
    '<div class="sp-sg-panel">' +
      '<button class="sp-sg-close" aria-label="Закрыть">×</button>' +
      '<h2 class="sp-sg-title">Идея или обращение</h2>' +
      '<p class="sp-sg-sub">Предложение, вопрос, обратная связь. Спасибо!</p>' +
      '<textarea class="sp-sg-textarea" maxlength="2000" rows="5" placeholder="например: хорошо бы добавить категорию слов про спорт"></textarea>' +
      '<label class="sp-sg-contact-label">' +
        '<span>Как с вами связаться (необязательно)</span>' +
        '<input type="text" class="sp-sg-contact" maxlength="100" placeholder="@telegram, email или ничего">' +
      '</label>' +
      '<p class="sp-sg-privacy">Контакт нужен только если хотите ответ. Не передаётся третьим лицам.</p>' +
      '<div class="sp-sg-actions">' +
        '<button class="sp-sg-btn sp-sg-btn-secondary sp-sg-cancel">Отмена</button>' +
        '<button class="sp-sg-btn sp-sg-btn-primary sp-sg-send">Отправить</button>' +
      '</div>' +
      '<div class="sp-sg-status" hidden></div>' +
    '</div>';

  const toast = document.createElement('div');
  toast.className = 'sp-sg-toast';
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
    setTimeout(() => get('.sp-sg-textarea').focus(), 50);
    if (window.SP && window.SP.event) window.SP.event('suggestion_modal_open', {});
  });

  function close() {
    modal.hidden = true;
    get('.sp-sg-textarea').value = '';
    get('.sp-sg-contact').value = '';
    const st = get('.sp-sg-status');
    st.hidden = true;
    st.textContent = '';
    get('.sp-sg-send').disabled = false;
  }

  modal.addEventListener('click', (e) => {
    if (e.target.classList.contains('sp-sg-backdrop')) close();
  });
  modal.querySelector('.sp-sg-close').addEventListener('click', close);
  modal.querySelector('.sp-sg-cancel').addEventListener('click', close);

  function showToast(msg) {
    toast.textContent = msg;
    toast.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { toast.hidden = true; }, 2800);
  }

  modal.querySelector('.sp-sg-send').addEventListener('click', async () => {
    const ta = get('.sp-sg-textarea');
    const contactInput = get('.sp-sg-contact');
    const text = ta.value.trim();
    const contact = contactInput.value.trim();
    const st = get('.sp-sg-status');
    if (!text) {
      st.hidden = false;
      st.textContent = 'Напишите идею или вопрос.';
      return;
    }
    get('.sp-sg-send').disabled = true;
    st.hidden = false;
    st.textContent = 'Отправляю…';
    const payload = {
      text,
      contact,
      page_url: location.pathname + location.search,
      module: (location.pathname.replace(/^\//, '').split('/')[0] || 'hub'),
      user_agent: navigator.userAgent,
    };
    try {
      const r = await fetch('/api/suggestion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await r.json();
      if (!data.ok) throw new Error(data.error || 'unknown');
      if (window.SP && window.SP.event) {
        window.SP.event('suggestion_submit', {
          module: payload.module,
          len: text.length,
          has_contact: !!contact,
        });
      }
      close();
      showToast('Спасибо! Получил, посмотрю.');
    } catch (e) {
      st.hidden = false;
      st.textContent = 'Не удалось отправить. Попробуйте ещё раз.';
      get('.sp-sg-send').disabled = false;
      if (window.SP && window.SP.event) {
        window.SP.event('suggestion_submit_error', { error: String(e.message || e) });
      }
    }
  });
})();
