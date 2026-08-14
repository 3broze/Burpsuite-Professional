/* RouteRig unit tests: geo parsing, fuel planning, nav engine.
 * Run: node tests/unit.js  (requires jsdom only for smoke tests — this file is pure)
 */
'use strict';
const path = require('path');
const JS = path.join(__dirname, '..', 'js');

global.window = undefined; // modules export to globalThis when window missing
require(path.join(JS, 'config.js'));
require(path.join(JS, 'util.js'));
require(path.join(JS, 'geo.js'));
require(path.join(JS, 'data.js'));
require(path.join(JS, 'fuel.js'));
require(path.join(JS, 'services.js'));
require(path.join(JS, 'nav.js'));

const geo = globalThis.RR.geo;
const fuel = globalThis.RR.fuel;
const nav = globalThis.RR.nav;
const util = globalThis.RR.util;

let fails = 0;
const eq = (n, got, want) => {
  const ok = Math.abs(got - want) < 1e-9 || got === want;
  if (!ok) { fails++; console.log('FAIL', n, 'got', got, 'want', want); }
  else console.log('ok  ', n, '=', got);
};
const ok = (n, cond, extra) => {
  console.log((cond ? 'ok   ' : 'FAIL ') + n + (extra ? '  [' + extra + ']' : ''));
  if (!cond) fails++;
};

