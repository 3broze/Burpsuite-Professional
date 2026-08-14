/* RouteRig — application bootstrap & feature wiring */
(function () {
  'use strict';
  const RR = window.RR;
  const { CONFIG, geo, util, routing, fuel, services, drive, ui, data, overpass } = RR;
  const $ = (sel) => document.querySelector(sel);

  /* ---------- state ---------- */
  const state = RR.state = {
    map: null, tile: null,
    layers: { fuelCluster: null, weigh: null, clear: null, svc: null, route: null, gps: null },
    markers: {},
    route: null,
    coords: null, cum: null,
    stations: [], weighs: [], clears: [], shops: [],
    weighsNear: [], clearsNear: [],
    truck: RR.settings.truck,
    custom: util.store.get('custom', { weigh: [], clear: [], fuel: [], shop: [] }),
    routeState: null,
    sim: null,
    simEngine: null,
    gpsEngine: new drive.AlertEngine(),
    truckMarker: null, gpsMarker: null,
    navEngine: null,
    planId: 0,
    originLL: null, destLL: null,
    lastGpsCtx: 0
  };

  function persistCustom() { util.store.set('custom', state.custom); }

  /* ---------- map ---------- */
  function initMap() {
    const map = L.map('map', { zoomControl: true }).setView(CONFIG.defaultCenter, CONFIG.defaultZoom);
    state.map = map;
    setTileTheme(RR.settings.theme || 'dark');

    const Lg = L.layerGroup;
    state.layers.fuelCluster = L.markerClusterGroup({
      maxClusterRadius: 55,
      iconCreateFunction: RR.icons.clusterIcon,
      chunkedLoading: true
    });
    state.layers.weigh = Lg();
    state.layers.clear = Lg();
    state.layers.svc = Lg();
    state.layers.route = Lg();
    state.layers.gps = Lg();
    for (const k in state.layers) map.addLayer(state.layers[k]);

    map.on('contextmenu', onContextMenu);
    document.addEventListener('click', () => $('#ctx-menu').classList.add('hidden'));
    map.on('click', () => $('#ctx-menu').classList.add('hidden'));
  }

  function setTileTheme(theme) {
    if (state.tile) state.map.removeLayer(state.tile);
    const url = CONFIG.tiles[theme] || CONFIG.tiles.light;
    state.tile = L.tileLayer(url, {
      attribution: CONFIG.tileAttribution, maxZoom: 19
    });
    state.tile.addTo(state.map);
    RR.settings.theme = theme;
    ui.saveSettings(RR.settings);
  }

  /* ---------- marker helpers ---------- */
  function addFuelMarkers(stations) {
    const c = state.layers.fuelCluster;
    c.clearLayers();
    state.markers.fuel = {};
    for (const s of stations) {
      const m = L.marker([s.lat, s.lng], { icon: RR.icons.fuel(), title: s.name });
      m.bindPopup(ui.popups.fuel(s));
      m.addTo(c);
      state.markers.fuel[s.lat.toFixed(4) + ',' + s.lng.toFixed(4)] = m;
    }
  }

  function addWeighMarkers(weighs) {
    const lg = state.layers.weigh;
    lg.clearLayers();
    state.markers.weigh = {};
    for (const w of weighs) {
      const m = L.marker([w.lat, w.lng], { icon: RR.icons.weigh(), title: w.name });
      m.bindPopup(ui.popups.weigh(w));
      m.addTo(lg);
      state.markers.weigh[w.id] = m;
    }
  }

  function addClearMarkers(clears) {
    const lg = state.layers.clear;
    lg.clearLayers();
    state.markers.clear = {};
    for (const c of clears) {
      const m = L.marker([c.lat, c.lng], { icon: RR.icons.clearance(), title: c.name });
      m.bindPopup(ui.popups.clear(c));
      m.addTo(lg);
      state.markers.clear[c.id] = m;
    }
  }

  function addShopMarkers(shops) {
    const lg = state.layers.svc;
    lg.clearLayers();
    state.markers.shop = {};
    for (const s of shops) {
      const m = L.marker([s.lat, s.lng], { icon: RR.icons.shop(), title: s.name });
      m.bindPopup(ui.popups.shop(s));
      m.addTo(lg);
      state.markers.shop[s.id] = m;
    }
  }

  function drawRoute() {
    const lg = state.layers.route;
    lg.clearLayers();
    if (!state.route) return;
    L.polyline(state.coords, { color: '#000', weight: 10, opacity: 0.3, className: 'route-casing' }).addTo(lg);
    L.polyline(state.coords, { color: '#ff8c1a', weight: 5.5, opacity: 0.95 }).addTo(lg);
    L.marker(state.coords[0], { icon: RR.icons.start() }).addTo(lg).bindPopup('Origin');
    L.marker(state.coords[state.coords.length - 1], { icon: RR.icons.end() }).addTo(lg).bindPopup('Destination');
    const b = geo.bboxOf(state.coords, 5000);
    try {
      state.map.fitBounds([[b[0], b[1]], [b[2], b[3]]], { paddingTopLeft: [390, 90], paddingBottomRight: [60, 60] });
    } catch (e) {
      try { state.map.setView([(b[0] + b[2]) / 2, (b[1] + b[3]) / 2], 8); } catch (e2) { /* noop */ }
    }
  }

  /* ---------- hooks for UI/drive modules ---------- */
  RR.hooks.flyTo = function (lat, lng) {
    state.map.flyTo([lat, lng], Math.max(state.map.getZoom(), 13), { duration: 0.8 });
    const key = lat.toFixed(4) + ',' + lng.toFixed(4);
    const m = (state.markers.fuel && state.markers.fuel[key]) || (state.markers.shop && state.markers.shop[key]);
    if (m) setTimeout(() => m.openPopup(), 900);
  };

  RR.hooks.focus = function (a) {
    if (a && a.lat != null) RR.hooks.flyTo(a.lat, a.lng);
  };

  RR.hooks.routeHere = function (lat, lng) {
    const dest = { lat: lat, lng: lng, label: lat.toFixed(5) + ', ' + lng.toFixed(5) };
    let origin = state.originLL;
    if (!origin) {
      const truck = state.truckMarker ? state.truckMarker.getLatLng() : null;
      const gps = drive.gps.pos;
      if (truck) origin = { lat: truck.lat, lng: truck.lng, label: 'Current truck position' };
      else if (gps) origin = { lat: gps.lat, lng: gps.lng, label: 'GPS position' };
      else {
        const c = state.map.getCenter();
        origin = { lat: c.lat, lng: c.lng, label: 'Map center' };
      }
    }
    $('#in-origin').value = origin.label;
    $('#in-origin').dataset.lat = origin.lat;
    $('#in-origin').dataset.lng = origin.lng;
    $('#in-dest').value = dest.label;
    $('#in-dest').dataset.lat = dest.lat;
    $('#in-dest').dataset.lng = dest.lng;
    switchTab('route');
    planRoute();
  };

  RR.hooks.focusStep = function (i) {
    const steps = state.route && state.route.steps;
    if (!steps || !steps[i]) return;
    const s = steps[i];
    if (s.lat != null && s.lng != null) {
      state.map.flyTo([s.lat, s.lng], Math.max(state.map.getZoom(), 14), { duration: 0.7 });
    } else {
      const pos = geo.pointAtAlong(state.coords, state.cum, s.cumM || 0);
      state.map.flyTo(pos, Math.max(state.map.getZoom(), 14), { duration: 0.7 });
    }
  };

  RR.hooks.voiceState = function (listening) {
    const mic = $('#btn-mic');
    if (mic) mic.classList.toggle('listening', !!listening);
  };

  /* voice commands (like Google Maps "OK Google" style) */
  RR.hooks.voiceCommand = function (t) {
    const sim = state.sim;
    let m;
    if ((m = t.match(/^(navigate|take me|directions|drive)( me)?( to)? (.+)$/)) ||
        (m = t.match(/^route to (.+)$/))) {
      const dest = (m[4] || m[1] || '').trim();
      if (!dest) { ui.toast('Say: navigate to Dallas', 'info'); return; }
      const inDest = $('#in-dest');
      inDest.value = dest;
      delete inDest.dataset.lat;
      delete inDest.dataset.lng;
      switchTab('route');
      ui.toast('Navigating to "' + dest + '"', 'success');
      RR.voice.speak('Navigating to ' + dest);
      planRoute();
    } else if (/^(demo|demo drive|start (the )?demo|start driving)/.test(t)) {
      if (!state.routeState) {
        ui.toast('Plan a route first', 'warn', 'Say "navigate to Dallas" or use a preset.');
        switchTab('route');
        return;
      }
      $('#btn-demo').click();
    } else if (/^(stop|stop driving|stop demo|end)/.test(t)) {
      if (sim && sim.running) sim.stop(false);
      else if (drive.gps.active) drive.gps.stop();
      else RR.voice.speak('Nothing is running.');
    } else if (/^(mute|voice off|silence)/.test(t)) {
      setVoiceEnabled(false);
    } else if (/^(voice on|unmute|sound on)/.test(t)) {
      setVoiceEnabled(true);
    } else if (/^(zoom in)/.test(t)) {
      state.map.zoomIn();
    } else if (/^(zoom out)/.test(t)) {
      state.map.zoomOut();
    } else if (/fuel|cheap diesel|truck stop/.test(t)) {
      switchTab('fuel');
      $('#btn-fuel-near-me').click();
    } else if (/where am i|my location/.test(t)) {
      drive.gps.start();
    } else if (/repair|mechanic|service shop/.test(t)) {
      switchTab('service');
      $('#btn-svc-near-me').click();
    } else if (/read route|route details|directions/.test(t)) {
      switchTab('nav');
      readRouteAloud();
    } else {
      ui.toast('Command not recognized', 'info', 'Try: "navigate to Dallas" · "demo drive" · "stop" · "mute" · "fuel"');
    }
  };

  function setVoiceEnabled(on) {
    RR.voice.enabled = on;
    RR.settings.voiceOn = on;
    ui.saveSettings(RR.settings);
    const btn = $('#btn-voice-toggle');
    if (btn) btn.textContent = on ? '🔊 Voice: ON' : '🔇 Voice: OFF';
    if (!on) RR.voice.stop();
    ui.toast(on ? 'Voice guidance on' : 'Voice guidance off', 'info');
  }

  /* read the route aloud: summary + maneuvers */
  function readRouteAloud() {
    const opt = state.route;
    if (!opt) { ui.toast('Plan a route first', 'warn'); return; }
    const steps = opt.steps || [];
    const parts = [];
    parts.push('Route ready. ' + util.fmtMi(opt.meters / 1609.344) + ', about ' + util.fmtClock(opt.seconds || 0) + '.');
    const maxRead = Math.min(steps.length, 12);
    for (let i = 1; i < maxRead; i++) {
      parts.push('Then, ' + RR.nav.lowerFirst(steps[i].text) + (steps[i].distM > 50 ? ', in ' + util.fmtMi(steps[i].distM / 1609.344) : ''));
    }
    if (steps.length > maxRead) parts.push('And ' + (steps.length - maxRead) + ' more turns. See the list for details.');
    RR.voice.speak(parts.join(' '));
  }

  /* nav tick from drive/GPS */
  RR.sink.onNavTick = function (o) {
    if (!state.navEngine || !state.navEngine.opt) return;
    const info = state.navEngine.tick(o.alongM, o.speedMph || 0);
    if (info) RR.sink.onNavInfo(info);
  };

  RR.hooks.removeCustom = function (id, type) {
    state.custom[type] = (state.custom[type] || []).filter(p => p.id !== id);
    persistCustom();
    ui.toast('Custom POI removed', 'info');
    if (state.route) refreshCorridors().catch(() => {});
    else refreshNearLayers();
  };

  RR.hooks.truckMove = function (o) {
    if (!state.truckMarker) {
      state.truckMarker = L.marker([o.lat, o.lng], { icon: RR.icons.truck(), zIndexOffset: 900 }).addTo(state.layers.gps);
    }
    state.truckMarker.setLatLng([o.lat, o.lng]);
    const el = state.truckMarker.getElement();
    if (el) {
      const rot = el.querySelector('#truck-marker-html');
      if (rot) rot.style.transform = 'rotate(' + Math.round(o.heading || 0) + 'deg)';
    }
    state.map.panTo([o.lat, o.lng], { animate: true, duration: 0.5 });
  };

  RR.hooks.driveStart = function () {
    if (drive.gps.active) drive.gps.stop();
  };
  RR.hooks.driveStop = function () {
    if (state.truckMarker) { state.layers.gps.removeLayer(state.truckMarker); state.truckMarker = null; }
  };
  RR.hooks.gpsStart = function () {
    $('#btn-locate').classList.add('btn-gps-on');
    $('#btn-locate .dot').className = 'dot dot-green';
    if (state.sim && state.sim.running) state.sim.stop(false);
  };
  RR.hooks.gpsStop = function () {
    $('#btn-locate').classList.remove('btn-gps-on');
    $('#btn-locate .dot').className = 'dot dot-red';
    if (state.gpsMarker) { state.layers.gps.removeLayer(state.gpsMarker); state.gpsMarker = null; }
  };
  RR.hooks.gpsError = function () {
    $('#btn-locate').classList.remove('btn-gps-on');
    $('#btn-locate .dot').className = 'dot dot-red';
  };

  RR.hooks.gpsFix = function (g) {
    if (!state.gpsMarker) {
      state.gpsMarker = L.marker([g.pos.lat, g.pos.lng], { icon: RR.icons.gps(), zIndexOffset: 800 }).addTo(state.layers.gps);
    }
    state.gpsMarker.setLatLng([g.pos.lat, g.pos.lng]);
    state.map.panTo([g.pos.lat, g.pos.lng], { animate: true, duration: 0.6 });

    /* refresh nearby hazard context every 60s */
    if (Date.now() - state.lastGpsCtx > 60000) {
      state.lastGpsCtx = Date.now();
      refreshGpsContext(g.pos.lat, g.pos.lng);
    }

    /* alerts */
    let alerts = [];
    if (state.routeState) {
      const proj = geo.projectOnLine([g.pos.lat, g.pos.lng], state.coords, state.cum);
      if (proj && proj.crossM < 300) {
        RR.sink.onNavTick({ alongM: proj.alongM, speedMph: g.speedMph || 0 });
        const alongMi = proj.alongM / 1609.344;
        const fuelGal = state.truck.tankGal * 0.95 - alongMi / state.truck.mpg;
        alerts = state.gpsEngine.checkRoute({ alongMi: alongMi, fuelGal: Math.max(0, fuelGal), simDate: new Date(), rs: state.routeState });
      } else {
        alerts = state.gpsEngine.checkProximity({ lat: g.pos.lat, lng: g.pos.lng, rs: { weighsNear: state.weighsNear, clearsNear: state.clearsNear } });
      }
    } else {
      alerts = state.gpsEngine.checkProximity({ lat: g.pos.lat, lng: g.pos.lng, rs: { weighsNear: state.weighsNear, clearsNear: state.clearsNear } });
    }
    for (const a of alerts) RR.sink.alert(a);
  };

  async function refreshGpsContext(lat, lng) {
    try {
      state.weighsNear = await routing.weighAround(lat, lng, 5000, state.custom.weigh);
      state.clearsNear = await routing.clearancesAround(lat, lng, 3000, state.truck);
      ui.setStatus('GPS live — ' + state.weighsNear.length + ' weigh stations, ' + state.clearsNear.length + ' low structures nearby');
    } catch (e) { /* silent */ }
  }

  /* ---------- route planning ---------- */
  async function resolveInput(input, which) {
    if (input.dataset.lat != null && input.dataset.lng != null) {
      return { lat: parseFloat(input.dataset.lat), lng: parseFloat(input.dataset.lng), label: input.value };
    }
    const results = await routing.geocode(input.value);
    if (!results.length) throw new Error('Could not find "' + input.value + '"');
    const r = results[0];
    input.value = r.label;
    input.dataset.lat = r.lat;
    input.dataset.lng = r.lng;
    return r;
  }

  /* ---- corridor data with graceful fallback (live -> local simulated) ---- */
  async function corridorData(planId) {
    const tasks = [
      ['clears', () => routing.analyzeClearances(state.coords, state.truck, state.custom.clear)],
      ['weighs', () => routing.weighStationsAlong(state.coords, state.custom.weigh)],
      ['fuel', () => routing.fuelAlong(state.coords, state.custom.fuel)],
      ['shops', () => routing.shopsAlong(state.coords, state.custom.shop)]
    ];
    const settled = await Promise.allSettled(tasks.map(t => t[1]()));
    if (planId !== state.planId) return null;
    const got = {};
    const failures = [];
    settled.forEach((s, i) => {
      const key = tasks[i][0];
      if (s.status === 'fulfilled') got[key] = s.value;
      else { got[key] = []; failures.push(key); }
    });
    /* local fallbacks so the app always has something useful */
    if (!got.weighs.length) got.weighs = routing.weighStationsAlongLocal(state.coords, state.custom.weigh);
    if (!got.fuel.length) got.fuel = await routing.fuelAlongLocal(state.coords, state.custom.fuel);
    if (!got.shops.length) got.shops = await routing.shopsAlongLocal(state.coords, state.custom.shop);
    return { got: got, failures: failures };
  }

  async function planRoute() {
    const originIn = $('#in-origin'), destIn = $('#in-dest');
    if (!originIn.value.trim() || !destIn.value.trim()) {
      ui.toast('Enter origin and destination', 'warn');
      switchTab('route');
      return;
    }
    const planId = ++state.planId;
    ui.showOverlay('Planning route…');
    try {
      /* ---- step 1: find the places ---- */
      ui.setStatus('Step 1/3: finding your origin & destination…');
      const origin = await resolveInput(originIn, 'origin');
      const dest = await resolveInput(destIn, 'dest');
      if (planId !== state.planId) return;
      state.originLL = origin;
      state.destLL = dest;

      /* ---- step 2: compute route options ---- */
      ui.setStatus('Step 2/3: routing ' + origin.label.split(',')[0] + ' → ' + dest.label.split(',')[0] + '…');
      const options = await routing.computeRouteOptions(origin, dest, state.truck);
      if (planId !== state.planId) return;
      state.routeOptions = options;
      renderOptionChips(options, options[0].id);

      /* ---- step 3: select best option and gather corridor data ---- */
      ui.setStatus('Step 3/3: checking truck hazards, fuel & services…');
      await selectRouteOption(options[0].id, planId, true);
      if (planId !== state.planId) return;

      ui.hideOverlay();
      const opt = state.route;
      if (opt && opt.engine && opt.engine.indexOf('Fallback') === 0) {
        ui.toast('Live routing blocked — using direct line', 'warn',
          'External routing APIs are unreachable from this network. Route shown as a straight line; use an ORS key for full routing.');
      }
      if (options.length > 1) {
        ui.toast('Route options ready', 'success',
          'Pick between ' + options.length + ' options: ' + options.map(o => o.label).join(', ') + '.');
      }
    } catch (e) {
      if (planId !== state.planId) return;
      ui.hideOverlay();
      const msg = (e && e.message ? e.message : 'Unknown error') + errWhere(e);
      ui.toast('Route planning failed', 'danger', msg);
      ui.setStatus('Route planning failed — ' + msg);
      console.error('[RouteRig] route planning error:', e);
    }
  }

  /* locate the failing code position from an error stack (for diagnostics) */
  function errWhere(e) {
    if (!e || !e.stack) return '';
    const frame = e.stack.split('\n').find(l => /\.js:\d+:\d+/.test(l));
    if (!frame) return '';
    const short = frame.trim().replace(/^at\s+/, '');
    const tail = short.split('/').pop();
    return tail ? ' @ ' + tail : '';
  }

  async function selectRouteOption(id, planId, initial) {
    const opt = (state.routeOptions || []).find(o => o.id === id);
    if (!opt) return;
    if (state.sim && state.sim.running) state.sim.stop(false);
    state.route = opt;
    state.coords = opt.coords;
    state.cum = geo.cumulative(opt.coords);
    drawRoute();
    ui.setStatus('Option "' + opt.label + '" selected — checking hazards, fuel & services…');

    const cd = await corridorData(planId || state.planId);
    if (!cd) return;
    const got = cd.got;
    state.clears = got.clears;
    state.weighs = got.weighs;
    state.stations = got.fuel;
    state.shops = got.shops;
    state.liveData = { clears: cd.failures.indexOf('clears') === -1, weighs: cd.failures.indexOf('weighs') === -1,
                       fuel: cd.failures.indexOf('fuel') === -1, shops: cd.failures.indexOf('shops') === -1 };

    addClearMarkers(state.clears);
    addWeighMarkers(state.weighs);
    addFuelMarkers(state.stations);
    addShopMarkers(state.shops);

    state.routeState = {
      coords: state.coords, cum: state.cum,
      weighs: state.weighs, clears: state.clears, stations: state.stations, shops: state.shops,
      truck: state.truck,
      meters: opt.meters, seconds: opt.seconds
    };

    /* turn-by-turn */
    state.navEngine.setRoute(opt, opt.steps || []);
    ui.renderDirections(opt.steps || [], (opt.meters || 0) / 1609.344, -1);
    const firstInfo = state.navEngine.tick(0, 0);
    if (firstInfo) RR.sink.onNavInfo(firstInfo);

    const plan = state.stations.length
      ? fuel.buildFuelPlan(opt.meters, state.stations, state.truck)
      : null;
    ui.renderRouteSummary(state);
    ui.renderFuelPlanCard(plan);
    ui.renderFuelList(state.stations,
      state.stations.length
        ? (state.liveData.fuel
            ? 'Cheapest diesel along your route (' + state.stations.length + ' stops).'
            : 'Simulated diesel stops along your route (live fuel data blocked).')
        : 'No fuel data for this route — use "Near me" to retry.');
    ui.renderSvcList(state.shops,
      state.shops.length
        ? (state.liveData.shops
            ? 'Best-rated repair along your route (' + state.shops.length + ' shops).'
            : 'Simulated repair shops along your route (live data blocked).')
        : 'No repair shops mapped for this route — use "Near me" to retry.');
    $('#btn-clear-route').classList.remove('hidden');

    const danger = state.clears.filter(c => c.severity === 'danger').length;
    const nearDanger = state.clears.find(c => c.severity === 'danger' && c.distAlong < 2);
    if (initial && cd.failures.length) {
      ui.toast('Route OK — some live data substituted', 'warn',
        'Blocked here: ' + cd.failures.join(', ') + '. Using simulated/curated data (labeled).');
    }
    if (nearDanger) {
      RR.sink.alert({
        type: 'clear', severity: 'danger',
        title: 'Route passes ' + nearDanger.name + ' at mile ' + util.fmtMi(nearDanger.distAlong),
        detail: nearDanger.msg, lat: nearDanger.lat, lng: nearDanger.lng
      });
    } else if (danger) {
      ui.toast('⚠️ ' + danger + ' low clearance(s) on this route', 'warn', 'See map + Alerts tab. Check your truck height matches.');
    }
    ui.setStatus('Option ' + opt.label + ': ' + util.fmtMi(opt.meters / 1609.344) + ' · ' +
      state.weighs.length + ' weigh stations · ' + danger + ' clearance hazards · ready to drive');
    if (!initial) {
      ui.toast('Route option switched', 'success', opt.label + ' · ' + util.fmtMi(opt.meters / 1609.344));
    }
  }

  function renderOptionChips(options, selectedId) {
    const wrap = $('#route-opt-chips');
    if (!wrap) return;
    wrap.innerHTML = '';
    $('#route-options').classList.remove('hidden');
    for (const o of options) {
      const b = document.createElement('button');
      b.className = 'chip option-chip' + (o.id === selectedId ? ' option-active' : '');
      b.innerHTML = '⏱ ' + util.fmtClock(o.seconds) + ' · ' + util.fmtMi(o.meters / 1609.344) +
        ' — ' + util.esc(o.label);
      b.title = o.engine || '';
      b.onclick = () => selectRouteOption(o.id);
      wrap.appendChild(b);
    }
  }

  async function refreshCorridors() {
    if (!state.route) return;
    const cd = await corridorData(state.planId);
    if (!cd) return;
    const got = cd.got;
    state.clears = got.clears; state.weighs = got.weighs; state.stations = got.fuel; state.shops = got.shops;
    addClearMarkers(got.clears); addWeighMarkers(got.weighs); addFuelMarkers(got.fuel); addShopMarkers(got.shops);
    state.routeState.weighs = got.weighs;
    state.routeState.clears = got.clears;
    state.routeState.stations = got.fuel;
    ui.renderFuelList(got.fuel, 'Cheapest diesel along your route.');
    ui.renderSvcList(got.shops, 'Best-rated repair along your route.');
    ui.renderRouteSummary(state);
    ui.renderFuelPlanCard(fuel.buildFuelPlan(state.route.meters, got.fuel, state.truck));
  }

  function clearRoute() {
    state.route = null;
    state.coords = null;
    state.cum = null;
    state.routeState = null;
    state.originLL = null;
    state.destLL = null;
    state.weighs = []; state.clears = []; state.stations = []; state.shops = [];
    state.layers.route.clearLayers();
    state.layers.clear.clearLayers();
    state.layers.weigh.clearLayers();
    state.layers.fuelCluster.clearLayers();
    state.layers.svc.clearLayers();
    if (state.sim && state.sim.running) state.sim.stop(false);
    $('#route-summary').classList.add('hidden');
    $('#fuel-plan-card').classList.add('hidden');
    $('#btn-clear-route').classList.add('hidden');
    $('#route-options').classList.add('hidden');
    state.routeOptions = [];
    state.liveData = null;
    if (state.navEngine) state.navEngine.reset();
    ui.renderDirections([], 0, -1);
    $('#nav-card').classList.add('hidden');
    ui.renderFuelList([], 'Plan a route to find cheap diesel along the way.');
    ui.renderSvcList([], 'Plan a route to find repair shops along the way.');
    ui.setStatus('Route cleared.');
  }

  /* ---------- near-me queries ---------- */
  async function refreshNearLayers() {
    const center = drive.gps.pos || state.map.getCenter();
    try {
      const stations = await routing.fuelAround(center.lat, center.lng, 30000, state.custom.fuel);
      addFuelMarkers(stations);
      ui.renderFuelList(stations, 'Cheapest diesel within 30 mi (' + stations.length + ' stops).');
    } catch (e) {
      ui.toast('Fuel data unavailable', 'warn', 'Overpass API unreachable — try again shortly.');
    }
    try {
      const shops = await routing.shopsAround(center.lat, center.lng, 30000, state.custom.shop);
      addShopMarkers(shops);
      ui.renderSvcList(shops, 'Best-rated repair within 30 mi (' + shops.length + ' shops).');
    } catch (e) { /* silent */ }
    try {
      const weighs = await routing.weighAround(center.lat, center.lng, 150000, state.custom.weigh);
      addWeighMarkers(weighs);
    } catch (e) { /* silent */ }
  }

  /* ---------- context menu / custom POIs ---------- */
  let ctxLatLng = null;
  function onContextMenu(e) {
    ctxLatLng = e.latlng;
    const menu = $('#ctx-menu');
    menu.classList.remove('hidden');
    const pt = state.map.latLngToContainerPoint(e.latlng);
    menu.style.left = Math.min(pt.x, state.map.getSize().x - 210) + 'px';
    menu.style.top = Math.min(pt.y, state.map.getSize().y - 220) + 'px';
    L.DomEvent.stop(e);
  }

  function addCustomPoi(type) {
    if (!ctxLatLng) return;
    const lat = ctxLatLng.lat, lng = ctxLatLng.lng;
    const id = 'c-' + Date.now();
    if (type === 'weigh') {
      const name = prompt('Weigh station name:', 'Custom weigh station') || 'Custom weigh station';
      state.custom.weigh.push({ id: id, name: name, lat: lat, lng: lng, road: 'custom POI' });
      ui.toast('Weigh station added', 'success', name);
    } else if (type === 'clear') {
      const raw = prompt('Clearance height (e.g. 13\'6" or 4.1):', "13'6\"");
      if (raw == null) return;
      const h = geo.parseHeightM(raw);
      if (h == null) { ui.toast('Could not parse height', 'warn', 'Use formats like 13\'6", 12 ft 4 in, or 4.1 (meters).'); return; }
      const name = prompt('Structure name:', 'Custom low clearance') || 'Custom low clearance';
      state.custom.clear.push({ id: id, name: name, lat: lat, lng: lng, heightM: h, road: 'custom POI', note: 'Custom clearance ' + util.fmtHeightM(h) });
      ui.toast('Low clearance added', 'success', name + ' — ' + util.fmtHeightM(h));
    } else if (type === 'fuel') {
      const name = prompt('Fuel stop name:', 'Custom fuel stop') || 'Custom fuel stop';
      const price = parseFloat(prompt('Diesel price ($/gal, blank = simulated):', ''));
      state.custom.fuel.push({ id: id, name: name, lat: lat, lng: lng, price: isNaN(price) ? null : price });
      ui.toast('Fuel stop added', 'success', name);
    } else if (type === 'shop') {
      const name = prompt('Shop name:', 'Custom repair shop') || 'Custom repair shop';
      state.custom.shop.push({ id: id, name: name, lat: lat, lng: lng, typeLabel: 'Custom shop', rating: 4.5, reviews: 3, services: ['Custom POI'] });
      ui.toast('Repair shop added', 'success', name);
    }
    persistCustom();
    if (state.route) refreshCorridors().catch(() => {});
    else refreshNearLayers();
  }

  /* ---------- UI wiring ---------- */
  function switchTab(name) {
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
    document.querySelectorAll('.panel').forEach(p => p.classList.toggle('active', p.id === 'panel-' + name));
  }

  function wireUI() {
    document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => switchTab(t.dataset.tab)));
    $('#btn-menu').addEventListener('click', () => $('#sidebar').classList.toggle('collapsed'));

    ui.bindSearch($('#in-origin'), $('#res-origin'));
    ui.bindSearch($('#in-dest'), $('#res-dest'));

    $('#btn-route').addEventListener('click', planRoute);
    $('#in-origin').addEventListener('keydown', e => { if (e.key === 'Enter') planRoute(); });
    $('#in-dest').addEventListener('keydown', e => { if (e.key === 'Enter') planRoute(); });
    $('#btn-clear-route').addEventListener('click', clearRoute);

    $('#btn-origin-gps').addEventListener('click', () => {
      if (drive.gps.pos) {
        $('#in-origin').value = 'GPS position';
        $('#in-origin').dataset.lat = drive.gps.pos.lat;
        $('#in-origin').dataset.lng = drive.gps.pos.lng;
      } else {
        drive.gps.start();
        ui.toast('Waiting for GPS fix…', 'info', 'Click 📍 again after the fix to use it as origin.');
      }
    });
    function useMapCenterFor(input) {
      const c = state.map.getCenter();
      input.value = 'Map center (' + c.lat.toFixed(4) + ', ' + c.lng.toFixed(4) + ')';
      input.dataset.lat = c.lat.toFixed(5);
      input.dataset.lng = c.lng.toFixed(5);
      ui.toast('Using map center as location', 'info', 'Works even with no internet.');
    }
    $('#btn-origin-map').addEventListener('click', () => useMapCenterFor($('#in-origin')));
    $('#btn-dest-map').addEventListener('click', () => useMapCenterFor($('#in-dest')));

    document.querySelectorAll('.chip[data-preset]').forEach(c => c.addEventListener('click', () => {
      const p = data.PRESETS[c.dataset.preset];
      if (!p) return;
      $('#in-origin').value = p.origin;
      $('#in-origin').dataset.lat = p.oFallback[0];
      $('#in-origin').dataset.lng = p.oFallback[1];
      $('#in-dest').value = p.dest;
      $('#in-dest').dataset.lat = p.dFallback[0];
      $('#in-dest').dataset.lng = p.dFallback[1];
      planRoute();
    }));

    $('#btn-demo').addEventListener('click', () => {
      if (state.sim && state.sim.running) {
        state.sim.stop(false);
        return;
      }
      if (!state.routeState) {
        ui.toast('Plan a route first', 'warn', 'Use the Route tab or a demo haul preset, then start DEMO DRIVE.');
        switchTab('route');
        return;
      }
      if (drive.gps.active) drive.gps.stop();
      state.sim = new drive.SimDrive(state.routeState);
      state.sim.start();
      $('#btn-demo').innerHTML = '⏹ STOP DRIVE';
      state.map.setView(state.coords[0], Math.max(state.map.getZoom(), 11));
    });

    $('#hud-pause').addEventListener('click', () => { if (state.sim) state.sim.togglePause(); });
    $('#hud-faster').addEventListener('click', () => { if (state.sim) state.sim.bumpSpeed(5); });
    $('#hud-slower').addEventListener('click', () => { if (state.sim) state.sim.bumpSpeed(-5); });
    $('#hud-stop').addEventListener('click', () => { if (state.sim) state.sim.stop(false); });
    RR.hooks.driveStopOrig = RR.hooks.driveStop;
    RR.hooks.driveStopOrig2 = RR.hooks.driveStop;
    RR.hooks.driveStop = function (completed) {
      $('#btn-demo').innerHTML = '▶ DEMO DRIVE';
      if (!completed && RR.voice) RR.voice.stop();
      if (RR.hooks.driveStopOrig) RR.hooks.driveStopOrig(completed);
    };

    $('#btn-locate').addEventListener('click', () => {
      if (drive.gps.active) drive.gps.stop();
      else drive.gps.start();
    });

    $('#btn-theme').addEventListener('click', () => {
      const themes = CONFIG.themes;
      const cur = themes.indexOf(RR.settings.theme);
      const next = themes[(cur + 1) % themes.length];
      setTileTheme(next);
      ui.toast('Map: ' + (CONFIG.themeNames[next] || next), 'info');
    });

    $('#btn-fuel-near-me').addEventListener('click', async () => {
      const center = drive.gps.pos || state.map.getCenter();
      ui.setStatus('Finding fuel near you…');
      try {
        const stations = await routing.fuelAround(center.lat, center.lng, 30000, state.custom.fuel);
        addFuelMarkers(stations);
        ui.renderFuelList(stations, 'Cheapest diesel within 30 mi (' + stations.length + ' stops).');
        ui.setStatus('Fuel: ' + stations.length + ' stops found within 30 mi');
      } catch (e) {
        ui.toast('Fuel data unavailable', 'warn', 'Check your internet connection.');
      }
    });
    $('#btn-fuel-route').addEventListener('click', () => {
      if (state.stations && state.stations.length) {
        ui.renderFuelList(state.stations, 'Cheapest diesel along your route (' + state.stations.length + ' stops).');
      } else {
        ui.toast('No route yet', 'info', 'Plan a route first to see fuel along it.');
        switchTab('route');
      }
    });
    $('#btn-svc-near-me').addEventListener('click', async () => {
      const center = drive.gps.pos || state.map.getCenter();
      ui.setStatus('Finding repair shops near you…');
      try {
        const shops = await routing.shopsAround(center.lat, center.lng, 30000, state.custom.shop);
        addShopMarkers(shops);
        ui.renderSvcList(shops, 'Best-rated repair within 30 mi (' + shops.length + ' shops).');
        ui.setStatus('Services: ' + shops.length + ' shops found');
      } catch (e) {
        ui.toast('Shop data unavailable', 'warn', 'Check your internet connection.');
      }
    });
    $('#btn-svc-route').addEventListener('click', () => {
      if (state.shops && state.shops.length) {
        ui.renderSvcList(state.shops, 'Best-rated repair along your route (' + state.shops.length + ' shops).');
      } else {
        ui.toast('No route yet', 'info', 'Plan a route first to see shops along it.');
        switchTab('route');
      }
    });

    /* legend */
    $('#ly-fuel').addEventListener('change', e => toggleLayer('fuelCluster', e.target.checked));
    $('#ly-weigh').addEventListener('change', e => toggleLayer('weigh', e.target.checked));
    $('#ly-clear').addEventListener('change', e => toggleLayer('clear', e.target.checked));
    $('#ly-svc').addEventListener('change', e => toggleLayer('svc', e.target.checked));
    function toggleLayer(key, on) {
      if (on) state.map.addLayer(state.layers[key]);
      else state.map.removeLayer(state.layers[key]);
    }

    /* context menu */
    document.querySelectorAll('#ctx-menu button').forEach(b => b.addEventListener('click', () => {
      const t = b.dataset.ctx;
      $('#ctx-menu').classList.add('hidden');
      if (t !== 'cancel') addCustomPoi(t);
    }));

    /* truck profile */
    $('#truck-height-ft').value = state.truck.heightFt;
    $('#truck-height-in').value = state.truck.heightIn;
    $('#truck-weight').value = state.truck.weightLb;
    $('#truck-tank').value = state.truck.tankGal;
    $('#truck-mpg').value = state.truck.mpg;
    $('#truck-hazmat').value = String(state.truck.hazmat);
    $('#ors-key').value = RR.settings.orsKey || '';
    $('#truck-avoid-tolls').checked = !!state.truck.avoidTolls;
    $('#alert-weigh-mi').value = RR.settings.alertWeighMi;
    $('#alert-clear-mi').value = RR.settings.alertClearMi;

    $('#btn-save-truck').addEventListener('click', () => {
      const t = state.truck;
      t.heightFt = parseFloat($('#truck-height-ft').value) || 13;
      t.heightIn = parseFloat($('#truck-height-in').value) || 0;
      t.weightLb = parseFloat($('#truck-weight').value) || 80000;
      t.tankGal = parseFloat($('#truck-tank').value) || 150;
      t.mpg = parseFloat($('#truck-mpg').value) || 6.5;
      t.hazmat = $('#truck-hazmat').value === 'true';
      t.heightM = (t.heightFt + t.heightIn / 12) * 0.3048;
      ui.saveSettings(RR.settings);
      ui.toast('Truck profile saved', 'success', util.fmtHeightM(t.heightM) + ' · ' + util.fmtWeightLb(t.weightLb) + ' · ' + t.tankGal + ' gal');
      if (state.route) {
        ui.toast('Re-checking route for new dimensions…', 'info');
        refreshCorridors().catch(() => {});
      }
    });
    $('#btn-save-ors').addEventListener('click', () => {
      RR.settings.orsKey = $('#ors-key').value.trim();
      RR.settings.truck.avoidTolls = $('#truck-avoid-tolls').checked;
      state.truck.avoidTolls = $('#truck-avoid-tolls').checked;
      ui.saveSettings(RR.settings);
      ui.toast(RR.settings.orsKey ? 'HGV routing enabled' : 'HGV routing disabled (using OSRM + on-board checks)', 'success');
    });
    $('#btn-save-alerts').addEventListener('click', () => {
      RR.settings.alertWeighMi = parseFloat($('#alert-weigh-mi').value) || 8;
      RR.settings.alertClearMi = parseFloat($('#alert-clear-mi').value) || 5;
      ui.saveSettings(RR.settings);
      ui.toast('Alert distances saved', 'success');
    });
    $('#btn-clear-custom').addEventListener('click', () => {
      if (!confirm('Remove all custom POIs?')) return;
      state.custom = { weigh: [], clear: [], fuel: [], shop: [] };
      persistCustom();
      ui.toast('Custom POIs cleared', 'info');
      if (state.route) refreshCorridors().catch(() => {});
      else refreshNearLayers();
    });

    /* ---- voice & turn-by-turn controls ---- */
    RR.voice.init();
    if (RR.voice.rec) $('#btn-mic').classList.remove('hidden');
    RR.voice.enabled = !!RR.settings.voiceOn;
    RR.voice.alertsEnabled = !!RR.settings.voiceAlerts;
    $('#btn-voice-toggle').textContent = RR.voice.enabled ? '🔊 Voice: ON' : '🔇 Voice: OFF';
    $('#voice-alerts').checked = RR.voice.alertsEnabled;
    $('#btn-mic').addEventListener('click', () => RR.voice.toggleListen());
    $('#btn-voice-toggle').addEventListener('click', () => setVoiceEnabled(!RR.voice.enabled));
    $('#voice-alerts').addEventListener('change', (e) => {
      RR.voice.alertsEnabled = e.target.checked;
      RR.settings.voiceAlerts = e.target.checked;
      ui.saveSettings(RR.settings);
    });
    $('#btn-read-route').addEventListener('click', () => {
      if (!state.route) { ui.toast('Plan a route first', 'warn'); return; }
      readRouteAloud();
    });

    /* keyboard shortcuts */
    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
      if (e.key === 'g' || e.key === 'G') $('#btn-locate').click();
      else if (e.key === 'd' || e.key === 'D') $('#btn-demo').click();
      else if (e.key === ' ' && state.sim && state.sim.running) { e.preventDefault(); state.sim.togglePause(); }
    });
  }

  /* ---------- connectivity self-test (informational) ---------- */
  async function diagConnections() {
    const checks = [
      ['routing', 'https://router.project-osrm.org/route/v1/driving/0,0;0.001,0?overview=false', 'cors'],
      ['lookup', 'https://nominatim.openstreetmap.org/search?format=jsonv2&q=x&limit=1', 'cors'],
      ['POI', 'https://overpass-api.de/api/status', 'cors'],
      ['tiles', 'https://tile.openstreetmap.org/4/7/6.png', 'no-cors']
    ];
    const results = await Promise.allSettled(checks.map(([, url, mode]) => fetch(url, { mode: mode })));
    const flags = [];
    const failed = [];
    results.forEach((r, i) => {
      /* no-cors "opaque" response still proves the host is reachable */
      const ok = r.status === 'fulfilled';
      flags.push(checks[i][0] + (ok ? ' ✓' : ' ✗'));
      if (!ok) failed.push(checks[i][0]);
    });
    if (failed.length === checks.length) {
      ui.toast('Live data unreachable', 'warn', 'All map-data APIs are blocked from this network. The app still works: routes fall back to direct lines and stations are simulated (labeled).');
      ui.setStatus('🌐 ' + flags.join(' · ') + ' — all live data blocked; using offline fallbacks');
    } else if (failed.length) {
      ui.setStatus('🌐 ' + flags.join(' · ') + ' — blocked services fall back automatically');
    } else {
      ui.setStatus('🌐 ' + flags.join(' · ') + ' — all live data OK');
    }
  }

  /* ---------- boot ---------- */
  function boot() {
    if (RR.state._booted) return;
    RR.state._booted = true;
    state.navEngine = new RR.nav.NavEngine();
    const tag = $('#build-tag');
    if (tag) tag.textContent = 'build ' + CONFIG.buildStamp;
    console.log('[RouteRig] build', CONFIG.buildStamp);
    initMap();
    wireUI();
    ui.setStatus('Ready. Plan a route, or hit GPS / DEMO DRIVE. Prices & weigh-station status are simulated.');
    ui.renderFuelList([], 'Plan a route to find cheap diesel along the way.');
    ui.renderSvcList([], 'Plan a route to find repair shops along the way.');
    /* first paint: weigh stations + fuel near default center */
    const c = state.map.getCenter();
    routing.weighAround(c.lat, c.lng, 150000, state.custom.weigh)
      .then(weighs => addWeighMarkers(weighs))
      .catch(() => addWeighMarkers(data.CURATED_WEIGH));
    routing.fuelAround(c.lat, c.lng, 30000, state.custom.fuel)
      .then(stations => { addFuelMarkers(stations); ui.renderFuelList(stations, 'Cheapest diesel within 30 mi of DFW (' + stations.length + ' stops).'); })
      .catch(() => {});
    routing.shopsAround(c.lat, c.lng, 30000, state.custom.shop)
      .then(shops => { addShopMarkers(shops); ui.renderSvcList(shops, 'Best-rated repair near DFW (' + shops.length + ' shops).'); })
      .catch(() => {});
    diagConnections();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
