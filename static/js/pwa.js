/**
 * PWA bootstrap: registers service worker, surfaces install prompt
 * via window.SP.pwa.canInstall() and window.SP.pwa.install().
 */
window.SP = window.SP || {};
window.SP.pwa = window.SP.pwa || {};

(function () {
  let deferredPrompt = null;
  let installed = false;

  function isStandalone() {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true
    );
  }

  window.SP.pwa.isStandalone = isStandalone;
  window.SP.pwa.canInstall = () => !!deferredPrompt && !installed;
  window.SP.pwa.install = async function () {
    if (!deferredPrompt) return { outcome: 'unavailable' };
    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    deferredPrompt = null;
    return choice;
  };

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    window.dispatchEvent(new Event('sp:pwa-install-available'));
  });

  window.addEventListener('appinstalled', () => {
    installed = true;
    deferredPrompt = null;
    if (window.SP.event) window.SP.event('pwa_installed', {});
    window.dispatchEvent(new Event('sp:pwa-installed'));
  });

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((reg) => {
          if (reg.waiting) {
            reg.waiting.postMessage('SKIP_WAITING');
          }
          reg.addEventListener('updatefound', () => {
            const installing = reg.installing;
            if (!installing) return;
            installing.addEventListener('statechange', () => {
              if (
                installing.state === 'installed' &&
                navigator.serviceWorker.controller
              ) {
                installing.postMessage('SKIP_WAITING');
              }
            });
          });
        })
        .catch((err) => {
          console.warn('SW registration failed:', err);
        });
    });
  }
})();
