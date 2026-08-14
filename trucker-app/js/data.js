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

const US_CITIES = [
["Dallas","TX",32.7767,-96.7970],["Houston","TX",29.7604,-95.3698],["San Antonio","TX",29.4241,-98.4936],["Austin","TX",30.2672,-97.7431],
["Fort Worth","TX",32.7555,-97.3308],["El Paso","TX",31.7619,-106.4850],["Arlington","TX",32.7357,-97.1081],["Corpus Christi","TX",27.8006,-97.3964],
["Plano","TX",33.0198,-96.6989],["Lubbock","TX",33.5779,-101.8552],["Laredo","TX",27.5306,-99.4803],["Amarillo","TX",35.2220,-101.8313],
["Garland","TX",32.9126,-96.6389],["Irving","TX",32.8140,-96.9489],["Frisco","TX",33.1507,-96.8236],["McKinney","TX",33.1972,-96.6398],
["Waco","TX",31.5493,-97.1467],["Midland","TX",31.9973,-102.0779],["Odessa","TX",31.8457,-102.3676],["Abilene","TX",32.4487,-99.7331],
["Beaumont","TX",30.0802,-94.1266],["Tyler","TX",32.3513,-95.3011],["Longview","TX",32.5007,-94.7405],["Wichita Falls","TX",33.9137,-98.4934],
["Brownsville","TX",25.9017,-97.4975],["Texarkana","TX",33.4251,-94.0477],["Lufkin","TX",31.3382,-94.7291],["Sherman","TX",33.6357,-96.6089],
["Denton","TX",33.2148,-97.1331],["Killeen","TX",31.1171,-97.7278],["Temple","TX",31.0982,-97.3428],["College Station","TX",30.6280,-96.3344],
["San Angelo","TX",31.4638,-100.4370],["Victoria","TX",28.8053,-97.0036],["Harlingen","TX",26.1906,-97.6961],["McAllen","TX",26.2034,-98.2300],
["Galveston","TX",29.3013,-94.7977],["Mesquite","TX",32.7668,-96.5992],["Grand Prairie","TX",32.7459,-96.9978],["Lewisville","TX",33.0462,-96.9942],
["Round Rock","TX",30.5083,-97.6789],["Sugar Land","TX",29.6197,-95.6349],["Oklahoma City","OK",35.4676,-97.5164],["Tulsa","OK",36.1540,-95.9928],
["Norman","OK",35.2226,-97.4395],["Lawton","OK",34.6036,-98.3959],["Edmond","OK",35.6528,-97.4781],["Stillwater","OK",36.1156,-97.0584],
["Albuquerque","NM",35.0844,-106.6504],["Las Cruces","NM",32.3199,-106.7637],["Santa Fe","NM",35.6870,-105.9378],["Roswell","NM",33.3943,-104.5230],
["Carlsbad","NM",32.4207,-104.2288],["Gallup","NM",35.5281,-108.7426],["Hobbs","NM",32.7026,-103.1360],["Clovis","NM",34.4048,-103.2052],
["Little Rock","AR",34.7465,-92.2896],["Fort Smith","AR",35.3859,-94.3985],["Fayetteville","AR",36.0626,-94.1574],["Jonesboro","AR",35.8423,-90.7043],
["Pine Bluff","AR",34.2284,-92.0032],["Hot Springs","AR",34.5037,-93.0552],["New Orleans","LA",29.9511,-90.0715],["Baton Rouge","LA",30.4515,-91.1871],
["Shreveport","LA",32.5252,-93.7502],["Lafayette","LA",30.2241,-92.0198],["Lake Charles","LA",30.2266,-93.2174],["Monroe","LA",32.5093,-92.1193],
["Wichita","KS",37.6872,-97.3301],["Kansas City","KS",39.1141,-94.6275],["Topeka","KS",39.0473,-95.6752],["Salina","KS",38.8403,-97.6114],
["Dodge City","KS",37.7528,-100.0171],["Garden City","KS",37.9717,-100.8727],["Kansas City","MO",39.0997,-94.5786],["St. Louis","MO",38.6270,-90.1994],
["Springfield","MO",37.2089,-93.2923],["Columbia","MO",38.9517,-92.3341],["Joplin","MO",37.0842,-94.5133],["St. Joseph","MO",39.7675,-94.8467],
["Denver","CO",39.7392,-104.9903],["Colorado Springs","CO",38.8339,-104.8214],["Pueblo","CO",38.2544,-104.6091],["Fort Collins","CO",40.5853,-105.0844],
["Grand Junction","CO",39.0639,-108.5506],["Limon","CO",39.2639,-103.6922],["Omaha","NE",41.2565,-95.9345],["Lincoln","NE",40.8136,-96.7026],
["Grand Island","NE",40.9264,-98.3420],["North Platte","NE",41.1239,-100.7654],["Ogallala","NE",41.1282,-101.7202],["Kearney","NE",40.6993,-99.0815],
["Sioux Falls","SD",43.5446,-96.7311],["Rapid City","SD",44.0806,-103.2310],["Fargo","ND",46.8772,-96.7898],["Bismarck","ND",46.8083,-100.7837],
["Minneapolis","MN",44.9778,-93.2650],["St. Paul","MN",44.9537,-93.0900],["Duluth","MN",46.7867,-92.1005],["Rochester","MN",44.0121,-92.4802],
["Des Moines","IA",41.5868,-93.6250],["Cedar Rapids","IA",41.9779,-91.6656],["Davenport","IA",41.5236,-90.5776],["Sioux City","IA",42.4990,-96.4000],
["Council Bluffs","IA",41.2619,-95.8608],["Iowa City","IA",41.6611,-91.5302],["Milwaukee","WI",43.0389,-87.9065],["Madison","WI",43.0731,-89.4012],
["Green Bay","WI",44.5133,-88.0133],["Chicago","IL",41.8781,-87.6298],["Springfield","IL",39.7817,-89.6501],["Rockford","IL",42.2711,-89.0937],
["Peoria","IL",40.6936,-89.5890],["Joliet","IL",41.5250,-88.0817],["Champaign","IL",40.1164,-88.2434],["Effingham","IL",39.1201,-88.5434],
["Indianapolis","IN",39.7684,-86.1581],["Fort Wayne","IN",41.0793,-85.1394],["Evansville","IN",37.9716,-87.5711],["South Bend","IN",41.6764,-86.2520],
["Gary","IN",41.5934,-87.3464],["Terre Haute","IN",39.4667,-87.4139],["Columbus","OH",39.9612,-82.9988],["Cleveland","OH",41.4993,-81.6944],
["Cincinnati","OH",39.1031,-84.5120],["Toledo","OH",41.6528,-83.5379],["Dayton","OH",39.7589,-84.1916],["Akron","OH",41.0814,-81.5190],
["Youngstown","OH",41.0998,-80.6495],["Detroit","MI",42.3314,-83.0458],["Grand Rapids","MI",42.9634,-85.6681],["Flint","MI",43.0125,-83.6875],
["Lansing","MI",42.7325,-84.5555],["Ann Arbor","MI",42.2808,-83.7430],["Kalamazoo","MI",42.2917,-85.5872],["Saginaw","MI",43.4195,-83.9508],
["Louisville","KY",38.2527,-85.7585],["Lexington","KY",38.0406,-84.5037],["Bowling Green","KY",36.9903,-86.4436],["Paducah","KY",37.0834,-88.6000],
["Nashville","TN",36.1627,-86.7816],["Memphis","TN",35.1495,-90.0490],["Knoxville","TN",35.9606,-83.9207],["Chattanooga","TN",35.0456,-85.3097],
["Jackson","TN",35.6145,-88.8139],["Kingsport","TN",36.5484,-82.5618],["Jackson","MS",32.2988,-90.1848],["Gulfport","MS",30.3674,-89.0928],
["Meridian","MS",32.3643,-88.7037],["Tupelo","MS",34.2576,-88.7034],["Birmingham","AL",33.5186,-86.8104],["Montgomery","AL",32.3792,-86.3077],
["Mobile","AL",30.6954,-88.0399],["Huntsville","AL",34.7304,-86.5861],["Tuscaloosa","AL",33.2098,-87.5692],["Decatur","AL",34.6059,-86.9833],
["Atlanta","GA",33.7490,-84.3880],["Augusta","GA",33.4735,-82.0105],["Columbus","GA",32.4610,-84.9877],["Macon","GA",32.8407,-83.6324],
["Savannah","GA",32.0809,-81.0912],["Valdosta","GA",30.8327,-83.2785],["Jacksonville","FL",30.3322,-81.6557],["Miami","FL",25.7617,-80.1918],
["Tampa","FL",27.9506,-82.4572],["Orlando","FL",28.5383,-81.3792],["Tallahassee","FL",30.4383,-84.2807],["Pensacola","FL",30.4213,-87.2169],
["Fort Lauderdale","FL",26.1224,-80.1373],["Ocala","FL",29.1872,-82.1401],["Lake City","FL",30.1897,-82.6393],["Columbia","SC",34.0007,-81.0348],
["Charleston","SC",32.7765,-79.9311],["Greenville","SC",34.8526,-82.3940],["Spartanburg","SC",34.9496,-81.9320],["Charlotte","NC",35.2271,-80.8431],
["Raleigh","NC",35.7796,-78.6382],["Greensboro","NC",36.0726,-79.7920],["Durham","NC",35.9940,-78.8986],["Winston-Salem","NC",36.0999,-80.2442],
["Asheville","NC",35.5951,-82.5515],["Fayetteville","NC",35.0527,-78.8784],["Wilmington","NC",34.2257,-77.9447],["Virginia Beach","VA",36.8529,-75.9780],
["Richmond","VA",37.5407,-77.4360],["Norfolk","VA",36.8508,-76.2859],["Roanoke","VA",37.2710,-79.9414],["Charleston","WV",38.3498,-81.6326],
["Huntington","WV",38.4192,-82.4452],["Baltimore","MD",39.2904,-76.6122],["Hagerstown","MD",39.6418,-77.7200],["Wilmington","DE",39.7391,-75.5398],
["Newark","NJ",40.7357,-74.1724],["Jersey City","NJ",40.7178,-74.0431],["Trenton","NJ",40.2206,-74.7597],["Camden","NJ",39.9259,-75.1196],
["Philadelphia","PA",39.9526,-75.1652],["Pittsburgh","PA",40.4406,-79.9959],["Allentown","PA",40.6084,-75.4902],["Erie","PA",42.1292,-80.0851],
["Harrisburg","PA",40.2732,-76.8867],["Scranton","PA",41.4089,-75.6624],["New York","NY",40.7128,-74.0060],["Buffalo","NY",42.8864,-78.8784],
["Rochester","NY",43.1566,-77.6088],["Syracuse","NY",43.0481,-76.1474],["Albany","NY",42.6526,-73.7562],["Binghamton","NY",42.0987,-75.9180],
["Boston","MA",42.3601,-71.0589],["Worcester","MA",42.2626,-71.8023],["Springfield","MA",42.1015,-72.5898],["Hartford","CT",41.7658,-72.6734],
["Bridgeport","CT",41.1865,-73.1952],["New Haven","CT",41.3082,-72.9279],["Providence","RI",41.8240,-71.4128],["Burlington","VT",44.4759,-73.2121],
["Manchester","NH",42.9956,-71.4548],["Concord","NH",43.2081,-71.5376],["Portland","ME",43.6591,-70.2568],["Bangor","ME",44.8016,-68.7712],
["Seattle","WA",47.6062,-122.3321],["Spokane","WA",47.6588,-117.4260],["Tacoma","WA",47.2529,-122.4443],["Yakima","WA",46.6021,-120.5059],
["Vancouver","WA",45.6318,-122.6716],["Portland","OR",45.5152,-122.6784],["Eugene","OR",44.0521,-123.0868],["Salem","OR",44.9429,-123.0351],
["Medford","OR",42.3265,-122.8756],["Bend","OR",44.0582,-121.3153],["Ontario","OR",44.0266,-116.9629],["Boise","ID",43.6150,-116.2023],
["Pocatello","ID",42.8713,-112.4455],["Idaho Falls","ID",43.4917,-112.0408],["Coeur d'Alene","ID",47.6777,-116.7805],["Billings","MT",45.7833,-108.5007],
["Missoula","MT",46.8721,-113.9940],["Bozeman","MT",45.6770,-111.0429],["Butte","MT",46.0038,-112.5348],["Cheyenne","WY",41.1400,-104.8202],
["Casper","WY",42.8666,-106.3131],["Laramie","WY",41.3114,-105.5911],["Salt Lake City","UT",40.7608,-111.8910],["Ogden","UT",41.2230,-111.9738],
["Provo","UT",40.2338,-111.6585],["St. George","UT",37.0965,-113.5684],["Las Vegas","NV",36.1699,-115.1398],["Reno","NV",39.5296,-119.8138],
["Elko","NV",40.8324,-115.7631],["Winnemucca","NV",40.9730,-117.7357],["Phoenix","AZ",33.4484,-112.0740],["Tucson","AZ",32.2226,-110.9747],
["Flagstaff","AZ",35.1983,-111.6513],["Yuma","AZ",32.6927,-114.6277],["Kingman","AZ",35.1894,-114.0530],["Los Angeles","CA",34.0522,-118.2437],
["San Diego","CA",32.7157,-117.1611],["San Francisco","CA",37.7749,-122.4194],["Sacramento","CA",38.5816,-121.4944],["San Jose","CA",37.3382,-121.8863],
["Fresno","CA",36.7378,-119.7871],["Oakland","CA",37.8044,-122.2712],["Bakersfield","CA",35.3733,-119.0187],["Barstow","CA",34.8958,-117.0172],
["Ontario","CA",34.0633,-117.6509],["Redding","CA",40.5865,-122.3917],["Stockton","CA",37.9577,-121.2908],["Long Beach","CA",33.7701,-118.1937],
["Indio","CA",33.7206,-116.2156],["Blythe","CA",33.6178,-114.5881]
];

  const PRESETS = {
    'frisco-okc': { origin: 'Frisco, TX, USA', dest: 'Oklahoma City, OK, USA', oFallback: [33.1507, -96.8236], dFallback: [35.4676, -97.5164] },
    'dallas-houston': { origin: 'Dallas, TX, USA', dest: 'Houston, TX, USA', oFallback: [32.7767, -96.7970], dFallback: [29.7604, -95.3698] },
    'dallas-elpaso': { origin: 'Dallas, TX, USA', dest: 'El Paso, TX, USA', oFallback: [32.7767, -96.7970], dFallback: [31.7619, -106.4850] }
  };

  const data = { CURATED_WEIGH, CURATED_CLEARANCES, TRUCK_BRANDS, SHOP_TYPES, SHOP_SERVICES, PRESETS, US_CITIES };
  RR.data = data;
  if (typeof module !== 'undefined' && module.exports) module.exports = data;
})(typeof window !== 'undefined' ? window : globalThis);
