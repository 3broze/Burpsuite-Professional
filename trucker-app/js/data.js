/* RouteRig curated data: known weigh stations, famous low clearances, presets.
 * NOTE: curated weigh-station coordinates are approximate, compiled from public
 * DOT information — treat as sample data and verify before dispatch.
 * Live OpenStreetMap (Overpass) data supplements this at runtime.
 */
(function (global) {
  'use strict';
  const RR = (global.RR = global.RR || {});

  const CURATED_WEIGH = [
    { id: 'ws-sierra-blanca', name: 'Sierra Blanca Weigh Station', lat: 31.1720, lng: -105.3580, road: 'I-10 (EB/WB)', state: 'TX', dir: 'both' },
    { id: 'ws-laredo', name: 'Laredo Weigh Station', lat: 27.5270, lng: -99.5030, road: 'I-35 (NB)', state: 'TX', dir: 'nb' },
    { id: 'ws-vinton', name: 'Vinton / West El Paso Weigh Station', lat: 31.9580, lng: -106.6550, road: 'I-10 (WB)', state: 'TX', dir: 'wb' },
    { id: 'ws-perry', name: 'Perry Weigh Station', lat: 36.2780, lng: -97.2720, road: 'I-35 (NB)', state: 'OK', dir: 'nb' },
    { id: 'ws-gallup', name: 'Gallup Port of Entry / Weigh', lat: 35.5050, lng: -108.7000, road: 'I-40 (EB)', state: 'NM', dir: 'eb' },
    { id: 'ws-west-memphis', name: 'West Memphis Weigh Station', lat: 35.1460, lng: -90.2200, road: 'I-40 (WB)', state: 'AR', dir: 'wb' },
    { id: 'ws-san-antonio-ne', name: 'San Antonio NE Weigh Station', lat: 29.5890, lng: -98.3420, road: 'I-35 (NB)', state: 'TX', dir: 'nb' },
    { id: 'ws-waskom', name: 'Waskom Weigh Station', lat: 32.4780, lng: -94.0750, road: 'I-20 (EB)', state: 'TX', dir: 'eb' },
    { id: 'ws-huntsville', name: 'Huntsville Weigh Station', lat: 30.7410, lng: -95.5210, road: 'I-45 (NB)', state: 'TX', dir: 'nb' },
    { id: 'ws-corsicana', name: 'Corsicana Weigh Station', lat: 32.1300, lng: -96.4700, road: 'I-45 (SB)', state: 'TX', dir: 'sb' },
    { id: 'ws-temple', name: 'Temple Weigh Station', lat: 31.1250, lng: -97.3850, road: 'I-35 (SB)', state: 'TX', dir: 'sb' },
    { id: 'ws-las-cruces', name: 'Las Cruces Port of Entry', lat: 32.2700, lng: -106.7700, road: 'I-10 (WB)', state: 'NM', dir: 'wb' },
    { id: 'ws-eloy', name: 'Eloy Weigh Station', lat: 32.7600, lng: -111.5900, road: 'I-10 (EB)', state: 'AZ', dir: 'eb' },
    { id: 'ws-goodland', name: 'Goodland Weigh Station', lat: 39.3300, lng: -101.7200, road: 'I-70 (WB)', state: 'KS', dir: 'wb' }
  ];

  const CURATED_CLEARANCES = [
    {
      id: 'cl-11foot8', name: 'Norfolk Southern Trestle ("11foot8")', lat: 35.99958, lng: -78.91045,
      road: 'S Gregson St, Durham NC', heightM: 12.33 * 0.0254 * 12 + 4 * 0.0254, // 12'4"
      note: 'Famous crash bridge, raised in 2019 to ~12\'4"'
    },
    {
      id: 'cl-smalley', name: 'Smalley Viaduct (US-31W, Louisville KY)', lat: 38.2260, lng: -85.7620,
      road: 'US-31W / Dixie Hwy', heightM: (11 * 12 + 8) * 0.0254,
      note: 'Historic low viaduct — sample data'
    }
  ];

  const TRUCK_BRANDS = [
    "Love's", "Pilot", "Flying J", "TA", "Petro", "Buc-ee's", "Shell", "Chevron",
    "Exxon", "Casey's", "QuikTrip", "Road Ranger", "Sapp Bros", "Kwik Trip",
    "Maverik", "RaceTrac", "Circle K", "Sinclair", "Valero", "Murphy USA"
  ];

  const SHOP_TYPES = [
    { key: 'truck_repair', label: 'Truck repair' },
    { key: 'car_repair', label: 'Diesel / auto shop' },
    { key: 'tyres', label: 'Tires' },
    { key: 'truck', label: 'Truck dealer service' },
    { key: 'trailer', label: 'Trailer repair' }
  ];

  const SHOP_SERVICES = [
    'Diesel engines', 'Brakes', 'Transmission', 'Suspension', 'Electrical',
    'Cooling system', 'DOT inspections', 'Welding', 'Alignments', '24/7 towing',
    'Mobile repair', 'APU service', 'Reefer service', 'Tire mounting'
  ];

  const PRESETS = {
    'frisco-okc': { origin: 'Frisco, TX, USA', dest: 'Oklahoma City, OK, USA', oFallback: [33.1507, -96.8236], dFallback: [35.4676, -97.5164] },
    'dallas-houston': { origin: 'Dallas, TX, USA', dest: 'Houston, TX, USA', oFallback: [32.7767, -96.7970], dFallback: [29.7604, -95.3698] },
    'dallas-elpaso': { origin: 'Dallas, TX, USA', dest: 'El Paso, TX, USA', oFallback: [32.7767, -96.7970], dFallback: [31.7619, -106.4850] }
  };

  const data = { CURATED_WEIGH, CURATED_CLEARANCES, TRUCK_BRANDS, SHOP_TYPES, SHOP_SERVICES, PRESETS };
  RR.data = data;
  if (typeof module !== 'undefined' && module.exports) module.exports = data;
})(typeof window !== 'undefined' ? window : globalThis);
