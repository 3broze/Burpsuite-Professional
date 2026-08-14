/* RouteRig end-to-end smoke tests (jsdom).
 * Run: node tests/smoke.js  (requires jsdom: npm i jsdom, see README)
 * Set JSDOMPATH if jsdom lives elsewhere.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const JSDOMPATH = process.env.JSDOMPATH || '/home/user/rr-tests/node_modules/jsdom';
const { JSDOM } = require(JSDOMPATH);

const APP = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(APP, 'index.html'), 'utf8');

function makeDom() {
  const dom = new JSDOM(html, { url: 'http://localhost:8000/', runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  w.speechSynthesis = { speak(u) { w.__spoken.push(u.text); }, cancel() {}, getVoices() { return []; } };
  w.SpeechSynthesisUtterance = function (t) { this.text = t; };
  w.__spoken = [];
  const layerFake = () => {
    const f = { clearLayers() {}, addLayer() { return f; }, removeLayer() { return f; }, addTo() { return f; },
      bindPopup() { return f; }, setLatLng() { return f; }, getElement() { return null; },
      getLatLng() { return { lat: 33, lng: -97 }; }, openPopup() {}, on() { return f; }, remove() {},
      panTo() {}, flyTo() {}, setView() { return f; } };
    return f;
  };
  w.L = {
    map: () => ({ setView() { return this; }, addLayer() {}, removeLayer() {}, on() {},
      getCenter: () => ({ lat: 33.0, lng: -97.0 }), getZoom: () => 8, fitBounds() {}, flyTo() {},
      panTo() {}, getSize: () => ({ x: 1200, y: 800 }), latLngToContainerPoint: () => ({ x: 20, y: 20 }) }),
    tileLayer: layerFake,
    markerClusterGroup: () => Object.assign(layerFake(), { clearLayers() {} }),
    layerGroup: layerFake, marker: layerFake, polyline: layerFake,
    divIcon: () => ({}), DomEvent: { stop() {} }
  };
  return { dom, w };
}

const JS_FILES = ['vendor/leaflet/leaflet.js', 'vendor/markercluster/leaflet.markercluster.js',
  'js/config.js', 'js/util.js', 'js/geo.js', 'js/nav.js', 'js/icons.js', 'js/data.js',
  'js/overpass.js', 'js/fuel.js', 'js/services.js', 'js/routing.js',
  'js/drive.js', 'js/ui.js', 'js/voice.js', 'js/app.js'];

function loadApp(w) {
  for (const s of JS_FILES) w.eval(fs.readFileSync(path.join(APP, s), 'utf8'));
  if (!w.RR.state._booted) w.document.dispatchEvent(new w.Event('DOMContentLoaded', { bubbles: true }));
}

const wait = (ms) => new Promise(r => setTimeout(r, ms));
const jsonRes = (obj) => ({ ok: true, status: 200, json: async () => obj });

/* ---------- scenario A: live APIs + 2 route options + turn-by-turn voice ---------- */
async function scenarioA() {
  const { w } = makeDom();
  const r1 = {
    distance: 260000, duration: 11000,
    geometry: { coordinates: [[-96.82, 33.15], [-96.95, 33.45], [-97.10, 33.70], [-97.15, 33.85], [-97.30, 34.10], [-97.50, 35.40]] },
    legs: [{ steps: [
      { name: 'US-75', ref: '', maneuver: { type: 'depart', modifier: 'north', location: [-96.82, 33.15] }, distance: 120000, duration: 5000 },
      { name: 'I-35', ref: '', maneuver: { type: 'turn', modifier: 'right', location: [-97.05, 33.80] }, distance: 140000, duration: 6000 },
      { name: '', ref: '', maneuver: { type: 'arrive', modifier: 'right', location: [-97.50, 35.40] }, distance: 0, duration: 0 }
    ] }]
  };
  const r2 = {
    distance: 275000, duration: 12200,
    geometry: { coordinates: [[-96.82, 33.15], [-96.90, 33.50], [-97.05, 33.80], [-97.35, 34.20], [-97.60, 35.40]] },
    legs: [{ steps: [
      { name: 'US-75', ref: '', maneuver: { type: 'depart', modifier: 'north', location: [-96.82, 33.15] }, distance: 8000, duration: 300 },
      { name: 'I-35', ref: '', maneuver: { type: 'turn', modifier: 'right', location: [-97.10, 34.00] }, distance: 267000, duration: 11900 },
      { name: '', ref: '', maneuver: { type: 'arrive', modifier: 'right', location: [-97.60, 35.40] }, distance: 0, duration: 0 }
    ] }]
  };
  w.fetch = async (url, opts) => {
    const u = String(url); const body = (opts && opts.body) || '';
    if (u.includes('nominatim')) return jsonRes([{ display_name: 'Frisco, Texas, USA', lat: '33.1507', lon: '-96.8236' }]);
    if (u.includes('route/v1')) return jsonRes({ code: 'Ok', routes: [r1, r2] });
    let els = [];
    if (body.includes('maxheight')) els = [
      { type: 'way', id: 1, tags: { maxheight: "13'0\"", name: 'Test Low Bridge', bridge: 'yes' }, geometry: [{ lat: 33.85, lon: -97.15 }, { lat: 33.86, lon: -97.14 }] },
      { type: 'way', id: 9, tags: { maxheight: "18'4\"", name: 'Tall Overpass (skipped)' }, geometry: [{ lat: 33.50, lon: -97.00 }, { lat: 33.52, lon: -96.98 }] },
      { type: 'way', id: 10, tags: { maxweight: '40 st', name: 'Weight OK bridge' }, geometry: [{ lat: 34.10, lon: -97.30 }, { lat: 34.12, lon: -97.28 }] }
    ];
    else if (body.includes('weighbridge')) els = [{ type: 'node', id: 2, tags: { name: 'Test Weigh Station' }, lat: 33.70, lon: -97.10 }];
    else if (body.includes('fuel')) els = [{ type: 'node', id: 3, tags: { name: "Love's Test" }, lat: 33.60, lon: -97.12 }];
    else if (body.includes('shop')) els = [{ type: 'node', id: 5, tags: { shop: 'truck_repair', name: 'Big Rig Repair' }, lat: 33.75, lon: -97.12 }];
    return jsonRes({ elements: els });
  };
  loadApp(w);
  await wait(200);
  const RR = w.RR, doc = w.document;
  let fails = 0;
  const check = (n, c, x) => { console.log((c ? 'ok   ' : 'FAIL ') + n + (x ? '  [' + x + ']' : '')); if (!c) fails++; };

  doc.querySelector('[data-preset="frisco-okc"]').click();
  for (let i = 0; i < 40; i++) { await wait(150); if (RR.state.route && RR.state.routeOptions && RR.state.routeOptions.length === 2) break; }
  check('two route options', RR.state.routeOptions.length === 2, RR.state.routeOptions.map(o => o.label).join(', '));
  check('option chips rendered', doc.querySelectorAll('#route-opt-chips .option-chip').length === 2);
  check('live corridor data loaded', RR.state.weighs.length >= 1 && RR.state.stations.length >= 1);
  check('only real hazards kept', RR.state.clears.length === 1 && RR.state.clears[0].id === 'cl-way-1', RR.state.clears.map(c => c.name).join(', '));
  const metersBefore = RR.state.route.meters;
  doc.querySelectorAll('#route-opt-chips .option-chip')[1].click();
  for (let i = 0; i < 30; i++) { await wait(150); if (RR.state.route.meters !== metersBefore) break; }
  check('option switch works', RR.state.route.meters === 275000);
  check('steps parsed from OSRM', RR.state.route.steps.length >= 3, RR.state.route.steps.map(s => s.text).join(' | '));
  check('directions list rendered', doc.querySelectorAll('#nav-list .dir-row').length >= 3);
  check('nav card shows first maneuver', !doc.getElementById('nav-card').classList.contains('hidden')
    && doc.getElementById('nav-instruction').textContent.indexOf('Turn right') === 0, doc.getElementById('nav-instruction').textContent);
  const spokenBefore = w.__spoken.length;
  doc.getElementById('btn-demo').click();
  await wait(400);
  check('demo drive runs', RR.state.sim && RR.state.sim.running);
  await wait(6000);
  check('voice announced a maneuver', w.__spoken.length > spokenBefore, w.__spoken.slice(spokenBefore).join(' || '));
  check('announcement text', w.__spoken.some(t => /turn right onto I-35/i.test(t)));
  doc.getElementById('hud-stop').click();
  return fails;
}

