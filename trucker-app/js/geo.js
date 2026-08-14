/* RouteRig geo math & OSM tag parsing */
(function (global) {
  'use strict';
  const R = 6371000; // earth radius m
  const DEG2M = 111195; // approx meters per degree latitude

  function toRad(d) { return d * Math.PI / 180; }
  function toDeg(r) { return r * 180 / Math.PI; }

  function haversineM(a, b) {
    const dLat = toRad(b[0] - a[0]);
    const dLng = toRad(b[1] - a[1]);
    const s = Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
  }

  function bearingDeg(a, b) {
    const y = Math.sin(toRad(b[1] - a[1])) * Math.cos(toRad(b[0]));
    const x = Math.cos(toRad(a[0])) * Math.sin(toRad(b[0])) -
      Math.sin(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.cos(toRad(b[1] - a[1]));
    return (toDeg(Math.atan2(y, x)) + 360) % 360;
  }

  /* flat local projection scaled by latitude (fine for short segments) */
  function _xy(p) { return [p[1] * Math.cos(toRad(p[0])), p[0]]; }

  /* perpendicular distance from point p to segment a-b, meters */
  function distToSegmentM(p, a, b) {
    const A = _xy(a), B = _xy(b), P = _xy(p);
    const dx = B[0] - A[0], dy = B[1] - A[1];
    const len2 = dx * dx + dy * dy;
    let t = len2 === 0 ? 0 : ((P[0] - A[0]) * dx + (P[1] - A[1]) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const qx = A[0] + t * dx, qy = A[1] + t * dy;
    const ddx = P[0] - qx, ddy = P[1] - qy;
    return Math.sqrt(ddx * ddx + ddy * ddy) * DEG2M;
  }

  /* cumulative distance along a polyline */
  function cumulative(coords) {
    const cum = new Array(coords.length);
    cum[0] = 0;
    for (let i = 1; i < coords.length; i++) cum[i] = cum[i - 1] + haversineM(coords[i - 1], coords[i]);
    return cum;
  }

  /**
   * Project a point onto a polyline.
   * Returns { index, alongM, crossM, lat, lng, bearingDeg }
   */
  function projectOnLine(pos, coords, cum) {
    const n = coords.length;
    if (!n) return null;
    const stride = Math.max(1, Math.floor(n / 6000)); // keep O(n) bounded
    let bestI = 0, bestT = 0, bestD = Infinity, bestSeg = [coords[0], coords[1] || coords[0]];
    for (let i = 0; i + 1 < n; i += stride) {
      const a = coords[i], b = coords[i + 1];
      const A = _xy(a), B = _xy(b), P = _xy(pos);
      const dx = B[0] - A[0], dy = B[1] - A[1];
      const len2 = dx * dx + dy * dy;
      let t = len2 === 0 ? 0 : ((P[0] - A[0]) * dx + (P[1] - A[1]) * dy) / len2;
      t = Math.max(0, Math.min(1, t));
      const qx = A[0] + t * dx, qy = A[1] + t * dy;
      const ddx = P[0] - qx, ddy = P[1] - qy;
      const d = Math.sqrt(ddx * ddx + ddy * ddy) * DEG2M;
      if (d < bestD) { bestD = d; bestI = i; bestT = t; bestSeg = [a, b]; }
    }
    const segLen = haversineM(bestSeg[0], bestSeg[1]);
    const along = (cum[bestI] || 0) + segLen * bestT;
    const lat = bestSeg[0][0] + (bestSeg[1][0] - bestSeg[0][0]) * bestT;
    const lng = bestSeg[0][1] + (bestSeg[1][1] - bestSeg[0][1]) * bestT;
    return {
      index: bestI, alongM: along, crossM: bestD,
      lat: lat, lng: lng,
      bearingDeg: bestSeg[0][0] === bestSeg[1][0] && bestSeg[0][1] === bestSeg[1][1]
        ? 0 : bearingDeg(bestSeg[0], bestSeg[1])
    };
  }

  /* interpolated point at alongM (meters from start) */
  function pointAtAlong(coords, cum, alongM) {
    if (alongM <= 0) return coords[0];
    for (let i = 1; i < coords.length; i++) {
      if (cum[i] >= alongM) {
        const segLen = cum[i] - cum[i - 1];
        const t = segLen === 0 ? 0 : (alongM - cum[i - 1]) / segLen;
        return [
          coords[i - 1][0] + (coords[i][0] - coords[i - 1][0]) * t,
          coords[i - 1][1] + (coords[i][1] - coords[i - 1][1]) * t
        ];
      }
    }
    return coords[coords.length - 1];
  }

  /* bbox of coordinates [minLat, minLng, maxLat, maxLng] with margin meters */
  function bboxOf(coords, marginM) {
    let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
    for (const c of coords) {
      if (c[0] < minLat) minLat = c[0];
      if (c[0] > maxLat) maxLat = c[0];
      if (c[1] < minLng) minLng = c[1];
      if (c[1] > maxLng) maxLng = c[1];
    }
    const mLat = (marginM || 0) / DEG2M;
    const mLng = (marginM || 0) / (DEG2M * Math.max(0.2, Math.cos(toRad((minLat + maxLat) / 2))));
    return [minLat - mLat, minLng - mLng, maxLat + mLat, maxLng + mLng];
  }

  /* split a polyline into bboxes whose diagonal is <= maxDiagKm (Overpass-friendly) */
  function chunkBboxes(coords, maxDiagKm, marginM) {
    maxDiagKm = maxDiagKm || 110;
    marginM = marginM || 1200;
    const out = [];
    let chunk = [coords[0]];
    for (let i = 1; i < coords.length; i++) {
      chunk.push(coords[i]);
      const bb = bboxOf(chunk, 0);
      const diag = haversineM([bb[0], bb[1]], [bb[2], bb[3]]) / 1000;
      if (diag > maxDiagKm && chunk.length > 2) {
        out.push(bboxOf(chunk.slice(0, -1), marginM));
        chunk = [coords[i - 1], coords[i]];
      }
    }
    out.push(bboxOf(chunk, marginM));
    return out;
  }

  function bboxString(bb) {
    return bb[0].toFixed(5) + ',' + bb[1].toFixed(5) + ',' + bb[2].toFixed(5) + ',' + bb[3].toFixed(5);
  }

  /* ---------- OSM tag parsing ---------- */

  /* parse maxheight like "4.2", "4.2 m", "13'6\"", "4.1;4.3" -> meters (worst/lowest) */
  function parseHeightM(str) {
    if (str == null) return null;
    const parts = String(str).split(';').map(s => s.trim()).filter(Boolean);
    let best = null;
    for (const p of parts) {
      const v = parseOneHeight(p);
      if (v != null && (best == null || v < best)) best = v;
    }
    return best;
  }

  function parseOneHeight(s) {
    s = String(s).toLowerCase().trim();
    if (/^(none|unsigned|no|unknown|default|variable|no_indications?)$/.test(s)) return null;
    if (s === 'below_default') return 3.9; // OSM: lower than default threshold -> treat as critical
    let m;
    if ((m = s.match(/^(\d+(?:\.\d+)?)\s*(?:m|mtr|meter|metre|metres|meters)?$/))) {
      const v = parseFloat(m[1]);
      return v > 9 ? v * 0.3048 : v; // plain numbers >9 assumed feet
    }
    if ((m = s.match(/^(\d+(?:\.\d+)?)\s*['\u2032\u2019]?\s*(\d+(?:\.\d+)?)?\s*["\u2033\u201d]?$/))) {
      const ft = parseFloat(m[1]);
      const inn = m[2] ? parseFloat(m[2]) : 0;
      return (ft * 12 + inn) * 0.0254;
    }
    if ((m = s.match(/^(\d+(?:\.\d+)?)\s*(?:ft|feet|foot|')$/))) return parseFloat(m[1]) * 0.3048;
    if ((m = s.match(/^(\d+(?:\.\d+)?)\s*(?:ft|feet)\s*(\d+(?:\.\d+)?)?\s*(?:in|inch(?:es)?)?$/))) {
      const ft = parseFloat(m[1]);
      const inn = m[2] ? parseFloat(m[2]) : 0;
      return (ft * 12 + inn) * 0.0254;
    }
    return null;
  }

  /* parse maxweight like "7.5", "7.5 t", "35000 lbs", "40 st" -> pounds (worst/lowest) */
  function parseWeightLb(str) {
    if (str == null) return null;
    const parts = String(str).split(';').map(s => s.trim()).filter(Boolean);
    let best = null;
    for (const p of parts) {
      const v = parseOneWeight(p);
      if (v != null && (best == null || v < best)) best = v;
    }
    return best;
  }

  function parseOneWeight(s) {
    s = String(s).toLowerCase().trim();
    if (/^(none|unsigned|no|unknown|default|unrestricted)$/.test(s)) return null;
    let m;
    if ((m = s.match(/^(\d+(?:\.\d+)?)\s*$/))) return parseFloat(m[1]) * 2204.62; // plain = metric tonnes (OSM default)
    if ((m = s.match(/^(\d+(?:\.\d+)?)\s*(?:t|tonne|tonnes|metric.?ton(?:s)?)$/))) return parseFloat(m[1]) * 2204.62;
    if ((m = s.match(/^(\d+(?:\.\d+)?)\s*(?:st|short.?ton(?:s)?|ton|tons)$/))) return parseFloat(m[1]) * 2000;
    if ((m = s.match(/^(\d+(?:\.\d+)?)\s*(?:lbs?|pounds?|#)$/))) return parseFloat(m[1]);
    if ((m = s.match(/^(\d+(?:\.\d+)?)\s*kg$/))) return parseFloat(m[1]) * 2.20462;
    if ((m = s.match(/^(\d+(?:\.\d+)?)\s*long.?ton(?:s)?$/))) return parseFloat(m[1]) * 2240;
    return null;
  }

  const geo = {
    toRad, toDeg, haversineM, bearingDeg, distToSegmentM, cumulative,
    projectOnLine, pointAtAlong, bboxOf, chunkBboxes, bboxString,
    parseHeightM, parseWeightLb
  };
  global.RR = global.RR || {};
  global.RR.geo = geo;
  if (typeof module !== 'undefined' && module.exports) module.exports = geo;
})(typeof window !== 'undefined' ? window : globalThis);
