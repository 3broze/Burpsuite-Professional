/* RouteRig navigation: turn-by-turn steps, voice announcement engine */
(function (global) {
  'use strict';
  const RR = (global.RR = global.RR || {});
  const { util, geo } = RR;

  const MOD_PHRASES = {
    'uturn': 'Make a U-turn',
    'sharp left': 'Turn sharp left',
    'left': 'Turn left',
    'slight left': 'Bear left',
    'straight': 'Continue straight',
    'slight right': 'Bear right',
    'right': 'Turn right',
    'sharp right': 'Turn sharp right'
  };

  /* human-readable instruction from an OSRM maneuver */
  function maneuverText(type, modifier, name, ref, exits, destinations) {
    const nm = (name && String(name).trim()) || '';
    const rf = (ref && String(ref).trim()) || '';
    const road = nm || (rf ? 'Route ' + rf : 'the road');
    const dest = (destinations && String(destinations).trim()) || '';
    switch (type) {
      case 'depart':
        return 'Head ' + (modifier || 'out') + ' on ' + road;
      case 'arrive':
        return 'Arrive at your destination' + (nm ? ' on ' + nm : '');
      case 'merge':
        return 'Merge onto ' + road;
      case 'on ramp':
        return 'Take the ramp onto ' + road;
      case 'off ramp':
        if (exits) return 'Take exit ' + String(exits).trim() + (dest ? ' toward ' + dest : '');
        return 'Take the exit' + (dest ? ' toward ' + dest : '');
      case 'fork':
        return 'Keep ' + (modifier === 'left' ? 'left' : 'right') + ' at the fork onto ' + road;
      case 'roundabout':
      case 'rotary':
      case 'roundabout turn':
        return 'Enter the roundabout' + (exits ? ' and take exit ' + String(exits).trim() : '');
      case 'turn':
        return (MOD_PHRASES[modifier] || 'Turn') + ' onto ' + road;
      case 'new name':
      case 'continue':
      case 'notification':
        if (!modifier || modifier === 'straight') return 'Continue onto ' + road;
        return (MOD_PHRASES[modifier] || 'Continue') + ' onto ' + road;
      case 'end of road':
        return (MOD_PHRASES[modifier] || 'Turn') + ' onto ' + road;
      case 'exit rotary':
      case 'exit roundabout':
        return 'Exit the roundabout onto ' + road;
      default:
        return 'Continue' + (nm ? ' on ' + road : '');
    }
  }

  /* arrow glyph per maneuver (for HUD / directions list) */
  function arrowFor(step) {
    const t = step.type || '', m = step.modifier || '';
    if (t === 'depart') return '🟢';
    if (t === 'arrive') return '🏁';
    if (t === 'merge') return '⤴';
    if (t === 'on ramp') return '↗';
    if (t === 'off ramp') return '↘';
    if (t === 'fork') return '⇶';
    if (t === 'roundabout' || t === 'rotary' || t === 'roundabout turn' || t === 'exit roundabout' || t === 'exit rotary') return '⟳';
    const map = {
      'uturn': '↩', 'sharp left': '↰', 'left': '↰', 'slight left': '↖',
      'straight': '↑', 'slight right': '↗', 'right': '↱', 'sharp right': '↱'
    };
    return map[m] || '↑';
  }

  /* synthesize steps from raw geometry when no maneuvers are available */
  function synthSteps(coords) {
    if (!coords || coords.length < 2) return [];
    const cum = geo.cumulative(coords);
    const steps = [];
    let segStart = 0;
    let prevBearing = geo.bearingDeg(coords[0], coords[1]);
    for (let i = 1; i < coords.length - 1; i++) {
      const b = geo.bearingDeg(coords[i], coords[i + 1]);
      const delta = ((b - prevBearing + 540) % 360) - 180;
      const legLen = cum[i] - cum[segStart];
      if (Math.abs(delta) >= 28 && legLen > 150) {
        const dir = delta > 0 ? 'right' : 'left';
        const kind = Math.abs(delta) > 140 ? 'Turn sharp ' + dir : Math.abs(delta) > 70 ? 'Turn ' + dir : 'Bear ' + dir;
        /* maneuver point is the turn vertex (end of this leg) */
        steps.push({ text: kind, distM: legLen, cumM: cum[i], type: 'turn',
          modifier: Math.abs(delta) > 70 ? dir : 'slight ' + dir, name: '', ref: '', lat: coords[i][0], lng: coords[i][1] });
        segStart = i;
        prevBearing = b;
      } else if (legLen > 25000) { // long stretch -> keep list readable
        steps.push({ text: 'Continue for ' + util.fmtMi(legLen / 1609.344), distM: legLen, cumM: cum[segStart],
          type: 'continue', modifier: 'straight', name: '', ref: '', lat: coords[i][0], lng: coords[i][1] });
        segStart = i;
        prevBearing = b;
      }
    }
    steps.unshift({ text: 'Head ' + util.headingCardinal(geo.bearingDeg(coords[0], coords[1])),
      distM: 0, cumM: 0, type: 'depart', modifier: '', name: '', ref: '', lat: coords[0][0], lng: coords[0][1] });
    steps.push({ text: 'Arrive at your destination', distM: 0, cumM: cum[cum.length - 1],
      type: 'arrive', modifier: '', name: '', ref: '', lat: coords[coords.length - 1][0], lng: coords[coords.length - 1][1] });
    return steps;
  }

  /* natural spoken distance */
  function spokenDist(mi) {
    if (mi >= 2) return Math.round(mi) + ' miles';
    if (mi >= 1) return Math.round(mi * 10) / 10 + ' miles';
    if (mi >= 0.875) return 'a mile';
    if (mi >= 0.625) return 'three quarters of a mile';
    if (mi >= 0.5) return 'half a mile';
    if (mi >= 0.25) return 'a quarter of a mile';
    const ft = Math.round(mi * 5280 / 50) * 50;
    return ft + ' feet';
  }

  /* ---------------- voice announcement engine ---------------- */
  class NavEngine {
    constructor() {
      this.reset();
      this.announceLead = true;      // "In two miles, turn right…"
      this.announceAtTurn = true;    // "Turn right onto Main Street"
    }

    reset() {
      this.opt = null;
      this.steps = [];
      this.announced = new Set();
      this.current = -1;
      this.arrivedSaid = false;
      this.lastInfo = null;
    }

    setRoute(opt, steps) {
      this.opt = opt;
      this.steps = steps || [];
      this.announced = new Set();
      this.current = -1;
      this.arrivedSaid = false;
      this.lastInfo = null;
    }

    /* returns nav info {instruction, distM, arrow, road, idx} and may speak */
    tick(alongM, speedMph) {
      if (!this.opt || !this.steps || !this.steps.length) return null;
      const totalM = this.opt.meters || this.steps[this.steps.length - 1].cumM;
      let idx = 0;
      for (let i = 0; i < this.steps.length; i++) {
        if (this.steps[i].cumM <= alongM) idx = i; else break;
      }
      this.current = idx;
      const next = this.steps[idx + 1] || null;
      const info = next
        ? {
            instruction: next.text,
            distM: Math.max(0, next.cumM - alongM),
            arrow: arrowFor(next),
            road: next.name || next.ref || '',
            idx: idx + 1,
            type: next.type,
            modifier: next.modifier
          }
        : {
            instruction: 'Arrive at your destination',
            distM: Math.max(0, totalM - alongM),
            arrow: '🏁', road: '', idx: idx + 1, type: 'arrive'
          };
      this.lastInfo = info;

      if (!next) {
        if (!this.arrivedSaid) {
          this.arrivedSaid = true;
          this.say('You have arrived at your destination.');
        }
        return info;
      }

      const dMi = info.distM / 1609.344;
      /* announce progressively closer */
      const thresholds = [
        { d: 3, prefix: 'inDist' },
        { d: 1, prefix: 'inDist' },
        { d: 0.4, prefix: 'inDist' },
        { d: 0.12, prefix: 'now' }
      ];
      for (let i = 0; i < thresholds.length; i++) {
        const key = idx + ':' + i;
        if (dMi <= thresholds[i].d && !this.announced.has(key)) {
          this.announced.add(key);
          if (thresholds[i].prefix === 'now') {
            if (this.announceAtTurn) this.say(next.text);
          } else if (this.announceLead) {
            this.say('In ' + spokenDist(dMi) + ', ' + lowerFirst(next.text));
          }
          break;
        }
      }
      return info;
    }

    say(text) {
      if (RR.voice) RR.voice.speak(text);
    }
  }

  function lowerFirst(s) {
    if (!s) return s;
    const map = { 'Turn': 'turn', 'Bear': 'bear', 'Make': 'make', 'Take': 'take', 'Keep': 'keep',
      'Merge': 'merge', 'Head': 'head', 'Continue': 'continue', 'Enter': 'enter', 'Exit': 'exit' };
    for (const k in map) {
      if (s.startsWith(k + ' ')) return map[k] + s.slice(k.length);
    }
    return s;
  }

  const nav = { maneuverText, arrowFor, synthSteps, spokenDist, NavEngine, lowerFirst };
  RR.nav = nav;
  if (typeof module !== 'undefined' && module.exports) module.exports = nav;
})(typeof window !== 'undefined' ? window : globalThis);
