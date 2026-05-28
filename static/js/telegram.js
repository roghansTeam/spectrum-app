(function () {
  const tg = window.Telegram && window.Telegram.WebApp;
  if (tg) {
    tg.ready();
    tg.expand();
    if (tg.disableVerticalSwipes) tg.disableVerticalSwipes();
  }
  window.SP = window.SP || {};
  window.SP.tg = tg;
  window.SP.user = tg && tg.initDataUnsafe && tg.initDataUnsafe.user;
})();
