/**
 * MediaRecorder wrapper. Запись 1-3 секунд голоса родителя для AAC карточек.
 * Выбирает лучший доступный mimeType (webm > mp4 > ogg).
 */
window.SP = window.SP || {};

(function () {
  const MIME_CANDIDATES = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4;codecs=mp4a.40.2',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ];

  function pickMime() {
    if (!window.MediaRecorder) return null;
    for (const m of MIME_CANDIDATES) {
      if (MediaRecorder.isTypeSupported(m)) return m;
    }
    return '';
  }

  let stream = null;
  let recorder = null;
  let chunks = [];
  let startedAt = 0;

  async function start() {
    if (!navigator.mediaDevices || !window.MediaRecorder) {
      throw new Error('not_supported');
    }
    if (!stream) {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    }
    const mime = pickMime();
    chunks = [];
    recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };
    startedAt = performance.now();
    recorder.start();
  }

  function stop() {
    return new Promise((resolve, reject) => {
      if (!recorder) {
        reject(new Error('not_recording'));
        return;
      }
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
        const durationMs = Math.round(performance.now() - startedAt);
        recorder = null;
        chunks = [];
        resolve({ blob, durationMs });
      };
      try {
        recorder.stop();
      } catch (e) {
        reject(e);
      }
    });
  }

  function cancel() {
    if (recorder) {
      try { recorder.stop(); } catch (_) {}
      recorder = null;
    }
    chunks = [];
  }

  function release() {
    cancel();
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
    }
  }

  function isRecording() {
    return !!(recorder && recorder.state === 'recording');
  }

  window.SP.recorder = {
    start,
    stop,
    cancel,
    release,
    isRecording,
    isSupported: () => !!(navigator.mediaDevices && window.MediaRecorder),
  };
})();
