window.SP = window.SP || {};
const __sessionId = Math.random().toString(36).slice(2);
window.SP.event = function (event, data) {
  try {
    fetch('/api/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event,
        session_id: __sessionId,
        user_id: (window.SP.user && window.SP.user.id) || null,
        data: data || {},
      }),
    }).catch(() => {});
  } catch (_) {}
};
