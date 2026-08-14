/* RouteRig routing & corridor analysis */
(function (global) {
  'use strict';
  const RR = (global.RR = global.RR || {});
  const { CONFIG, geo, util, overpass, fuel, services, data } = RR;

  /* ---------- geocoding ---------- */
  async function geocode(q) {
    const t = String(q || '').trim();
    if (!t) return [];
    const latlng = t.match(/^(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)$/);
    if (latlng) {
      const lat = parseFloat(latlng[1]), lon = parseFloat(latlng[2]);
      if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
        return [{ label: lat.toFixed(5) + ', ' + lon.toFixed(5), lat: lat, lon: lon }];
      }
    }
    /* NOTE: no custom headers — browsers treat User-Agent as a forbidden header,
       and any custom header triggers a CORS preflight that OSM geocoders may reject. */
    let lastErr = null;
    for (const base of CONFIG.geocoders) {
      try {
        const res = await fetch(base + '?q=' + encodeURIComponent(t) + '&limit=6&accept-language=en' +
          (base.includes('photon') ? '&lang=en' : '&format=jsonv2'));
        if (res.status === 429) throw new Error('Geocoder is busy (HTTP 429)');
        if (!res.ok) throw new Error('Geocoder HTTP ' + res.status);
        const json = await res.json();
        if (base.includes('photon')) {
          const out = (json.features || []).map(f => {
            const p = f.properties || {};
            const c = f.geometry && f.geometry.coordinates;
            if (!c) return null;
            const label = [p.name, p.city || p.county || p.state, p.state, p.country]
              .filter((v, i, arr) => v && arr.indexOf(v) === i).join(', ');
            return { label: label, lat: c[1], lon: c[0] };
          }).filter(Boolean);
          if (out.length) return out;
          throw new Error('No results');
        } else {
          const out = (json || []).map(r => ({ label: r.display_name, lat: parseFloat(r.lat), lon: parseFloat(r.lon) }));
          if (out.length) return out;
          throw new Error('No results');
        }
      } catch (e) {
        lastErr = e;
      }
    }
    throw new Error('Could not look up \"' + t + '\" — ' +
      (lastErr && lastErr.message ? lastErr.message + '. ' : '') +
      'Check your internet connection, or enter \"latitude, longitude\".');
  }

  /* ---------- route engines ---------- */
  async function routeOSRM(o, d, base) {
    const url = (base || CONFIG.osrm) + o.lng + ',' + o.lat + ';' + d.lng + ',' + d.lat +
      '?overview=full&geometries=geojson&steps=false&alternatives=false';
    const res = await fetch(url);
    if (!res.ok) throw new Error('Routing server HTTP ' + res.status);
    const json = await res.json();
    if (json.code !== 'Ok' || !json.routes || !json.routes.length) throw new Error('Routing server found no route (' + (json.code || 'unknown') + ')');
    const r = json.routes[0];
    const coords = r.geometry.coordinates.map(c => [c[1], c[0]]);
    return { coords: coords, meters: r.distance, seconds: r.duration, engine: 'OSRM (car roads + on-board truck checks)' };
  }

  async function routeORS(o, d, truck) {
    const body = {
      coordinates: [[o.lng, o.lat], [d.lng, d.lat]],
      elevation: false,
      instructions: false,
      profile_params: {
        restrictions: {
          height: truck.heightM,
          weight: truck.weightLb / 2204.62,
          hazmat: !!truck.hazmat
        }
      },
      options: { avoid_features: truck.avoidTolls ? ['tollways'] : [] }
    };
    const res = await fetch(CONFIG.ors.base + '/geojson', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': CONFIG.ors.key },
      body: JSON.stringify(body)
    });
    if (res.status === 401 || res.status === 403) throw new Error('OpenRouteService key rejected');
    if (!res.ok) throw new Error('ORS routing error ' + res.status);
    const json = await res.json();
    const f = json.features && json.features[0];
    if (!f || !f.geometry) throw new Error('No HGV route found');
    const coords = f.geometry.coordinates.map(c => [c[1], c[0]]);
    const s = f.properties && f.properties.summary ? f.properties.summary : {};
    return { coords: coords, meters: s.distance || null, seconds: s.duration || null, engine: 'OpenRouteService HGV (truck routing)' };
  }

  async function computeRoute(o, d, truck) {
    if (CONFIG.ors.key) {
      try { return await routeORS(o, d, truck); }
      catch (e) {
        RR.toast('HGV routing failed (' + e.message + ') — falling back to OSRM', 'warn');
      }
    }
    let lastErr = null;
    for (const base of CONFIG.osrmServers) {
      try {
        const r = await routeOSRM(o, d, base);
        if (r.meters == null) r.meters = geo.haversineM([o.lat, o.lng], [d.lat, d.lng]);
        return r;
      } catch (e) { lastErr = e; }
    }
    throw new Error('Routing failed on all servers — ' +
      (lastErr && lastErr.message ? lastErr.message + '. ' : '') +
      'Check your internet/firewall.');
  }

  /* ---------- multiple route options ---------- */
  async function routeOSRMMulti(o, d, base) {
    const url = (base || CONFIG.osrm) + o.lng + ',' + o.lat + ';' + d.lng + ',' + d.lat +
      '?overview=full&geometries=geojson&steps=false&alternatives=true';
    const res = await fetch(url);
    if (!res.ok) throw new Error('Routing server HTTP ' + res.status);
    const json = await res.json();
    if (json.code !== 'Ok' || !json.routes || !json.routes.length) throw new Error('Routing server found no route');
    return json.routes.map(r => ({
      coords: r.geometry.coordinates.map(c => [c[1], c[0]]),
      meters: r.distance, seconds: r.duration,
      engine: 'OSRM (car roads + on-board truck checks)'
    }));
  }

  /* last-resort straight-line route so planning never fails when routing APIs are blocked */
  function straightLineRoute(o, d) {
    const distM = geo.haversineM([o.lat, o.lng], [d.lat, d.lng]);
    const n = Math.max(2, Math.ceil(distM / 4000) + 1);
    const coords = [];
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      coords.push([o.lat + (d.lat - o.lat) * t, o.lng + (d.lng - o.lng) * t]);
    }
    return {
      id: 'fallback', label: 'Direct line (offline)',
      coords: coords, meters: distM * 1.08, seconds: distM * 1.08 / 10.5,
      engine: 'Fallback — direct line (live routing blocked)'
    };
  }

  async function computeRouteOptions(o, d, truck) {
    const out = [];
    if (CONFIG.ors.key) {
      try {
        const r = await routeORS(o, d, truck);
        r.id = 'hgv';
        r.label = 'Truck-safe (HGV)';
        out.push(r);
      } catch (e) {
        RR.toast('HGV routing failed (' + e.message + ') — using standard options', 'warn');
      }
    }
    const seen = new Set();
    for (const base of CONFIG.osrmServers) {
      try {
        const routes = await routeOSRMMulti(o, d, base);
        for (const r of routes) {
          const key = Math.round(r.meters / 50);
          if (seen.has(key)) continue;
          seen.add(key);
          if (out.length >= 4) break;
          out.push(r);
        }
      } catch (e) { /* try next server */ }
      if (out.length >= 4 || (out.length >= 2 && !CONFIG.ors.key)) break;
    }
    if (!out.length) out.push(straightLineRoute(o, d));

    const byTime = [...out].sort((a, b) => (a.seconds || 1e12) - (b.seconds || 1e12));
    const fastest = byTime[0];
    let shortest = null;
    for (const r of out) if (!shortest || r.meters < shortest.meters) shortest = r;
    let alt = 1;
    for (const r of out) {
      if (r.label) continue;
      if (r === fastest) r.label = 'Fastest';
      else if (r === shortest && r !== fastest) r.label = 'Shortest';
      else r.label = 'Alternate ' + (alt++);
    }
    out.forEach((r, i) => { r.id = r.id || 'opt-' + (i + 1); });
    return out;
  }

  /* keep single-route API for compatibility */
  async function computeRoute(o, d, truck) {
    const opts = await computeRouteOptions(o, d, truck);
    return opts[0];
  }

  /* ---------- no-network local fallbacks (clearly labeled as simulated) ---------- */
  function weighStationsAlongLocal(coords, customWeigh) {
    const cum = geo.cumulative(coords);
    const list = [];
    const seen = new Set();
    for (const c of data.CURATED_WEIGH) {
      seen.add(c.id);
      list.push({ id: c.id, name: c.name, lat: c.lat, lng: c.lng, road: c.road, state: c.state, dir: c.dir, source: 'curated', curated: true });
    }
    for (const c of customWeigh || []) {
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      list.push({ id: c.id, name: c.name, lat: c.lat, lng: c.lng, road: c.road || 'custom POI', source: 'custom', curated: false });
    }
    for (const w of list) {
      const proj = geo.projectOnLine([w.lat, w.lng], coords, cum);
      if (proj) { w.distAlong = proj.alongM / 1609.344; w.crossM = proj.crossM; }
    }
    return list.filter(w => w.crossM != null && w.crossM <= 7000).sort((a, b) => a.distAlong - b.distAlong);
  }

  async function fuelAlongLocal(coords, customFuel) {
    const cum = geo.cumulative(coords);
    const stations = fuel.generateAlong(coords, cum);
    for (const c of customFuel || []) {
      const proj = geo.projectOnLine([c.lat, c.lng], coords, cum);
      if (proj) {
        stations.push({
          id: c.id, name: c.name, lat: c.lat, lng: c.lng, brand: c.brand || 'Custom',
          price: c.price != null ? c.price : fuel.dieselPrice(c.id, c.lat, c.lng),
          amenities: c.amenities || [], truckStop: false, tags: {},
          distAlong: proj.alongM / 1609.344, crossM: proj.crossM
        });
      }
    }
    return stations.filter(s => s.distAlong != null && s.crossM != null).sort((a, b) => a.price - b.price);
  }

  async function shopsAlongLocal(coords, customShops) {
    const cum = geo.cumulative(coords);
    const shops = services.generateAlong(coords, cum);
    for (const c of customShops || []) {
      const proj = geo.projectOnLine([c.lat, c.lng], coords, cum);
      if (proj) {
        shops.push({
          id: c.id, name: c.name, lat: c.lat, lng: c.lng, type: 'custom', typeLabel: c.typeLabel || 'Repair shop',
          rating: c.rating || 5, reviews: c.reviews || 1, services: c.services || [], phone: null,
          truckCapable: true, tags: {}, distAlong: proj.alongM / 1609.344, crossM: proj.crossM
        });
      }
    }
    return services.rank(shops.filter(s => s.distAlong != null && s.crossM != null));
  }

  /* ---------- clearance / restriction check along route ---------- */
  function minWayRouteDistance(wayPts, coords, cum) {
    const rStride = Math.max(1, Math.floor(coords.length / 900));
    const wStride = Math.max(1, Math.floor(wayPts.length / 200));
    let bestD = Infinity, bestLat = wayPts[0][0], bestLng = wayPts[0][1], bestRouteI = 0;
    for (let i = 0; i + 1 < wayPts.length; i += wStride) {
      const a = wayPts[i], b = wayPts[i + 1];
      for (let j = 0; j < coords.length; j += rStride) {
        const d = geo.distToSegmentM(coords[j], a, b);
        if (d < bestD) {
          bestD = d; bestRouteI = j;
          bestLat = coords[j][0]; bestLng = coords[j][1];
        }
      }
    }
    if (wayPts.length === 1) {
      for (let j = 0; j < coords.length; j += rStride) {
        const d = geo.haversineM(coords[j], wayPts[0]);
        if (d < bestD) { bestD = d; bestRouteI = j; bestLat = wayPts[0][0]; bestLng = wayPts[0][1]; }
      }
    }
    return { crossM: bestD, lat: bestLat, lng: bestLng, alongM: cum[bestRouteI] || 0 };
  }

  async function analyzeClearances(coords, truck, customClears) {
    const cum = geo.cumulative(coords);
    const els = await overpass.corridorQuery(
      [overpass.filters.clearanceHeight, overpass.filters.clearanceHeightPhys,
       overpass.filters.clearanceWeight, overpass.filters.clearanceWeightPhys],
      coords, 'tags geom', 100, 1500
    );
    const out = [];
    const truckH = truck.heightM;
    for (const el of els) {
      const tags = el.tags || {};
      const h = geo.parseHeightM(tags.maxheight != null ? tags.maxheight : tags['maxheight:physical']);
      const w = geo.parseWeightLb(tags.maxweight != null ? tags.maxweight : tags['maxweight:physical']);
      const geom = (el.geometry && el.geometry.length) ? el.geometry.map(g => [g.lat, g.lon]) : null;
      if (h == null && w == null) continue;
      if (h != null && h >= truckH + CONFIG.maxHeightCautionM) h = null;   // comfortably clear
      if (w != null && w >= truck.weightLb) w = null;                     // no restriction for us
      if (h == null && w == null) continue;
      let pos;
      if (geom) pos = minWayRouteDistance(geom, coords, cum);
      else pos = { crossM: 0, lat: el.center ? el.center.lat : 0, lng: el.center ? el.center.lon : 0, alongM: 0 };
      if (pos.crossM > 400) continue; // structure near corridor but not on route
      let severity = 'warn';
      if (h != null && h < truckH + CONFIG.maxHeightMarginM) severity = 'danger';
      if (w != null && w < truck.weightLb * 0.9) severity = 'danger';
      const road = tags.name || tags.ref || 'unnamed';
      let msg = '';
      if (h != null) msg += 'Clearance ' + util.fmtHeightM(h) + (tags.maxheight == null ? ' (physical)' : '') + '. ';
      if (w != null) msg += 'Weight limit ' + util.fmtWeightLb(w) + '. ';
      msg += 'You: ' + util.fmtHeightM(truckH) + ' / ' + util.fmtWeightLb(truck.weightLb);
      out.push({
        id: 'cl-' + el.type + '-' + el.id,
        name: (tags.name || road) + (tags.bridge === 'yes' ? ' (bridge)' : tags.tunnel === 'yes' ? ' (tunnel)' : ''),
        lat: pos.lat, lng: pos.lng,
        heightM: h, weightLb: w,
        distAlong: pos.alongM / 1609.344, crossM: pos.crossM,
        road: road, severity: severity, msg: msg, source: 'osm'
      });
    }
    for (const c of customClears || []) {
      const proj = geo.projectOnLine([c.lat, c.lng], coords, cum);
      if (!proj || proj.crossM > 400) continue;
      out.push({
        id: c.id, name: c.name, lat: c.lat, lng: c.lng,
        heightM: c.heightM || null, weightLb: c.weightLb || null,
        distAlong: proj.alongM / 1609.344, crossM: proj.crossM,
        road: c.road || 'custom POI', severity: 'danger', msg: c.note || 'Custom clearance alert', source: 'custom'
      });
    }
    out.sort((a, b) => a.distAlong - b.distAlong);
    return out;
  }

  async function clearancesAround(lat, lng, radiusM, truck) {
    const els = await overpass.aroundQuery(
      [overpass.filters.clearanceHeight, overpass.filters.clearanceHeightPhys,
       overpass.filters.clearanceWeight, overpass.filters.clearanceWeightPhys],
      lat, lng, radiusM, 'tags geom'
    );
    const out = [];
    for (const el of els) {
      const tags = el.tags || {};
      const h = geo.parseHeightM(tags.maxheight != null ? tags.maxheight : tags['maxheight:physical']);
      const w = geo.parseWeightLb(tags.maxweight != null ? tags.maxweight : tags['maxweight:physical']);
      if (h == null && w == null) continue;
      if (h != null && h >= truck.heightM + CONFIG.maxHeightCautionM) h = null;
      if (w != null && w >= truck.weightLb) w = null;
      if (h == null && w == null) continue;
      const c = el.center || (el.geometry && el.geometry[0]);
      out.push({
        id: 'cl-near-' + el.type + '-' + el.id,
        name: tags.name || tags.ref || 'low structure',
        lat: c.lat, lng: c.lon, heightM: h, weightLb: w,
        severity: (h != null && h < truck.heightM + CONFIG.maxHeightMarginM) || (w != null && w < truck.weightLb * 0.9) ? 'danger' : 'warn',
        msg: (h != null ? 'Clearance ' + util.fmtHeightM(h) + '. ' : '') + (w != null ? 'Weight limit ' + util.fmtWeightLb(w) + '.' : ''),
        distAlong: null, source: 'osm'
      });
    }
    return out;
  }

  /* ---------- weigh stations along route ---------- */
  async function weighStationsAlong(coords, customWeigh) {
    const cum = geo.cumulative(coords);
    const els = await overpass.corridorQuery(
      [overpass.filters.weighBridge, overpass.filters.weighNamed], coords, 'center tags', 100, 1500
    );
    const list = [];
    const seen = new Set();
    for (const el of els) {
      /* 'out center' gives lat/lon for nodes, center for ways/relations */
      const c = el.center || { lat: el.lat, lon: el.lon };
      const id = 'ws-osm-' + el.type + '-' + el.id;
      if (seen.has(id)) continue;
      seen.add(id);
      list.push({ id: id, name: (el.tags && (el.tags.name || el.tags.ref)) || 'Weigh station', lat: c.lat, lng: c.lon, source: 'osm', curated: false });
    }
    for (const c of data.CURATED_WEIGH) {
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      list.push({ id: c.id, name: c.name, lat: c.lat, lng: c.lng, road: c.road, state: c.state, dir: c.dir, source: 'curated', curated: true });
    }
    for (const c of customWeigh || []) {
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      list.push({ id: c.id, name: c.name, lat: c.lat, lng: c.lng, road: c.road || 'custom POI', source: 'custom', curated: false });
    }
    for (const w of list) {
      const proj = geo.projectOnLine([w.lat, w.lng], coords, cum);
      if (proj) {
        w.distAlong = proj.alongM / 1609.344;
        w.crossM = proj.crossM;
      }
    }
    return list.filter(w => w.crossM != null && w.crossM <= 7000).sort((a, b) => a.distAlong - b.distAlong);
  }

  async function weighAround(lat, lng, radiusM, customWeigh) {
    const els = await overpass.aroundQuery([overpass.filters.weighBridge, overpass.filters.weighNamed], lat, lng, radiusM, 'center tags');
    const list = els.map(el => {
      const c = el.center || { lat: el.lat, lon: el.lon };
      return {
        id: 'ws-osm-' + el.type + '-' + el.id,
        name: (el.tags && (el.tags.name || el.tags.ref)) || 'Weigh station',
        lat: c.lat, lng: c.lon,
        source: 'osm', curated: false
      };
    });
    for (const c of data.CURATED_WEIGH) {
      if (geo.haversineM([lat, lng], [c.lat, c.lng]) <= radiusM) list.push({ id: c.id, name: c.name, lat: c.lat, lng: c.lng, road: c.road, state: c.state, source: 'curated', curated: true });
    }
    for (const c of customWeigh || []) {
      if (geo.haversineM([lat, lng], [c.lat, c.lng]) <= radiusM) list.push({ id: c.id, name: c.name, lat: c.lat, lng: c.lng, road: c.road || 'custom POI', source: 'custom', curated: false });
    }
    return list;
  }

  /* ---------- fuel & shops ---------- */
  async function fuelAlong(coords, customFuel, now) {
    const cum = geo.cumulative(coords);
    const els = await overpass.corridorQuery([overpass.filters.fuel], coords, 'center tags', 100, 1500);
    const stations = els.map(el => fuel.stationFromEl(el, now)).filter(Boolean);
    for (const c of customFuel || []) {
      stations.push({
        id: c.id, name: c.name, lat: c.lat, lng: c.lng, brand: c.brand || 'Custom',
        price: c.price != null ? c.price : fuel.dieselPrice(c.id, c.lat, c.lng, now),
        amenities: c.amenities || [], truckStop: false, tags: {}
      });
    }
    const withCorr = fuel.attachCorridor(stations, coords, cum);
    return withCorr.filter(s => s.crossM <= 8000).sort((a, b) => a.price - b.price);
  }

  async function fuelAround(lat, lng, radiusM, customFuel, now) {
    const els = await overpass.aroundQuery([overpass.filters.fuel], lat, lng, radiusM, 'center tags');
    const stations = els.map(el => fuel.stationFromEl(el, now)).filter(Boolean);
    for (const c of customFuel || []) {
      if (geo.haversineM([lat, lng], [c.lat, c.lng]) <= radiusM) {
        stations.push({
          id: c.id, name: c.name, lat: c.lat, lng: c.lng, brand: c.brand || 'Custom',
          price: c.price != null ? c.price : fuel.dieselPrice(c.id, c.lat, c.lng, now),
          amenities: c.amenities || [], truckStop: false, tags: {}
        });
      }
    }
    for (const s of stations) s.distM = geo.haversineM([lat, lng], [s.lat, s.lng]);
    return stations.sort((a, b) => a.price - b.price);
  }

  async function shopsAlong(coords, customShops) {
    const cum = geo.cumulative(coords);
    const els = await overpass.corridorQuery([overpass.filters.shopRepair], coords, 'center tags', 100, 1500);
    const shops = els.map(el => services.shopFromEl(el)).filter(Boolean);
    for (const c of customShops || []) {
      shops.push({
        id: c.id, name: c.name, lat: c.lat, lng: c.lng, type: 'custom', typeLabel: c.typeLabel || 'Repair shop',
        rating: c.rating || 5, reviews: c.reviews || 1, services: c.services || [], phone: null,
        truckCapable: true, tags: {}
      });
    }
    services.attachCorridor(shops, coords, cum);
    return services.rank(shops.filter(s => s.crossM != null && s.crossM <= 8000));
  }

  async function shopsAround(lat, lng, radiusM, customShops) {
    const els = await overpass.aroundQuery([overpass.filters.shopRepair], lat, lng, radiusM, 'center tags');
    const shops = els.map(el => services.shopFromEl(el)).filter(Boolean);
    for (const c of customShops || []) {
      if (geo.haversineM([lat, lng], [c.lat, c.lng]) <= radiusM) {
        shops.push({
          id: c.id, name: c.name, lat: c.lat, lng: c.lng, type: 'custom', typeLabel: c.typeLabel || 'Repair shop',
          rating: c.rating || 5, reviews: c.reviews || 1, services: c.services || [], phone: null,
          truckCapable: true, tags: {}
        });
      }
    }
    return services.rank(shops);
  }

  const routing = {
    geocode, computeRoute, computeRouteOptions, routeOSRM, routeOSRMMulti, routeORS, straightLineRoute,
    analyzeClearances, clearancesAround,
    weighStationsAlong, weighAround, weighStationsAlongLocal,
    fuelAlong, fuelAround, fuelAlongLocal,
    shopsAlong, shopsAround, shopsAlongLocal
  };
  RR.routing = routing;
  if (typeof module !== 'undefined' && module.exports) module.exports = routing;
})(typeof window !== 'undefined' ? window : globalThis);
