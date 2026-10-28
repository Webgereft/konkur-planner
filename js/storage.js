const DB = {
  get(key, fallback = null) {
    try {
      const v = localStorage.getItem('konkur_' + key);
      return v ? JSON.parse(v) : fallback;
    } catch { return fallback; }
  },
  set(key, value) {
    localStorage.setItem('konkur_' + key, JSON.stringify(value));
  },
  remove(key) {
    localStorage.removeItem('konkur_' + key);
  }
};
