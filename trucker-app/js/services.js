/* RouteRig maintenance / repair shops (live OSM + simulated ratings) */
(function (global) {
  'use strict';
  const RR = (global.RR = global.RR || {});
  const { util, data, geo } = RR;

  const TYPE_LABELS = {
    truck_repair: 'Truck repair',
    car_repair: 'Diesel / auto shop',
    tyres: 'Tire shop',
    truck: 'Truck dealer service',
    trailer: 'Trailer repair',
    car_parts: 'Parts store'
  };

  function shopFromEl(el) {
    const id = el.type + '/' + el.id;
    const lat = el.lat != null ? el.lat : (el.center ? el.center.lat : null);
    const lng = el.lon != null ? el.lon : (el.center ? el.center.lon : null);
    if (lat == null || lng == null) return null;
    const tags = el.tags || {};
    const shop = tags.shop || 'car_repair';
    const h = util.hash01(id + ':rate');
    const rating = Math.min(5, Math.round((3.4 + h * 1.6) * 10) / 10);
    const reviews = 5 + Math.floor(util.hash01(id + ':rev') * 380);
    const services = [];
    const svcPool = data.SHOP_SERVICES.slice();
    const nSvc = 3 + Math.floor(util.hash01(id + ':svc') * 4);
    for (let i = 0; i < nSvc && svcPool.length; i++) {
      const idx = Math.floor(util.hash01(id + ':svc' + i) * svcPool.length);
      services.push(svcPool.splice(idx, 1)[0]);
    }
    return {
      id: id,
      name: tags.name || (tags.brand ? tags.brand + ' Service' : 'Truck Service Center'),
      lat: lat, lng: lng,
      type: shop,
      typeLabel: TYPE_LABELS[shop] || 'Repair shop',
      rating: rating,
      reviews: reviews,
      services: services,
      phone: tags.phone || null,
      truckCapable: ['truck_repair', 'truck', 'trailer', 'tyres'].includes(shop) || h > 0.3,
      distAlong: null, crossM: null,
      tags: tags
    };
  }

  function attachCorridor(shops, coords, cum) {
    for (const s of shops) {
      const proj = geo.projectOnLine([s.lat, s.lng], coords, cum);
      if (proj) {
        s.distAlong = proj.alongM / 1609.344;
        s.crossM = proj.crossM;
      }
    }
    return shops;
  }

  function score(shop, refCrossM) {
    const crossMi = shop.crossM != null ? shop.crossM / 1609.344 : (refCrossM || 15);
    const prox = Math.max(0, 1 - Math.min(crossMi, 20) / 20);
    return shop.rating * 0.7 + prox * 0.3;
  }

  function rank(shops) {
    return shops.slice().sort((a, b) => score(b) - score(a));
  }

  /* generate simulated repair shops along a route (offline fallback) */
  function generateAlong(coords, cum) {
    const totalM = cum[cum.length - 1] || 0;
    const shops = [];
    for (let m = 60 * 1609.344; m < totalM; m += 95 * 1609.344) {
      const pos = geo.pointAtAlong(coords, cum, m);
      const id = 'sim-shop-' + Math.round(m / 1609);
      const lat = pos[0] + (util.hash01(id + ':lat') - 0.5) * 0.02;
      const lng = pos[1] + (util.hash01(id + ':lng') - 0.5) * 0.02;
      const rating = Math.min(5, Math.round((3.6 + util.hash01(id + ':rate') * 1.4) * 10) / 10);
      const svc = [];
      const pool = data.SHOP_SERVICES.slice();
      for (let i = 0; i < 3 && pool.length; i++) {
        const idx = Math.floor(util.hash01(id + ':s' + i) * pool.length);
        svc.push(pool.splice(idx, 1)[0]);
      }
      shops.push({
        id: id, name: 'Simulated Truck Service #' + Math.round(m / 1609), lat: lat, lng: lng,
        type: 'sim', typeLabel: 'Truck repair (simulated)', rating: rating, reviews: 8,
        services: svc, phone: null, truckCapable: true, simulated: true, tags: {},
        distAlong: m / 1609.344, crossM: 0
      });
    }
    return shops;
  }

  const services = { shopFromEl, attachCorridor, rank, score, generateAlong };
  RR.services = services;
  if (typeof module !== 'undefined' && module.exports) module.exports = services;
})(typeof window !== 'undefined' ? window : globalThis);
