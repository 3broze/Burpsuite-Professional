/* RouteRig utilities: hashing, formatting, storage */
(function (global) {
  'use strict';

  /* FNV-1a 32-bit string hash -> [0,1) */
  function hash01(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return (h >>> 0) / 4294967296;
  }

  function hashInt(str, mod) {
    return Math.floor(hash01(str) * mod);
  }

  function pick(arr, str, idx) {
    return arr[Math.floor((hash01(str + ':' + (idx || 0)) * arr.length)) % arr.length];
  }

  /* ---------- formatting ---------- */
  function fmtDistMeters(m) {
    if (m == null || isNaN(m)) return '—';
    if (m < 160) return Math.round(m) + ' ft';
    const mi = m / 1609.344;
    if (mi < 10) return mi.toFixed(1) + ' mi';
    return Math.round(mi).toLocaleString() + ' mi';
  }

  function fmtMi(mi) {
    if (mi == null || isNaN(mi)) return '—';
    if (mi < 0.1) return Math.round(mi * 5280) + ' ft';
    if (mi < 10) return mi.toFixed(1) + ' mi';
    return Math.round(mi).toLocaleString() + ' mi';
  }

  function fmtClock(sec) {
    if (sec == null || isNaN(sec)) return '—';
    sec = Math.round(sec);
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
    if (h > 0) return h + 'h ' + m + 'm';
    if (m > 0) return m + 'm';
    return sec + 's';
  }

  function fmtPrice(p) {
    if (p == null || isNaN(p)) return '—';
    return '$' + p.toFixed(2);
  }

  function fmtMoney(p) {
    return '$' + Math.round(p).toLocaleString();
  }

  function fmtGal(g) {
    return g == null ? '—' : Math.round(g) + ' gal';
  }

  function fmtHeightM(m) {
    if (m == null) return '—';
    const inch = m / 0.0254;
    const ft = Math.floor(inch / 12), inn = Math.round(inch % 12);
    return ft + '\'' + inn + '"';
  }

  function fmtWeightLb(lb) {
    if (lb == null) return '—';
    if (lb >= 2000) return (lb / 2000).toFixed(1) + ' tons';
    return Math.round(lb) + ' lb';
  }

  function headingCardinal(deg) {
    const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    return dirs[Math.round(((deg % 360) + 360) % 360 / 22.5) % 16];
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function timeHHMM(d) {
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }

  /* ---------- storage ---------- */
  const store = {
    get(key, fallback) {
      try {
        const v = localStorage.getItem('rr:' + key);
        return v == null ? fallback : JSON.parse(v);
      } catch (e) { return fallback; }
    },
    set(key, val) {
      try { localStorage.setItem('rr:' + key, JSON.stringify(val)); } catch (e) { /* full/private */ }
    },
    remove(key) {
      try { localStorage.removeItem('rr:' + key); } catch (e) { /* noop */ }
    }
  };

  const util = { hash01, hashInt, pick, fmtDistMeters, fmtMi, fmtClock, fmtPrice, fmtMoney, fmtGal, fmtHeightM, fmtWeightLb, headingCardinal, esc, timeHHMM, store };
  global.RR = global.RR || {};
  global.RR.util = util;
  if (typeof module !== 'undefined' && module.exports) module.exports = util;
})(typeof window !== 'undefined' ? window : globalThis);
