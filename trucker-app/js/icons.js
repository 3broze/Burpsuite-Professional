/* RouteRig map icons (inline SVG divIcons) */
(function (global) {
  'use strict';
  const L = global.L;
  const RR = (global.RR = global.RR || {});

  function pin(emoji, color, size) {
    const s = size || 30;
    const h = s * 1.4;
    return `<svg width="${s}" height="${h}" viewBox="0 0 ${s} ${h}" class="rr-pin" xmlns="http://www.w3.org/2000/svg">
      <path d="M${s / 2} 1 C ${s / 5.5} 1 2 ${s / 6.2} 2 ${s / 2.15} C 2 ${s / 1.35} ${s / 2} ${h - 1} ${s / 2} ${h - 1} C ${s / 2} ${h - 1} ${s - 2} ${s / 1.35} ${s - 2} ${s / 2.15} C ${s - 2} ${s / 6.2} ${s / 1.22} 1 ${s / 2} 1 Z"
        fill="${color}" stroke="#0d1117" stroke-width="1.6"/>
      <text x="${s / 2}" y="${s / 2 + s * 0.14}" font-size="${s * 0.42}" text-anchor="middle">${emoji}</text>
    </svg>`;
  }

  function marker(html, s) {
    s = s || 30;
    const h = s * 1.4;
    return L.divIcon({
      className: 'rr-marker',
      html: html,
      iconSize: [s, h],
      iconAnchor: [s / 2, h - 2],
      popupAnchor: [0, -h + 4]
    });
  }

  function circleIcon(emoji, color, s) {
    s = s || 26;
    return L.divIcon({
      className: 'rr-marker',
      html: `<div style="width:${s}px;height:${s}px;border-radius:50%;background:${color};border:2.5px solid #0d1117;display:flex;align-items:center;justify-content:center;font-size:${s * 0.5}px;box-shadow:0 2px 6px rgba(0,0,0,.5)">${emoji}</div>`,
      iconSize: [s, s],
      iconAnchor: [s / 2, s / 2],
      popupAnchor: [0, -s / 2 - 2]
    });
  }

  const icons = {
    fuel: (opts) => marker(pin('⛽', '#ff8c1a'), (opts && opts.size) || 30),
    weigh: (opts) => marker(pin('⚖️', '#d4a72c'), (opts && opts.size) || 30),
    clearance: (opts) => marker(pin('⚠️', '#f85149'), (opts && opts.size) || 30),
    shop: (opts) => marker(pin('🔧', '#58a6ff'), (opts && opts.size) || 30),
    start: () => circleIcon('A', '#2ea44f'),
    end: () => circleIcon('B', '#f85149'),
    gps: () => L.divIcon({
      className: 'rr-marker',
      html: `<div style="width:18px;height:18px;border-radius:50%;background:#58a6ff;border:3px solid #fff;box-shadow:0 0 0 4px rgba(88,166,255,.35), 0 0 12px rgba(88,166,255,.8)"></div>`,
      iconSize: [18, 18],
      iconAnchor: [9, 9]
    }),
    /* rotatable truck marker (points north at 0deg) */
    truck: () => L.divIcon({
      className: 'rr-marker',
      html: `<div id="truck-marker-html" style="transform:rotate(0deg)">
        <svg width="46" height="46" viewBox="-23 -23 46 46" xmlns="http://www.w3.org/2000/svg">
          <circle cx="0" cy="0" r="21" fill="rgba(255,140,26,.25)" stroke="#ff8c1a" stroke-width="1.5" stroke-dasharray="4 3"/>
          <rect x="-11" y="-16" width="22" height="32" rx="5" fill="#ff8c1a" stroke="#0d1117" stroke-width="2.5"/>
          <rect x="-8.5" y="-12" width="17" height="7" rx="2" fill="#161b22" opacity=".55"/>
          <rect x="-4.5" y="-15" width="9" height="3" rx="1" fill="#161b22" opacity=".55"/>
          <circle cx="-8" cy="18" r="4" fill="#0d1117"/><circle cx="-8" cy="18" r="1.8" fill="#8b98a9"/>
          <circle cx="8" cy="18" r="4" fill="#0d1117"/><circle cx="8" cy="18" r="1.8" fill="#8b98a9"/>
          <circle cx="-8" cy="-18" r="4" fill="#0d1117"/><circle cx="-8" cy="-18" r="1.8" fill="#8b98a9"/>
          <circle cx="8" cy="-18" r="4" fill="#0d1117"/><circle cx="8" cy="-18" r="1.8" fill="#8b98a9"/>
        </svg>
      </div>`,
      iconSize: [46, 46],
      iconAnchor: [23, 23]
    }),
    clusterIcon: function (cluster) {
      const n = cluster.getChildCount();
      const size = n < 10 ? 34 : n < 50 ? 42 : 50;
      return L.divIcon({
        className: 'rr-marker',
        html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:#ff8c1a;color:#16130c;display:flex;align-items:center;justify-content:center;font-weight:800;font-family:Barlow,sans-serif;font-size:${size * 0.42}px;border:3px solid #0d1117;box-shadow:0 3px 8px rgba(0,0,0,.55)">${n}</div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2]
      });
    }
  };

  RR.icons = icons;
})(typeof window !== 'undefined' ? window : globalThis);
