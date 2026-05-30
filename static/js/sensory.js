/**
 * Reads sensory profile from localStorage and applies a class to <html>
 * so CSS in tokens.css can adapt UI intensity (motion, contrast, sizes).
 *
 * Must run *before* first paint to avoid flicker — keep this tiny.
 */
(function () {
  try {
    const raw = localStorage.getItem('spectrum_sensory_profile');
    if (!raw) return;
    const p = JSON.parse(raw);
    const d = p && p.dominant;
    if (!d) return;
    const valid = ['hyper', 'hypo', 'seeking', 'mixed'];
    if (!valid.includes(d)) return;
    document.documentElement.classList.add('sp-profile-' + d);
  } catch (_) {}
})();

window.SP = window.SP || {};
window.SP.sensory = {
  getProfile() {
    try {
      const raw = localStorage.getItem('spectrum_sensory_profile');
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  },
  setOverride(dominant) {
    const cur = window.SP.sensory.getProfile() || {};
    cur.dominant = dominant;
    cur.override = true;
    cur.override_at = new Date().toISOString();
    try {
      localStorage.setItem('spectrum_sensory_profile', JSON.stringify(cur));
    } catch (_) {}
    document.documentElement.classList.remove(
      'sp-profile-hyper',
      'sp-profile-hypo',
      'sp-profile-seeking',
      'sp-profile-mixed'
    );
    document.documentElement.classList.add('sp-profile-' + dominant);
    if (window.SP.event) {
      window.SP.event('sensory_override', { dominant });
    }
  },
};
