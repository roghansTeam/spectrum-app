/**
 * IndexedDB wrapper для хранения audio blobs голосовых записей AAC карточек.
 * Key: word (русское слово карточки). Value: { blob: Blob, ts: ISO, duration_ms }.
 */
window.SP = window.SP || {};

(function () {
  const DB_NAME = 'spectrum_voice';
  const DB_VERSION = 1;
  const STORE = 'recordings';

  let dbPromise = null;

  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'word' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  async function put(word, blob, durationMs) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      const req = store.put({
        word,
        blob,
        ts: new Date().toISOString(),
        duration_ms: durationMs || null,
      });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async function get(word) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(word);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async function remove(word) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const req = tx.objectStore(STORE).delete(word);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async function listWords() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).getAllKeys();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async function clear() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const req = tx.objectStore(STORE).clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // Audio playback wrapper. Cache URLs чтобы не утечь memory.
  const urlCache = new Map();
  let currentAudio = null;

  async function play(word) {
    const record = await get(word);
    if (!record || !record.blob) return false;
    let url = urlCache.get(word);
    if (!url) {
      url = URL.createObjectURL(record.blob);
      urlCache.set(word, url);
    }
    if (currentAudio) {
      currentAudio.pause();
      currentAudio = null;
    }
    const audio = new Audio(url);
    currentAudio = audio;
    try {
      await audio.play();
      return true;
    } catch (e) {
      return false;
    }
  }

  function invalidate(word) {
    const url = urlCache.get(word);
    if (url) {
      URL.revokeObjectURL(url);
      urlCache.delete(word);
    }
  }

  window.SP.voice = {
    put,
    get,
    remove,
    listWords,
    clear,
    play,
    invalidate,
    isSupported: () => !!(window.indexedDB && window.MediaRecorder),
  };
})();