/* ---------- scenario B: all APIs unreachable (network throws) ---------- */
async function scenarioB() {
  const { w } = makeDom();
  w.fetch = async () => { throw new Error('network blocked'); };
  loadApp(w);
  await wait(200);
  const RR = w.RR, doc = w.document;
  let fails = 0;
  const check = (n, c, x) => { console.log((c ? 'ok   ' : 'FAIL ') + n + (x ? '  [' + x + ']' : '')); if (!c) fails++; };
  doc.querySelector('[data-preset="frisco-okc"]').click();
  for (let i = 0; i < 40; i++) { await wait(150); if (RR.state.route) break; }
  check('route planned despite blocked network', !!RR.state.route, RR.state.route && RR.state.route.engine);
  check('fallback engine labeled', RR.state.route && RR.state.route.engine.indexOf('Fallback') === 0);
  check('simulated fuel stations', RR.state.stations.length >= 2, RR.state.stations.length + ' stations');
  check('simulated shops', RR.state.shops.length >= 1);
  check('fuel list + plan rendered', doc.getElementById('fuel-list').children.length >= 2 && !doc.getElementById('fuel-plan-card').classList.contains('hidden'));
  check('no failure state', doc.getElementById('status-msg').textContent.indexOf('failed') === -1);
  check('offline turn-by-turn steps', RR.state.route.steps && RR.state.route.steps.length >= 2, RR.state.route.steps.map(s => s.text).join(' | '));
  doc.getElementById('btn-demo').click();
  await wait(300);
  check('demo drive works offline', RR.state.sim && RR.state.sim.running);
  doc.getElementById('hud-stop').click();
  return fails;
}

