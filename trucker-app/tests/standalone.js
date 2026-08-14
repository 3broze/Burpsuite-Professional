/* Verify the single-file standalone build boots and works.
 * Run: node tests/standalone.js  (requires jsdom; set JSDOMPATH if needed)
 */
'use strict';
const fs = require('fs');
const path = require('path');
const JSDOMPATH = process.env.JSDOMPATH || '/home/user/rr-tests/node_modules/jsdom';
const { JSDOM, VirtualConsole } = require(JSDOMPATH);

const FILE = process.argv[2] || path.join(__dirname, '..', 'standalone', 'RouteRig.html');
const html = fs.readFileSync(FILE, 'utf8');

const vc = new VirtualConsole();
vc.on('jsdomError', () => {});
vc.on('error', () => {});

const dom = new JSDOM(html, {
  url: 'file:///route/RouteRig.html',
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  virtualConsole: vc,
  beforeParse(window) {
    window.speechSynthesis = { speak() {}, cancel() {}, getVoices() { return []; } };
    window.SpeechSynthesisUtterance = function () {};
    const jsonRes = (obj) => ({ ok: true, status: 200, json: async () => obj });
    const routeCoords = [[-96.82, 33.15], [-96.95, 33.45], [-97.10, 33.70], [-97.15, 33.85], [-97.30, 34.10], [-97.50, 35.40]];
    window.fetch = async (url, opts) => {
      const u = String(url); const body = (opts && opts.body) || '';
      if (u.includes('nominatim')) return jsonRes([{ display_name: 'Frisco, Texas, USA', lat: '33.1507', lon: '-96.8236' }]);
      if (u.includes('route/v1')) return jsonRes({ code: 'Ok', routes: [{ distance: 260000, duration: 11000, geometry: { coordinates: routeCoords } }] });
      let els = [];
      if (body.includes('maxheight')) els = [{ type: 'way', id: 1, tags: { maxheight: "13'0\"", name: 'Test Low Bridge', bridge: 'yes' }, geometry: [{ lat: 33.85, lon: -97.15 }, { lat: 33.86, lon: -97.14 }] }];
      else if (body.includes('weighbridge')) els = [{ type: 'node', id: 2, tags: { name: 'Test Weigh Station' }, lat: 33.70, lon: -97.10 }];
      else if (body.includes('fuel')) els = [{ type: 'node', id: 3, tags: { name: "Love's Test" }, lat: 33.60, lon: -97.12 }];
      else if (body.includes('shop')) els = [{ type: 'node', id: 5, tags: { shop: 'truck_repair', name: 'Big Rig Repair' }, lat: 33.75, lon: -97.12 }];
      return jsonRes({ elements: els });
    };
  }
});

const w = dom.window;
setTimeout(async () => {
  try {
    const RR = w.RR;
    const doc = w.document;
    let fails = 0;
    const check = (n, c, x) => {
      console.log((c ? 'ok   ' : 'FAIL ') + n + (x ? '  [' + x + ']' : ''));
      if (!c) fails++;
    };
    check('app booted', !!(RR.state && RR.state.map));
    check('settings loaded', RR.state && RR.state.truck && RR.state.truck.tankGal === 150);
    check('status bar set', /Ready|🌐/.test(doc.getElementById('status-msg').textContent), doc.getElementById('status-msg').textContent.slice(0, 60));
    doc.querySelector('[data-preset="frisco-okc"]').click();
    let done = false;
    for (let i = 0; i < 40; i++) {
      await new Promise(r => setTimeout(r, 150));
      if (RR.state.route && RR.state.stations.length) { done = true; break; }
    }
    check('route planned', done, done ? (RR.state.route.meters / 1609.344).toFixed(0) + ' mi' : 'no route');
    check('clearance detected', RR.state.clears.length === 1, (RR.state.clears[0] || {}).name);
    check('weigh + fuel + shops', RR.state.weighs.length >= 1 && RR.state.stations.length >= 1 && RR.state.shops.length >= 1);
    check('summary + fuel plan', !doc.getElementById('route-summary').classList.contains('hidden')
      && !doc.getElementById('fuel-plan-card').classList.contains('hidden'));
    check('directions rendered', doc.querySelectorAll('#nav-list .dir-row').length >= 2);
    doc.getElementById('btn-demo').click();
    await new Promise(r => setTimeout(r, 7000));
    check('demo drive runs', RR.state.sim && RR.state.sim.running);
    check('alerts fire during drive', RR.state.sim.engine.announced.size >= 1, [...RR.state.sim.engine.announced].join(', '));
    doc.getElementById('hud-stop').click();
    console.log(fails === 0 ? '\n=== STANDALONE FILE WORKS ===' : '\n=== ' + fails + ' FAILURES ===');
    process.exit(fails ? 1 : 0);
  } catch (e) {
    console.log('CRASH:', e.message);
    process.exit(1);
  }
}, 1200);
