/* RouteRig drive: real GPS, simulated demo drive, alert engine */
(function (global) {
  'use strict';
  const RR = (global.RR = global.RR || {});
  const { CONFIG, geo, util } = RR;

  /* ---------- simulated weigh station status ---------- */
  function weighStatus(st, date) {
    const h = util.hash01(st.id + ':status');
    const open24 = h < 0.28;
    const openH = 5 + Math.floor(h * 3);            // 5,6,7
    const closeH = 18 + Math.floor(h * 4);          // 18-21
    const closedSun = h > 0.8;
    const d = date || new Date();
    if (open24) return { open: true, text: 'Open 24/7' };
    if (d.getDay() === 0 && closedSun) return { open: false, text: 'Closed Sundays' };
    const hr = d.getHours();
    if (hr >= openH && hr < closeH) return { open: true, text: 'Open until ' + closeH + ':00' };
    const nextOpen = hr < openH ? 'opens ' + openH + ':00' : 'opens ' + openH + ':00 tomorrow';
    return { open: false, text: 'Closed — ' + nextOpen };
  }

  function settings() {
    return RR.settings || { alertWeighMi: CONFIG.alertDistDefaults.weighMi, alertClearMi: CONFIG.alertDistDefaults.clearMi };
  }

  /* ---------- alert engine ---------- */
  class AlertEngine {
    constructor() {
      this.announced = new Set();
      this.proxState = {}; // hysteresis for proximity alerts
    }

    _emit(key, alert) {
      if (this.announced.has(key)) return null;
      this.announced.add(key);
      return alert;
    }

    /* route-based checks */
    checkRoute(ctx) {
      const out = [];
      const rs = ctx.rs;
      const alongMi = ctx.alongMi;
      const st = settings();

      for (const w of rs.weighs || []) {
        const ahead = w.distAlong - alongMi;
        if (ahead > 0.15 && ahead <= st.alertWeighMi) {
          const ws = weighStatus(w, ctx.simDate || new Date());
          const a = this._emit('ws:' + w.id, {
            type: 'weigh', severity: 'warn',
            title: 'Weigh station in ' + util.fmtMi(ahead),
            detail: w.name + (w.road ? ' — ' + w.road : '') + '. ' + ws.text + ' (' + CONFIG.weighStatusNote + ').',
            lat: w.lat, lng: w.lng, key: 'ws:' + w.id
          });
          if (a) out.push(a);
        }
      }
      for (const c of rs.clears || []) {
        const ahead = c.distAlong - alongMi;
        if (ahead > 0.05 && ahead <= st.alertClearMi) {
          const a = this._emit('cl:' + c.id, {
            type: 'clear', severity: c.severity || 'danger',
            title: (c.heightM != null ? 'LOW CLEARANCE ' + util.fmtHeightM(c.heightM) : 'WEIGHT LIMIT') + ' in ' + util.fmtMi(ahead),
            detail: c.name + '. ' + c.msg,
            lat: c.lat, lng: c.lng, key: 'cl:' + c.id
          });
          if (a) out.push(a);
        }
      }
      if (ctx.fuelGal != null) {
        const tank = rs.truck.tankGal;
        const pct = ctx.fuelGal / tank;
        if (pct < 0.3 && pct > 0) {
          const bucket = Math.floor(pct * 40);
          const cheap = rs.stations && rs.stations.length
            ? rs.stations.filter(s => s.distAlong > alongMi + 1 && s.crossM <= 8000).sort((a, b) => a.price - b.price)[0]
            : null;
          const a = this._emit('fuel:' + bucket, {
            type: 'fuel', severity: 'warn',
            title: 'Fuel low — ' + Math.round(pct * 100) + '% (' + Math.round(ctx.fuelGal) + ' gal)',
            detail: cheap
              ? 'Cheapest stop ahead: ' + cheap.name + ' — $' + cheap.price.toFixed(2) + '/gal in ' + util.fmtMi(cheap.distAlong - alongMi) + '.'
              : 'Plan a fuel stop soon.',
            lat: cheap ? cheap.lat : ctx.lat, lng: cheap ? cheap.lng : ctx.lng, key: 'fuel:' + bucket
          });
          if (a) out.push(a);
        }
      }
      return out;
    }

    /* proximity checks (real GPS without route) */
    checkProximity(ctx) {
      const out = [];
      const rs = ctx.rs;
      for (const w of rs.weighsNear || []) {
        const d = geo.haversineM([ctx.lat, ctx.lng], [w.lat, w.lng]);
        const st = this.proxState['ws:' + w.id] || 'far';
        if (d < 1600 && st !== 'near') {
          this.proxState['ws:' + w.id] = 'near';
          const ws = weighStatus(w, new Date());
          out.push({
            type: 'weigh', severity: 'warn',
            title: 'Weigh station ' + util.fmtDistMeters(d) + ' away',
            detail: w.name + '. ' + ws.text + ' (' + CONFIG.weighStatusNote + ').',
            lat: w.lat, lng: w.lng, key: 'wsnear:' + w.id
          });
        } else if (d > 2600) {
          this.proxState['ws:' + w.id] = 'far';
        }
      }
      for (const c of rs.clearsNear || []) {
        const d = geo.haversineM([ctx.lat, ctx.lng], [c.lat, c.lng]);
        const st = this.proxState['cl:' + c.id] || 'far';
        if (d < 1000 && st !== 'near') {
          this.proxState['cl:' + c.id] = 'near';
          out.push({
            type: 'clear', severity: c.severity || 'danger',
            title: (c.heightM != null ? 'LOW CLEARANCE ' + util.fmtHeightM(c.heightM) : 'WEIGHT LIMIT') + ' ' + util.fmtDistMeters(d) + ' away',
            detail: c.name + '. ' + c.msg,
            lat: c.lat, lng: c.lng, key: 'clnear:' + c.id
          });
        } else if (d > 1600) {
          this.proxState['cl:' + c.id] = 'far';
        }
      }
      return out;
    }
  }

  /* ---------- simulated demo drive ---------- */
  class SimDrive {
    constructor(rs) {
      this.rs = rs;
      this.timer = null;
      this.running = false;
    }

    start() {
      if (!this.rs || !this.rs.coords || this.rs.coords.length < 2) return false;
      if (this.running) this.stop(false);
      const rs = this.rs;
      this.running = true;
      this.paused = false;
      this.alongM = 0;
      this.speedMph = CONFIG.sim.baseMph;
      this.simNow = new Date();
      this.lastReal = performance.now();
      this.engine = new AlertEngine();
      this.sinkEmitted = false;
      const pos = rs.coords[0];
      RR.sink.onDriveStart({ lat: pos[0], lng: pos[1] });
      this.timer = setInterval(() => this.tick(), CONFIG.sim.tickMs);
      return true;
    }

    tick() {
      if (!this.running) return;
      const now = performance.now();
      const dtReal = Math.min(1, (now - this.lastReal) / 1000);
      this.lastReal = now;
      const rs = this.rs;
      if (!this.paused) {
        this.simNow = new Date(this.simNow.getTime() + dtReal * CONFIG.sim.timeScale * 1000);
        /* truck advances at scaled demo speed: 1 real second = timeScale sim seconds */
        this.alongM += this.speedMph * 0.44704 * dtReal * CONFIG.sim.timeScale;
        const total = rs.cum[rs.cum.length - 1];
        if (this.alongM >= total) {
          this.alongM = total;
          this.stop(true);
          return;
        }
        const fuelGal = rs.truck.tankGal * 0.95 - (this.alongM / 1609.344) / rs.truck.mpg;
        const alerts = this.engine.checkRoute({
          alongMi: this.alongM / 1609.344,
          fuelGal: Math.max(0, fuelGal),
          simDate: this.simNow,
          rs: rs
        });
        for (const a of alerts) RR.sink.alert(a);
      }
      const pos = geo.pointAtAlong(rs.coords, rs.cum, this.alongM);
      const proj = geo.projectOnLine(pos, rs.coords, rs.cum);
      const heading = proj ? proj.bearingDeg : 0;
      const remainingMi = (rs.cum[rs.cum.length - 1] - this.alongM) / 1609.344;
      const fuelGal = Math.max(0, rs.truck.tankGal * 0.95 - (this.alongM / 1609.344) / rs.truck.mpg);
      RR.sink.onTruckMove({
        lat: pos[0], lng: pos[1],
        heading: heading,
        speedMph: this.paused ? 0 : this.speedMph,
        fuelGal: fuelGal,
        simDate: this.simNow,
        paused: this.paused
      });
      /* turn-by-turn voice announcements */
      if (RR.sink.onNavTick) RR.sink.onNavTick({ alongM: this.alongM, speedMph: this.paused ? 0 : this.speedMph });
      RR.sink.onHud({
        mode: 'sim',
        speedMph: this.paused ? 0 : this.speedMph,
        heading: heading,
        fuelGal: fuelGal,
        tank: rs.truck.tankGal,
        next: this._nextInfo(fuelGal),
        etaMin: this.speedMph > 0 ? remainingMi / this.speedMph * 60 : null,
        paused: this.paused,
        remainingMi: remainingMi
      });
    }

    _nextInfo(fuelGal) {
      const rs = this.rs;
      const alongMi = this.alongM / 1609.344;
      const st = settings();
      let next = null;
      for (const w of rs.weighs || []) {
        const ahead = w.distAlong - alongMi;
        if (ahead > 0.1 && ahead <= st.alertWeighMi && (next == null || ahead < next.d)) {
          const ws = weighStatus(w, this.simNow);
          next = { d: ahead, label: '⚖️ Weigh ' + util.fmtMi(ahead) + ' — ' + ws.text };
        }
      }
      for (const c of rs.clears || []) {
        const ahead = c.distAlong - alongMi;
        if (ahead > 0.05 && ahead <= st.alertClearMi && (next == null || ahead < next.d)) {
          next = { d: ahead, label: '⚠️ ' + (c.heightM != null ? util.fmtHeightM(c.heightM) : 'Weight limit') + ' in ' + util.fmtMi(ahead) };
        }
      }
      if (fuelGal < rs.truck.tankGal * 0.3) {
        next = { d: 0, label: '⛽ Fuel ' + Math.round(fuelGal / rs.truck.tankGal * 100) + '%' };
      }
      return next ? next.label : '— clear ahead';
    }

    togglePause() {
      this.paused = !this.paused;
      return this.paused;
    }

    bumpSpeed(deltaMph) {
      this.speedMph = Math.max(30, Math.min(75, this.speedMph + deltaMph));
      return this.speedMph;
    }

    stop(completed) {
      if (this.timer) { clearInterval(this.timer); this.timer = null; }
      this.running = false;
      RR.sink.onDriveStop(!!completed);
    }
  }

  /* ---------- real GPS ---------- */
  const gps = {
    active: false,
    watchId: null,
    pos: null,
    heading: null,
    speedMph: null,
    lastFix: null,
    error: null,

    start() {
      if (!navigator.geolocation) {
        RR.sink.onGpsError('Geolocation is not supported by this browser.');
        return false;
      }
      this.active = true;
      RR.sink.onGpsStart();
      this.watchId = navigator.geolocation.watchPosition(
        (p) => this.onFix(p),
        (e) => {
          this.error = e && e.message ? e.message : 'Geolocation error';
          RR.sink.onGpsError(this.error);
        },
        { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 }
      );
      return true;
    },

    stop() {
      this.active = false;
      if (this.watchId != null) {
        navigator.geolocation.clearWatch(this.watchId);
        this.watchId = null;
      }
      RR.sink.onGpsStop();
    },

    onFix(p) {
      const c = p.coords;
      this.pos = { lat: c.latitude, lng: c.longitude };
      if (c.heading != null) this.heading = c.heading;
      if (c.speed != null) this.speedMph = c.speed * 2.23694;
      this.lastFix = new Date();
      this.error = null;
      RR.sink.onGpsFix(this);
    }
  };

  const drive = { weighStatus, AlertEngine, SimDrive, gps };
  RR.drive = drive;
  if (typeof module !== 'undefined' && module.exports) module.exports = drive;
})(typeof window !== 'undefined' ? window : globalThis);
