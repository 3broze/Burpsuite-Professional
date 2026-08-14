# 🚛 RouteRig — Trucker GPS, Fuel & Hazard Alerts

A browser-based GPS app built for truckers: truck-aware route planning, cheap-fuel routing,
weigh-station alerts, low-clearance warnings, fuel-efficient trip planning and maintenance
spot finding — all on a live OpenStreetMap.

**Run it:** serve this folder with any static server, e.g.

```bash
cd trucker-app
python3 -m http.server 8000
```

then open <http://localhost:8000>. No build step, no backend — everything runs in the browser.

## Features

| Feature | How it works |
|---|---|
| 🛣️ **Truck routing** | Free OSRM road network + on-board truck checks. **Multiple route options** (Fastest / Shortest / Alternates) appear as chips after planning — tap to switch; hazards, fuel and services re-analyze per option. Optional: paste a free [OpenRouteService](https://openrouteservice.org) API key in the **Rig** tab for true HGV-class routing (height/weight/hazmat restrictions honored). |
| 🌐 **Works offline / firewalled** | If live APIs are unreachable, RouteRig degrades gracefully: direct-line route fallback, simulated fuel stops & repair shops generated along the route, curated weigh stations — all clearly labeled OFFLINE DATA. A boot self-test shows ✓/✗ per service (routing, lookup, POI, tiles) in the status bar. |
| 🏙️ **Offline city gazetteer** | 200+ US cities built in — typing "Dallas" or "Oklahoma City" resolves instantly with no network. Address lookup falls back across Nominatim → Photon → ArcGIS with 12s timeouts, so gateway timeouts (HTTP 504) can't block planning. The 🗺 button pins origin/destination to the map center — always works. |
| 🧭 **Turn-by-turn voice navigation** | Google-Maps-style spoken directions ("In 3 miles, turn right onto I-35… then Turn right onto Main Street") during both Demo Drive and real GPS — using your device's built-in voice. A live nav card shows the next maneuver (big arrow, road, distance), the Turn-by-Turn tab lists every step, and 📖 **Read route** speaks the whole plan aloud. |
| 🎤 **Voice commands** | Tap the 🎤 mic (Chrome/Edge) and talk: *"navigate to Dallas"*, *"demo drive"*, *"stop"*, *"mute"*, *"voice on"*, *"fuel"*, *"zoom in"*, *"where am I"*, *"read route"*. |
| 📱 **Mobile app (PWA)** | Installable on your phone like a real app (Android/iOS): tap 📲 Install or use "Add to Home Screen". Full-screen, bottom-sheet layout on phones, offline app shell, home-screen icon. |
| ⚠️ **Low-clearance warnings** | Live OSM `maxheight` / `maxheight:physical` / `maxweight` data queried along your route corridor. Anything under your rig's height (default 13'6") triggers a red alert with the exact clearance — including alerts while driving. |
| ⚖️ **Weigh-station alerts** | Live OSM weighbridge data + a curated list of known weigh stations + your own custom POIs. Status (open/closed) is **simulated** from time-of-day. Alerts fire X miles ahead (configurable) during the drive. |
| ⛽ **Cheap-fuel routes** | Live fuel stops from OSM with **simulated** (realistic, deterministic daily) diesel prices. The fuel planner figures out where to stop given your tank/MPG, compares stop cost vs. route-average price, and includes detour cost so a cheaper stop 2 miles off-route still wins when it pays. |
| 🔧 **Best maintenance spots** | Truck repair / diesel shops / tire shops along your route, ranked by rating × proximity, with service specialties (all ratings simulated). |
| 📡 **Real GPS mode** | Uses the device's geolocation (speed, heading, position). Proximity alerts fire near weigh stations and low structures even without a planned route. |
| ▶ **Demo Drive mode** | A virtual rig drives your route at ~450× time so you can watch weigh-station and low-clearance alerts fire (with audio beeps) — no need to leave your desk. |
| ✏️ **Custom POIs** | Right-click the map to add your own weigh stations, low clearances, fuel stops or shops. Stored on your device (localStorage). |

## Quick start

1. Click a **demo haul** preset (e.g. *Frisco TX → Oklahoma City*) or type any two places and hit **PLAN ROUTE**.
2. The map fills in: route, low clearances, weigh stations, fuel stops and repair shops. Tabs show the cheapest fuel, the fuel-stop plan, and ranked shops.
3. Hit **▶ DEMO DRIVE** to drive the route with live alerts, or **GPS** to use your real position.
4. Set your rig's height/weight/tank/MPG in the **Rig** tab — route checks re-run automatically.

**Keyboard:** `G` GPS · `D` demo drive · `Space` pause/resume demo drive.
**Voice:** tap 🎤 and say *"navigate to Dallas"*, *"demo drive"*, *"stop"*, *"mute"*, *"read route"*.

**Install on your phone:** open the app in Chrome (Android) or Safari (iOS) and tap **📲 Install** / **Share → Add to Home Screen**. It runs full-screen with an app icon and works offline for the app shell (live map data still needs internet).

## GPS & current location

- **Tap GPS** (top bar) — the browser asks for location permission; allow it once.
- **Leave Origin blank** and type only a destination — the route starts from your live position automatically.
- **Preview window blocks GPS?** The location-help dialog has an **↗ Open in new tab** button — browser location prompts work reliably in a real tab (or the standalone `RouteRig.html`).
- **No signal / denied?** The dialog offers **📍 Approx. location** (city-level via IP) and the 🗺 map-center buttons — routes plan either way.

## Troubleshooting

- **"Route planning failed"** — the status bar names the failing step (lookup / routing / live data) and the toast shows the exact API error. RouteRig retries geocoding on two providers (Nominatim + Photon) and routing on two OSRM servers. If everything fails, the boot self-test shows "Live data unreachable" — the app needs internet for tiles + OSM APIs; check your firewall/VPN.
- **Route shows but no fuel/weigh/clearance pins** — the Overpass API was busy; the route still stands and a warning toast says which dataset was skipped. Retry in a minute.
- **Want true truck routing?** Add a free OpenRouteService key in the Rig tab; without it, routing uses OSRM plus this app's own clearance/weight corridor checks.

## Data sources & honesty notes

- **Live data:** OpenStreetMap via the Overpass API (fuel stops, shops, weighbridges, clearance tags), Nominatim geocoding, OSRM routing, CARTO/OSM map tiles.
- **Simulated:** diesel prices (realistic deterministic daily values), weigh-station open/closed status, shop ratings/reviews. Verify before dispatch.
- **Curated weigh stations:** approximate coordinates compiled from public DOT information — treat as *sample data*.
- **Default routing** uses OSRM's car profile plus this app's own clearance/weight checks along the corridor. For legal truck routing, add an OpenRouteService key (free tier) in the Rig tab.

## Tech

Vanilla JS + Leaflet (vendored locally — no CDN dependency), no build step. Modular source in `js/`, tested with node-based unit tests and a jsdom end-to-end smoke suite.