/* ---------- scenario C: every API returns HTTP 504; typed city names ---------- */
async function scenarioC() {
  const { w } = makeDom();
  w.fetch = async () => ({ ok: false, status: 504, json: async () => ({}) });
  loadApp(w);
  await wait(200);
  const RR = w.RR, doc = w.document;
  let fails = 0;
  const check = (n, c, x) => { console.log((c ? 'ok   ' : 'FAIL ') + n + (x ? '  [' + x + ']' : '')); if (!c) fails++; };
  const o = doc.getElementById('in-origin'), d = doc.getElementById('in-dest');
  o.value = 'Dallas';
  d.value = 'Oklahoma City';
  doc.getElementById('btn-route').click();
  for (let i = 0; i < 60; i++) { await wait(150); if (RR.state.route) break; }
  check('route planned despite 504 on all APIs', !!RR.state.route, RR.state.route && RR.state.route.engine);
  check('offline gazetteer: Dallas', RR.state.originLL && Math.abs(RR.state.originLL.lat - 32.7767) < 0.1, RR.state.originLL && RR.state.originLL.label);
  check('offline gazetteer: Oklahoma City', RR.state.destLL && Math.abs(RR.state.destLL.lat - 35.4676) < 0.1, RR.state.destLL && RR.state.destLL.label);
  check('fallback route used', RR.state.route && RR.state.route.engine.indexOf('Fallback') === 0);
  check('no failure toast', doc.getElementById('status-msg').textContent.indexOf('failed') === -1, doc.getElementById('status-msg').textContent.slice(0, 80));

  /* auto-origin: destination only + live GPS position */
  RR.drive.gps.pos = { lat: 33.15, lng: -96.82 };
  o.value = '';
  d.value = 'Houston';
  delete d.dataset.lat;
  delete d.dataset.lng;
  doc.getElementById('btn-route').click();
  for (let i = 0; i < 40; i++) { await wait(150); if (RR.state.route && RR.state.originLL) break; }
  check('route planned from current GPS (blank origin)', !!RR.state.route && RR.state.originLL &&
    Math.abs(RR.state.originLL.lat - 33.15) < 0.01, RR.state.originLL && RR.state.originLL.label);
  check('origin field shows GPS label', doc.getElementById('in-origin').value.indexOf('GPS') >= 0, doc.getElementById('in-origin').value);
  return fails;
}

(async () => {
  console.log('--- Scenario A: live APIs + route options + voice ---');
  const fa = await scenarioA();
  console.log('--- Scenario B: fully blocked network ---');
  const fb = await scenarioB();
  console.log('--- Scenario C: HTTP 504 everywhere + auto-origin ---');
  const fc = await scenarioC();
  const total = fa + fb + fc;
  console.log(total === 0 ? '\n=== ALL SMOKE TESTS PASSED ===' : '\n=== FAILURES: ' + total + ' ===');
  process.exit(total ? 1 : 0);
})().catch(e => { console.log('CRASH', e); process.exit(1); });
