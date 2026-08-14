/* RouteRig configuration */
(function (global) {
  'use strict';
  const CONFIG = {
    appName: 'RouteRig',
    defaultCenter: [32.985, -96.83], // Frisco / DFW area
    defaultZoom: 8,
    geocoder: 'https://nominatim.openstreetmap.org/search',
    geocoders: [
      'https://nominatim.openstreetmap.org/search',
      'https://photon.komoot.io/api/'
    ],
    osrm: 'https://router.project-osrm.org/route/v1/driving/',
    osrmServers: [
      'https://router.project-osrm.org/route/v1/driving/',
      'https://routing.openstreetmap.de/routed-car/route/v1/driving/'
    ],
    ors: {
      base: 'https://api.openrouteservice.org/v2/directions/driving-hgv',
      key: ''
    },
    overpassEndpoints: [
      'https://overpass-api.de/api/interpreter',
      'https://overpass.kumi.systems/api/interpreter',
      'https://overpass.private.coffee/api/interpreter'
    ],
    overpassTimeout: 40000,
    tiles: {
      light: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
      dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    },
    tileAttribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    // truck defaults (13'6" / 80,000 lb / 150 gal / 6.5 mpg)
    truckDefaults: { heightFt: 13, heightIn: 6, weightLb: 80000, tankGal: 150, mpg: 6.5, hazmat: false, avoidTolls: false },
    alertDistDefaults: { weighMi: 8, clearMi: 5 },
    sim: { baseMph: 58, timeScale: 450, tickMs: 250 },
    fuelPriceBase: 3.34,      // simulated national average diesel
    fuelPriceSpread: 0.52,
    maxHeightMarginM: 0.08,   // alert if clearance < truck height + this
    maxHeightCautionM: 0.30,  // caution band
    weighStatusNote: 'Simulated status'
  };
  global.RR = global.RR || {};
  global.RR.CONFIG = CONFIG;
  if (typeof module !== 'undefined' && module.exports) module.exports = CONFIG;
})(typeof window !== 'undefined' ? window : globalThis);
