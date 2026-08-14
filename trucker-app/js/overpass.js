/* RouteRig Overpass API client (live OpenStreetMap data) */
(function (global) {
  'use strict';
  const RR = (global.RR = global.RR || {});
  const { CONFIG, geo, util } = RR;

  const cache = new Map(); // query -> elements
  const CACHE_MAX = 40;

  function cacheKeyFor(q) {
    let h = 5381;
    for (let i = 0; i < q.length; i++) h = ((h << 5) + h + q.charCodeAt(i)) >>> 0;
    return 'q' + h.toString(36);
  }

  async function rawQuery(q) {
    const key = cacheKeyFor(q);
    if (cache.has(key)) return cache.get(key);

    let lastErr = null;
    for (const endpoint of CONFIG.overpassEndpoints) {
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), CONFIG.overpassTimeout);
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: 'data=' + encodeURIComponent(q),
          signal: ctrl.signal
        });
        clearTimeout(timer);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const json = await res.json();
        const els = (json.elements || []);
        if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
        cache.set(key, els);
        return els;
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr || new Error('Overpass unavailable');
  }

  function buildQuery(parts) {
    const body = [];
    const filters = parts.filters || [];
    for (const f of filters) {
      if (parts.bboxes && parts.bboxes.length) {
        for (const bb of parts.bboxes) body.push(f + '(' + geo.bboxString(bb) + ');');
      }
      if (parts.around) {
        body.push(f + '(around:' + Math.round(parts.around.r) + ',' + parts.around.lat.toFixed(5) + ',' + parts.around.lng.toFixed(5) + ');');
      }
    }
    return '[out:json][timeout:45];(' + body.join('\n') + ');out ' + (parts.out || 'center tags') + ';';
  }

  function dedupe(elements) {
    const seen = new Set();
    const out = [];
    for (const el of elements) {
      const k = el.type + '/' + el.id;
      if (!seen.has(k)) { seen.add(k); out.push(el); }
    }
    return out;
  }

  /* run filters against bboxes along a polyline (corridor) */
  async function corridorQuery(filters, coords, out, maxDiagKm, marginM) {
    const bboxes = geo.chunkBboxes(coords, maxDiagKm || 100, marginM || 1500);
    if (!bboxes.length) return [];
    const q = buildQuery({ filters: filters, bboxes: bboxes, out: out || 'center tags' });
    const els = await rawQuery(q);
    return dedupe(els);
  }

  /* run filters around a point */
  async function aroundQuery(filters, lat, lng, radiusM, out) {
    const q = buildQuery({ filters: filters, around: { lat: lat, lng: lng, r: radiusM }, out: out || 'center tags' });
    return dedupe(await rawQuery(q));
  }

  const F = {
    fuel: 'nwr["amenity"="fuel"]',
    weighBridge: 'nwr["amenity"="weighbridge"]',
    weighNamed: 'nwr["name"~"weigh station",i]',
    clearanceHeight: 'way["maxheight"]',
    clearanceHeightPhys: 'way["maxheight:physical"]',
    clearanceWeight: 'way["maxweight"]',
    clearanceWeightPhys: 'way["maxweight:physical"]',
    shopRepair: 'nwr["shop"~"^(truck_repair|car_repair|tyres|truck|trailer|car_parts)$"]',
    truckParking: 'nwr["amenity"="truck_parking"]'
  };

  const overpass = { rawQuery, buildQuery, corridorQuery, aroundQuery, filters: F };
  RR.overpass = overpass;
  if (typeof module !== 'undefined' && module.exports) module.exports = overpass;
})(typeof window !== 'undefined' ? window : globalThis);
