window.SP = window.SP || {};
window.SP.tts = {
  speak(text) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ru-RU';
    u.rate = 0.9;
    u.pitch = 1.0;
    window.speechSynthesis.speak(u);
  },
};
