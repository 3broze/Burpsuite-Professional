/* RouteRig fuel: simulated diesel pricing + cheap-fuel route planner */
(function (global) {
  'use strict';
  const RR = (global.RR = global.RR || {});
  const { CONFIG, util, data } = RR;

  const MAJOR_CHAINS = ["love's", 'pilot', 'flying j', 'ta', 'petro', "buc-ee's", 'sapp bros', 'kwik trip', 'maverik', 'casey', 'road ranger', 'racetrac', 'quiktrip'];

  /* deterministic simulated diesel price (changes daily, stable within a day) */
  function dieselPrice(id, lat, lng, date) {
    const day = (date || new Date()).toISOString().slice(0, 10);
    const region = (util.hash01(lat.toFixed(1) + '|' + lng.toFixed(1)) - 0.5) * 0.30; // ±15¢ regional
    const h = util.hash01(id + '|' + day);
    const p = CONFIG.fuelPriceBase + region + (h - 0.5) * CONFIG.fuelPriceSpread;
    return Math.round(p * 100) / 100;
  }

  function brandFromName(name, id) {
    if (name) {
      const lower = name.toLowerCase();
      for (const b of data.TRUCK_BRANDS) {
        if (lower.includes(b.toLowerCase())) return b;
      }
    }
    return util.pick(data.TRUCK_BRANDS, id);
  }

  function isMajorChain(brand) {
    return MAJOR_CHAINS.includes(brand.toLowerCase());
  }

  function amenitiesFor(id, brand) {
    const h = util.hash01(id + ':amen');
    const a = [];
    if (isMajorChain(brand) || h > 0.15) a.push('Truck parking');
    if (isMajorChain(brand) || h > 0.4) a.push('Showers');
    if (h > 0.55) a.push('Scale');
    if (h > 0.3) a.push('DEF');
    if (h > 0.7) a.push('Laundry');
    if (h > 0.8) a.push('Wi-Fi');
    return a;
  }

  /* OSM element -> station object */
  function stationFromEl(el, now) {
    const id = el.type + '/' + el.id;
    const lat = el.lat != null ? el.lat : (el.center ? el.center.lat : null);
    const lng = el.lon != null ? el.lon : (el.center ? el.center.lon : null);
    if (lat == null || lng == null) return null;
    const name = (el.tags && (el.tags.name || el.tags.brand)) || null;
    const brand = brandFromName(name, id);
    return {
      id: id,
      name: name || brand + ' Travel Center',
      lat: lat, lng: lng,
      brand: brand,
      price: dieselPrice(id, lat, lng, now),
      amenities: amenitiesFor(id, brand),
      truckStop: isMajorChain(brand),
      distAlong: null, crossM: null,
      tags: el.tags || {}
    };
  }

  /* attach corridor position (distAlong = miles from route start, crossM = meters off-route) */
  function attachCorridor(stations, coords, cum) {
    const totalM = cum[cum.length - 1] || 0;
    for (const s of stations) {
      const proj = RR.geo.projectOnLine([s.lat, s.lng], coords, cum);
      if (proj) {
        s.distAlong = proj.alongM / 1609.344;
        s.crossM = proj.crossM;
        s.projLat = proj.lat;
        s.projLng = proj.lng;
      } else {
        s.distAlong = totalM / 1609.344;
        s.crossM = 1e9;
      }
    }
    return stations.filter(s => s.distAlong >= -3 && s.distAlong <= totalM / 1609.344 + 3);
  }

  /**
   * Plan cheapest refuel stops along a route.
   * stations: [{distAlong(mi), crossM(m), price, ...}]
   * Returns { stops, totalMi, rangeMi, totalCost, baseline, savings }
   */
  function buildFuelPlan(totalMeters, stations, truck) {
    const mpg = truck.mpg, tank = truck.tankGal;
    const totalMi = totalMeters / 1609.344;
    const reserve = tank * 0.1;
    let fuel = tank * 0.95;      // assume 95% at dispatch
    let alongMi = 0;
    const stops = [];
    let guard = 0;
    while (guard++ < 25) {
      const maxReach = alongMi + (fuel - reserve) * mpg;
      if (maxReach >= totalMi) break;
      const winLo = alongMi + (fuel - reserve) * mpg * 0.45;
      let pool = stations.filter(s => s.distAlong >= winLo && s.distAlong <= maxReach && s.crossM <= 5000);
      if (!pool.length) {
        /* sparse data: any station ahead within remaining range is better than running dry */
        pool = stations.filter(s => s.distAlong > alongMi + 2 && s.distAlong <= maxReach && s.crossM <= 8000);
        if (!pool.length) { stops.push({ error: true, atMi: maxReach }); break; }
      }
      const scored = pool.map(s => {
        const detourMi = Math.max(0, s.crossM * 2) / 1609.344;
        const galUsed = (s.distAlong - alongMi) / mpg;
        const fuelAt = Math.max(0, fuel - galUsed);
        const galBuy = Math.min(tank, tank - fuelAt);
        const detourGal = detourMi / mpg;
        const eff = s.price + (detourGal * s.price) / Math.max(galBuy, 1);
        return { s, galUsed, fuelAt, galBuy, eff, detourMi };
      }).sort((a, b) => a.eff - b.eff);
      const best = scored[0];
      fuel = best.fuelAt;
      alongMi = best.s.distAlong;
      const cost = best.galBuy * best.s.price;
      stops.push({ station: best.s, atMi: alongMi, galBuy: best.galBuy, cost, detourMi: best.detourMi });
      fuel = tank;
    }
    const totalCost = stops.reduce((a, s) => a + (s.cost || 0), 0);
    const avg = stations.length
      ? stations.reduce((a, s) => a + s.price, 0) / stations.length
      : CONFIG.fuelPriceBase;
    const gallonsBought = stops.reduce((a, s) => a + (s.galBuy || 0), 0);
    const baseline = (totalMi / mpg) * avg;
    const savings = gallonsBought * avg - totalCost;
    return {
      stops, totalMi, rangeMi: (tank - reserve) * mpg,
      totalCost, baseline, savings,
      needsStop: stops.length > 0 && !stops[0].error,
      avgPrice: avg
    };
  }

  /* generate simulated fuel stops every ~35 mi along a route (offline fallback) */
  function generateAlong(coords, cum) {
    const totalM = cum[cum.length - 1] || 0;
    const stations = [];
    for (let m = 40 * 1609.344; m < totalM; m += 38 * 1609.344) {
      const pos = RR.geo.pointAtAlong(coords, cum, m);
      const id = 'sim-fuel-' + Math.round(m / 1609);
      const lat = pos[0] + (util.hash01(id + ':lat') - 0.5) * 0.02;
      const lng = pos[1] + (util.hash01(id + ':lng') - 0.5) * 0.02;
      const brand = util.pick(data.TRUCK_BRANDS, id);
      stations.push({
        id: id, name: brand + ' Travel Center (simulated)', lat: lat, lng: lng,
        brand: brand, price: dieselPrice(id, lat, lng),
        amenities: ['Truck parking', 'DEF', 'Scale'],
        truckStop: true, simulated: true, tags: {},
        distAlong: m / 1609.344, crossM: 0
      });
    }
    return stations;
  }

  const fuel = { dieselPrice, stationFromEl, attachCorridor, buildFuelPlan, brandFromName, amenitiesFor, isMajorChain, generateAlong };
  RR.fuel = fuel;
  if (typeof module !== 'undefined' && module.exports) module.exports = fuel;
})(typeof window !== 'undefined' ? window : globalThis);