/* ---- height parsing ---- */
eq("4.2 -> 4.2m", geo.parseHeightM('4.2'), 4.2);
eq("13'6\" -> 4.1148m", Math.round(geo.parseHeightM("13'6\"") * 10000) / 10000, 4.1148);
eq('13.5 -> feet', Math.round(geo.parseHeightM('13.5') * 10000) / 10000, 4.1148);
eq('12 ft 4 in', Math.round(geo.parseHeightM('12 ft 4 in') * 10000) / 10000, 3.7592);
eq('semicolon min', geo.parseHeightM('4.1;4.3'), 4.1);
eq('none -> null', geo.parseHeightM('none'), null);
eq('below_default', geo.parseHeightM('below_default'), 3.9);
/* ---- weight parsing ---- */
eq('7.5 tonnes', geo.parseWeightLb('7.5'), 7.5 * 2204.62);
eq('40 st', geo.parseWeightLb('40 st'), 80000);
eq('80000 lbs', geo.parseWeightLb('80000 lbs'), 80000);
eq('none -> null', geo.parseWeightLb('none'), null);
/* ---- distance ---- */
const dal = [32.7767, -96.7970], okc = [35.4676, -97.5164];
const mi = geo.haversineM(dal, okc) / 1609.344;
ok('Dallas->OKC ~190mi', mi > 170 && mi < 210, mi.toFixed(1) + ' mi');
/* ---- projection ---- */
const line = [[32.77, -96.80], [32.78, -96.79], [32.79, -96.78]];
const cum = geo.cumulative(line);
const p = geo.projectOnLine([32.78, -96.79], line, cum);
ok('projection on line', p.crossM < 30, p.crossM.toFixed(1) + 'm');
/* ---- fuel plan ---- */
const truck = { mpg: 6.5, tankGal: 150 };
const stations = [];
for (let m = 10; m < 1200; m += 25) stations.push({ distAlong: m, crossM: 0, price: 3.2 + (m % 7) * 0.05, name: 'S' + m, id: 's' + m, lat: 33, lng: -96 + m / 100 });
const plan = fuel.buildFuelPlan(1200 * 1609.344, stations, truck);
ok('fuel plan: 1 stop for 1200mi', plan.stops.length === 1, plan.stops.length + ' stops, cost $' + plan.totalCost.toFixed(0));
ok('fuel plan: positive savings', plan.savings > 0, 'save $' + plan.savings.toFixed(0));
const st = [
  { distAlong: 200, crossM: 0, price: 3.60, name: 'Expensive on-route', id: 'x1', lat: 33, lng: -96 },
  { distAlong: 200, crossM: 4000, price: 3.10, name: 'Cheap off-route', id: 'x2', lat: 33, lng: -96 }
];
const plan2 = fuel.buildFuelPlan(900 * 1609.344, st, truck);
const chosen = plan2.stops.find(s => s.atMi > 150);
ok('detour-aware: cheap off-route wins', chosen && chosen.station.name === 'Cheap off-route', chosen && chosen.station.name);
const plan3 = fuel.buildFuelPlan(300 * 1609.344, stations, truck);
ok('300mi within range -> no stop', !plan3.needsStop);
/* ---- maneuver text ---- */
eq('turn right', nav.maneuverText('turn', 'right', 'Main St', '', '', ''), 'Turn right onto Main St');
eq('off ramp exit', nav.maneuverText('off ramp', 'right', '', 'I-35', '22B', 'Downtown'), 'Take exit 22B toward Downtown');
eq('depart', nav.maneuverText('depart', 'north', 'US-75', '', '', ''), 'Head north on US-75');
eq('merge', nav.maneuverText('merge', 'slight right', 'I-635', '', '', ''), 'Merge onto I-635');
eq('arrive', nav.maneuverText('arrive', 'right', 'Main St', '', '', ''), 'Arrive at your destination on Main St');
eq('roundabout', nav.maneuverText('roundabout', 'right', '', '', '2', ''), 'Enter the roundabout and take exit 2');
eq('lowerFirst', nav.lowerFirst('Turn right onto X'), 'turn right onto X');
/* ---- synth steps ---- */
const coords = [[0, 0], [0, 0.05], [0, 0.10], [0.05, 0.10], [0.10, 0.10], [0.10, 0.15]];
const steps = nav.synthSteps(coords);
ok('synth depart/arrive', steps[0].type === 'depart' && steps[steps.length - 1].type === 'arrive');
ok('synth right turn', steps.some(s => s.type === 'turn' && s.modifier === 'right'), steps.map(s => s.text).join(' | '));
/* ---- announcement engine ---- */
const spoken = [];
globalThis.RR.voice = { speak: (t) => spoken.push(t) };
const eng = new nav.NavEngine();
const opt = {
  meters: 1609.344 * 10,
  steps: [
    { text: 'Head north on I-35', distM: 1609.344 * 4, cumM: 0, type: 'depart', modifier: '', name: 'I-35', ref: '' },
    { text: 'Turn right onto Main Street', distM: 1609.344 * 6, cumM: 1609.344 * 4, type: 'turn', modifier: 'right', name: 'Main Street', ref: '' },
    { text: 'Arrive at your destination', distM: 0, cumM: 1609.344 * 10, type: 'arrive', modifier: '', name: '', ref: '' }
  ]
};
eng.setRoute(opt, opt.steps);
let info = eng.tick(0, 0);
ok('nav info: first maneuver', info && info.instruction === 'Turn right onto Main Street', info && info.instruction);
ok('silent at 4mi', spoken.length === 0);
eng.tick(1609.344 * 1.2, 55);
ok('announce at ~2.8mi', spoken.length === 1 && /In 3 miles, turn right/.test(spoken[0]), spoken[0]);
eng.tick(1609.344 * 3.2, 55);
ok('announce at 0.8mi', spoken.length === 2 && /three quarters of a mile/.test(spoken[1]), spoken[1]);
eng.tick(1609.344 * 3.75, 55);
ok('announce at 0.25mi', spoken.length === 3 && /quarter of a mile/.test(spoken[2]), spoken[2]);
eng.tick(1609.344 * 3.92, 55);
ok('announce at turn', spoken.length === 4 && spoken[3] === 'Turn right onto Main Street', spoken[3]);
eng.tick(1609.344 * 9.5, 55);
eng.tick(1609.344 * 9.9, 55);
eng.tick(1609.344 * 10, 55);
ok('arrival spoken once', spoken.filter(s => s.includes('arrived')).length === 1);

console.log(fails === 0 ? '\nALL UNIT TESTS PASSED' : '\n' + fails + ' UNIT TESTS FAILED');
process.exit(fails ? 1 : 0);
