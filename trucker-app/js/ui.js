/* RouteRig UI: rendering, toasts, HUD, audio, event sink */
(function (global) {
  'use strict';
  const RR = (global.RR = global.RR || {});
  const { util, CONFIG } = RR;

  const $ = (sel) => document.querySelector(sel);

  RR.hooks = RR.hooks || {};

  /* ---------- overlay / status ---------- */
  function showOverlay(msg) {
    const o = $('#overlay');
    $('#overlay-msg').textContent = msg || 'Working…';
    o.classList.remove('hidden');
  }
  function hideOverlay() { $('#overlay').classList.add('hidden'); }
  function setStatus(msg) { $('#status-msg').textContent = msg; }

  /* ---------- toasts & alert feed ---------- */
  function toast(title, type, detail) {
    const wrap = $('#toasts');
    while (wrap.children.length >= 4) wrap.removeChild(wrap.firstChild);
    const t = document.createElement('div');
    t.className = 'toast ' + (type || 'info');
    t.innerHTML = '<b>' + util.esc(title) + '</b>' + (detail ? '<small>' + util.esc(detail) + '</small>' : '');
    t.title = 'Dismiss';
    t.onclick = () => t.remove();
    wrap.appendChild(t);
    setTimeout(() => { if (t.parentNode) t.remove(); }, 8000);
  }
  RR.toast = toast;

  function addFeed(a) {
    const feed = $('#alert-feed');
    const icons = { weigh: '⚖️', clear: '⚠️', fuel: '⛽', info: 'ℹ️' };
    const empty = feed.querySelector('.empty-note');
    if (empty) empty.remove();
    const el = document.createElement('div');
    el.className = 'feed-item ' + (a.severity || 'info');
    el.innerHTML =
      '<div class="f-icon">' + (icons[a.type] || icons.info) + '</div>' +
      '<div><div>' + util.esc(a.title) + '</div><div class="f-time">' + new Date().toLocaleTimeString() + ' · ' + util.esc(a.detail || '') + '</div></div>';
    el.onclick = () => RR.hooks.focus && RR.hooks.focus(a);
    feed.prepend(el);
    while (feed.children.length > 60) feed.removeChild(feed.lastChild);
  }

  /* ---------- audio ---------- */
  const audio = {
    ctx: null,
    ensure() {
      if (!this.ctx) {
        const AC = global.AudioContext || global.webkitAudioContext;
        if (AC) this.ctx = new AC();
      }
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
      return this.ctx;
    },
    tone(freq, start, dur, gain) {
      const ctx = this.ensure();
      if (!ctx) return;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + start);
      g.gain.exponentialRampToValueAtTime(gain || 0.12, ctx.currentTime + start + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
      o.connect(g); g.connect(ctx.destination);
      o.start(ctx.currentTime + start);
      o.stop(ctx.currentTime + start + dur + 0.05);
    },
    beep(type) {
      try {
        if (type === 'clear') { this.tone(880, 0, 0.16, 0.14); this.tone(880, 0.22, 0.16, 0.14); this.tone(880, 0.44, 0.2, 0.14); }
        else if (type === 'weigh') { this.tone(330, 0, 0.2, 0.11); this.tone(247, 0.28, 0.3, 0.11); }
        else if (type === 'fuel') { this.tone(523, 0, 0.22, 0.1); }
        else { this.tone(440, 0, 0.12, 0.08); }
      } catch (e) { /* audio blocked */ }
    }
  };
  RR.audio = audio;

  /* ---------- popups ---------- */
  function routeHereBtn(lat, lng) {
    return '<button class="chip" onclick="RR.hooks.routeHere(' + lat + ',' + lng + ')">Route here</button>';
  }
  function fuelPopup(s) {
    const off = s.crossM != null ? ' · <b>' + util.fmtMi(s.crossM / 1609.344) + '</b> off route' : '';
    const on = s.distAlong != null ? 'Mile <b>' + util.fmtMi(s.distAlong) + '</b> on route' + off : '';
    return '<b>' + util.esc(s.name) + '</b><br>' +
      '<span class="big-price" style="font-size:20px">' + util.fmtPrice(s.price) + '</span> /gal diesel <span style="color:#8b98a9">(simulated)</span>' +
      (s.simulated ? ' <span class="badge badge-red">OFFLINE DATA</span>' : '') + '<br>' +
      '<span class="badge badge-truck">' + util.esc(s.brand) + '</span>' +
      (s.truckStop ? '<span class="badge badge-green">Truck stop</span>' : '') + '<br>' +
      s.amenities.map(a => '<span class="badge badge-blue">' + util.esc(a) + '</span>').join(' ') + '<br>' +
      on + '<br>' + routeHereBtn(s.lat, s.lng);
  }
  function weighPopup(w) {
    const st = RR.drive.weighStatus(w, new Date());
    return '<b>' + util.esc(w.name) + '</b><br>' +
      (w.road ? util.esc(w.road) + ' · ' : '') + (w.state || '') + '<br>' +
      '<span class="badge ' + (st.open ? 'badge-green' : 'badge-red') + '">' + util.esc(st.text) + '</span> ' +
      '<span class="badge badge-truck">' + CONFIG.weighStatusNote + '</span><br>' +
      (w.curated ? '<small style="color:#8b98a9">Sample location — verify</small><br>' : '') +
      (w.distAlong != null ? 'Mile <b>' + util.fmtMi(w.distAlong) + '</b> on route' : '') +
      (w.source === 'custom' ? '<br><button class="chip" onclick="RR.hooks.removeCustom(\'' + w.id + '\',\'weigh\')">Remove POI</button>' : '');
  }
  function clearPopup(c) {
    return '<b style="color:#f85149">' + util.esc(c.name) + '</b><br>' +
      util.esc(c.msg) + '<br>' +
      (c.heightM != null ? '<span class="badge badge-red">' + util.fmtHeightM(c.heightM) + '</span>' : '') +
      (c.weightLb != null ? '<span class="badge badge-red">' + util.fmtWeightLb(c.weightLb) + '</span>' : '') +
      (c.source === 'osm' ? '<span class="badge badge-blue">OSM data</span>' : '<span class="badge badge-truck">Custom</span>') + '<br>' +
      (c.distAlong != null ? 'Mile <b>' + util.fmtMi(c.distAlong) + '</b> on route' : '') +
      (c.source === 'custom' ? '<br><button class="chip" onclick="RR.hooks.removeCustom(\'' + c.id + '\',\'clear\')">Remove POI</button>' : '');
  }
  function shopPopup(s) {
    return '<b>' + util.esc(s.name) + '</b><br>' +
      (s.simulated ? '<span class="badge badge-red">OFFLINE DATA</span>' : '') +
      '<span class="badge badge-blue">' + util.esc(s.typeLabel) + '</span>' +
      '<span class="rating">★ ' + s.rating.toFixed(1) + '</span> <small style="color:#8b98a9">(' + s.reviews + ' reviews · simulated)</small><br>' +
      s.services.slice(0, 4).map(x => '• ' + util.esc(x)).join('<br>') + '<br>' +
      (s.phone ? '📞 ' + util.esc(s.phone) + '<br>' : '') +
      (s.distAlong != null ? 'Mile <b>' + util.fmtMi(s.distAlong) + '</b> on route · ' + util.fmtMi(s.crossM / 1609.344) + ' off<br>' : '') +
      routeHereBtn(s.lat, s.lng) +
      (s.type === 'custom' ? ' <button class="chip" onclick="RR.hooks.removeCustom(\'' + s.id + '\',\'shop\')">Remove</button>' : '');
  }

  /* ---------- POI lists ---------- */
  function renderFuelList(stations, title) {
    const el = $('#fuel-list');
    $('#fuel-subhead').textContent = title || 'Cheapest diesel first.';
    if (!stations || !stations.length) {
      el.innerHTML = '<div class="empty-note">No fuel stops found here yet.<br>Plan a route or move the map and hit "Near me".</div>';
      return;
    }
    const avg = stations.reduce((a, s) => a + s.price, 0) / stations.length;
    el.innerHTML = stations.slice(0, 40).map(s => {
      const cheap = s.price < avg - 0.08;
      const where = s.distAlong != null
        ? 'Mile ' + util.fmtMi(s.distAlong) + (s.crossM > 200 ? ' · ' + util.fmtMi(s.crossM / 1609.344) + ' off' : '')
        : util.fmtDistMeters(s.distM);
      return '<div class="poi" onclick="RR.hooks.flyTo(' + s.lat + ',' + s.lng + ')">' +
        '<div class="p-main"><div class="p-name">' + util.esc(s.name) + '</div>' +
        '<div class="p-sub">' +
        '<span class="badge badge-truck">' + util.esc(s.brand) + '</span>' +
        (s.truckStop ? '<span class="badge badge-green">Truck stop</span>' : '') +
        ' ' + util.esc(s.amenities.slice(0, 3).join(' · ')) + '<br>' + where + '</div></div>' +
        '<div class="p-right"><div class="p-price' + (cheap ? '' : ' hot') + '">' + util.fmtPrice(s.price) + '</div>' +
        '<small>' + (cheap ? '⬇ cheap' : 'avg+') + '</small></div></div>';
    }).join('');
  }

  function renderSvcList(shops, title) {
    const el = $('#svc-list');
    $('#svc-subhead').textContent = title || 'Best-rated repair shops first.';
    if (!shops || !shops.length) {
      el.innerHTML = '<div class="empty-note">No repair shops found here yet.<br>Plan a route or move the map and hit "Near me".</div>';
      return;
    }
    el.innerHTML = shops.slice(0, 25).map(s => {
      const where = s.distAlong != null
        ? 'Mile ' + util.fmtMi(s.distAlong) + ' · ' + util.fmtMi(s.crossM / 1609.344) + ' off'
        : (s.distM != null ? util.fmtDistMeters(s.distM) : '');
      return '<div class="poi" onclick="RR.hooks.flyTo(' + s.lat + ',' + s.lng + ')">' +
        '<div class="p-main"><div class="p-name">' + util.esc(s.name) + '</div>' +
        '<div class="p-sub"><span class="badge badge-blue">' + util.esc(s.typeLabel) + '</span>' +
        '<span class="rating">★ ' + s.rating.toFixed(1) + '</span> <small>(' + s.reviews + ')</small><br>' +
        util.esc(s.services.slice(0, 2).join(' · ')) + '<br>' + where + '</div></div>' +
        '<div class="p-right"><small>' + (s.truckCapable ? '🚛 OK' : '') + '</small></div></div>';
    }).join('');
  }

  function renderRouteSummary(state) {
    const el = $('#route-summary');
    if (!state || !state.route) { el.classList.add('hidden'); return; }
    const r = state.route;
    const gal = r.meters / 1609.344 / state.truck.mpg;
    const avgPrice = state.stations && state.stations.length
      ? state.stations.reduce((a, s) => a + s.price, 0) / state.stations.length
      : CONFIG.fuelPriceBase;
    const clears = (state.clears || []).filter(c => c.severity === 'danger').length;
    el.classList.remove('hidden');
    el.innerHTML =
      '<h3>Route summary' + (r.label ? ' <small style="color:#ffb35c">(' + util.esc(r.label) + ')</small>' : '') + '</h3>' +
      '<div class="stat-row"><span>Distance</span><span class="v">' + util.fmtMi(r.meters / 1609.344) + '</span></div>' +
      '<div class="stat-row"><span>Est. drive time</span><span class="v">' + util.fmtClock(r.seconds || (r.meters / 24.6)) + '</span></div>' +
      '<div class="stat-row"><span>Fuel needed</span><span class="v">' + util.fmtGal(gal) + '</span></div>' +
      '<div class="stat-row"><span>Est. fuel cost</span><span class="v">' + util.fmtMoney(gal * avgPrice) + ' <small>@ ' + util.fmtPrice(avgPrice) + '/gal avg</small></span></div>' +
      '<div class="stat-row"><span>⚠️ Low clearances on route</span><span class="v" style="color:' + (clears ? '#f85149' : '#2ea44f') + '">' + clears + '</span></div>' +
      '<div class="stat-row"><span>⚖️ Weigh stations on route</span><span class="v">' + (state.weighs || []).length + '</span></div>' +
      '<div class="stat-row"><span>Engine</span><span class="v" style="font-size:12px">' + util.esc(r.engine) + '</span></div>';
  }

  function renderFuelPlanCard(plan) {
    const el = $('#fuel-plan-card');
    if (!plan) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    if (plan.error || plan.stops.some(s => s.error)) {
      el.innerHTML = '<h3>⛽ Fuel plan</h3><div class="empty-note" style="padding:8px">No mapped fuel stops cover one leg of this route — carry extra fuel or check range. Trip: ' + util.fmtMi(plan.totalMi) + ', range: ' + util.fmtMi(plan.rangeMi) + '.</div>';
      return;
    }
    if (!plan.needsStop) {
      el.innerHTML = '<h3>⛽ Fuel plan</h3><div class="empty-note" style="padding:8px">Range ' + util.fmtMi(plan.rangeMi) + ' covers the ' + util.fmtMi(plan.totalMi) + ' trip — no stop needed. See Fuel tab for cheapest top-ups.</div>';
      return;
    }
    const rows = plan.stops.map((s, i) =>
      '<div class="stat-row"><span>#' + (i + 1) + ' ' + util.esc(s.station.name) + (s.detourMi > 1 ? ' <small>+' + util.fmtMi(s.detourMi) + ' detour</small>' : '') + '</span>' +
      '<span class="v">' + util.fmtMoney(s.cost) + '</span></div>' +
      '<div class="stat-row" style="border:none;color:#8b98a9"><span>  @ ' + util.fmtPrice(s.station.price) + '/gal · ' + Math.round(s.galBuy) + ' gal · mile ' + util.fmtMi(s.atMi) + '</span><span></span></div>'
    ).join('');
    el.innerHTML =
      '<h3>⛽ Cheapest-fuel plan</h3>' + rows +
      '<div class="stat-row"><span>Planned stop cost</span><span class="v">' + util.fmtMoney(plan.totalCost) + '</span></div>' +
      '<div class="stat-row"><span>Vs. route-average price</span><span class="v" style="color:' + (plan.savings >= 0 ? '#2ea44f' : '#f85149') + '">' + (plan.savings >= 0 ? 'save ' : '+') + util.fmtMoney(Math.abs(plan.savings)) + '</span></div>' +
      '<div class="stat-row" style="border:none"><span>Trip fuel estimate @ avg</span><span class="v">' + util.fmtMoney(plan.baseline) + '</span></div>';
  }

  /* ---------- search ---------- */
  function bindSearch(input, resEl, onPick) {
    let timer = null;
    input.addEventListener('input', () => {
      /* text changed -> stored coordinates are stale */
      delete input.dataset.lat;
      delete input.dataset.lng;
      clearTimeout(timer);
      const q = input.value.trim();
      if (q.length < 3) { resEl.classList.remove('open'); return; }
      timer = setTimeout(async () => {
        try {
          const results = await RR.routing.geocode(q);
          if (input.value.trim() !== q) return;
          if (!results.length) {
            resEl.innerHTML = '<div class="res">No results — try "city, state"</div>';
          } else {
            resEl.innerHTML = results.map(r =>
              '<div class="res" data-lat="' + r.lat + '" data-lng="' + r.lon + '" data-label="' + util.esc(r.label) + '">' +
              util.esc(r.label.split(',').slice(0, 3).join(',')) + '<small>' + r.lat.toFixed(4) + ', ' + r.lon.toFixed(4) + '</small></div>'
            ).join('');
          }
          resEl.classList.add('open');
        } catch (e) {
          resEl.innerHTML = '<div class="res">Geocoder unavailable — enter "lat, lng"</div>';
          resEl.classList.add('open');
        }
      }, 400);
    });
    resEl.addEventListener('mousedown', (ev) => {
      const item = ev.target.closest('.res');
      if (!item) return;
      const lat = parseFloat(item.dataset.lat), lng = parseFloat(item.dataset.lng);
      if (!isNaN(lat) && !isNaN(lng)) {
        input.value = item.dataset.label;
        input.dataset.lat = lat;
        input.dataset.lng = lng;
        if (onPick) onPick({ lat: lat, lng: lng, label: item.dataset.label });
      }
      resEl.classList.remove('open');
    });
    input.addEventListener('blur', () => setTimeout(() => resEl.classList.remove('open'), 200));
    input.addEventListener('focus', () => { if (resEl.children.length) resEl.classList.add('open'); });
  }

  /* ---------- HUD ---------- */
  function hudVisible(on) { $('#hud').classList.toggle('hidden', !on); }
  function hudUpdate(o) {
    $('#hud-speed').textContent = Math.round(o.speedMph || 0);
    $('#hud-heading').textContent = (o.heading != null ? util.headingCardinal(o.heading) : '—') + (o.heading != null ? ' ' + Math.round(o.heading) + '°' : '');
    $('#hud-next').textContent = o.next || '—';
    if (o.fuelGal != null && o.tank) {
      const pct = Math.max(0, Math.min(1, o.fuelGal / o.tank));
      const fill = $('#hud-fuel-fill');
      fill.style.width = Math.round(pct * 100) + '%';
      fill.classList.toggle('low', pct < 0.3);
      $('#hud-fuel-pct').textContent = Math.round(pct * 100) + '%';
    }
    if (o.etaMin != null) {
      $('#hud-eta').textContent = o.etaMin >= 60
        ? Math.floor(o.etaMin / 60) + 'h ' + Math.round(o.etaMin % 60) + 'm'
        : Math.round(o.etaMin) + ' min';
    } else if (o.remainingMi != null && o.speedMph > 0) {
      $('#hud-eta').textContent = Math.round(o.remainingMi / o.speedMph * 60) + ' min';
    }
    $('#hud-pause').textContent = o.paused ? '▶' : '⏸';
  }
  function simClock(on, date) {
    const el = $('#sim-clock'), t = $('#sim-clock-t');
    el.classList.toggle('hidden', !on);
    if (on && date) t.textContent = util.timeHHMM(date);
  }

  /* ---------- settings persistence ---------- */
  function loadSettings() {
    const truck = Object.assign({}, CONFIG.truckDefaults, util.store.get('truck', {}));
    truck.heightM = (truck.heightFt + truck.heightIn / 12) * 0.3048;
    const al = Object.assign({}, CONFIG.alertDistDefaults, util.store.get('alertDist', {}));
    const orsKey = util.store.get('orsKey', '');
    let theme = util.store.get('theme', 'light');
    /* one-time migration: the old default was dark — move to readable streets */
    if (!util.store.get('themeMigrated', false)) {
      util.store.set('themeMigrated', true);
      if (theme === 'dark') theme = 'light';
      util.store.set('theme', theme);
    }
    CONFIG.ors.key = orsKey || '';
    return { truck: truck, alertWeighMi: al.weighMi, alertClearMi: al.clearMi, orsKey: orsKey, theme: theme };
  }
  function saveSettings(s) {
    util.store.set('truck', {
      heightFt: s.truck.heightFt, heightIn: s.truck.heightIn,
      weightLb: s.truck.weightLb, tankGal: s.truck.tankGal, mpg: s.truck.mpg,
      hazmat: s.truck.hazmat, avoidTolls: s.truck.avoidTolls
    });
    util.store.set('alertDist', { weighMi: s.alertWeighMi, clearMi: s.alertClearMi });
    util.store.set('orsKey', s.orsKey);
    util.store.set('theme', s.theme);
    CONFIG.ors.key = s.orsKey || '';
  }

  /* ---------- event sink (called by drive/routing modules) ---------- */
  RR.sink = {
    onDriveStart(pos) {
      if (RR.hooks.driveStart) RR.hooks.driveStart(pos);
      hudVisible(true);
      simClock(true, new Date());
      toast('Demo drive started', 'success', 'Simulated — alerts will fire along the route.');
    },
    onDriveStop(completed) {
      hudVisible(false);
      simClock(false);
      if (RR.hooks.driveStop) RR.hooks.driveStop(completed);
      toast(completed ? 'Destination reached' : 'Demo drive stopped', completed ? 'success' : 'info');
    },
    onTruckMove(o) {
      if (RR.hooks.truckMove) RR.hooks.truckMove(o);
      simClock(true, o.simDate || new Date());
    },
    onHud(o) { hudUpdate(o); },
    alert(a) {
      addFeed(a);
      toast(a.title, a.severity, a.detail);
      audio.beep(a.type);
      if (RR.hooks.alert) RR.hooks.alert(a);
    },
    onGpsStart() {
      if (RR.hooks.gpsStart) RR.hooks.gpsStart();
      hudVisible(true);
      toast('GPS tracking on', 'success');
    },
    onGpsStop() {
      if (RR.hooks.gpsStop) RR.hooks.gpsStop();
      hudVisible(false);
      toast('GPS tracking off', 'info');
    },
    onGpsFix(g) {
      if (RR.hooks.gpsFix) RR.hooks.gpsFix(g);
      hudUpdate({
        speedMph: g.speedMph || 0,
        heading: g.heading != null ? g.heading : null,
        fuelGal: null, tank: null,
        next: 'GPS live', etaMin: null,
        paused: false
      });
    },
    onGpsError(msg) {
      toast('GPS error', 'warn', msg);
      if (RR.hooks.gpsError) RR.hooks.gpsError(msg);
    }
  };

  const ui = {
    showOverlay, hideOverlay, setStatus, toast, addFeed, audio,
    renderFuelList, renderSvcList, renderRouteSummary, renderFuelPlanCard,
    bindSearch, hudVisible, hudUpdate, simClock, loadSettings, saveSettings,
    popups: { fuel: fuelPopup, weigh: weighPopup, clear: clearPopup, shop: shopPopup }
  };
  RR.ui = ui;
  RR.settings = loadSettings();
  if (typeof module !== 'undefined' && module.exports) module.exports = ui;
})(typeof window !== 'undefined' ? window : globalThis);
