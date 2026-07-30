// =====================================================================
// FIREBASE CONFIG — your real SafeHer project keys
// =====================================================================
const firebaseConfig = {
  apiKey: "AIzaSyAMAleUTFvlR0tsbnHmMEHzBN4GLgNF-WY",
  authDomain: "safeher-cd051.firebaseapp.com",
  projectId: "safeher-cd051",
  storageBucket: "safeher-cd051.firebasestorage.app",
  messagingSenderId: "970472569456",
  appId: "1:970472569456:web:2bc9cb418f181bfeac92b5"
};

let firebaseReady = false;
try {
  firebase.initializeApp(firebaseConfig);
  firebaseReady = true;
} catch (e) {
  console.warn('Firebase failed to initialize — using demo mode.', e);
}
const auth = firebaseReady ? firebase.auth() : null;
const db = firebaseReady ? firebase.firestore() : null;

// Where your backend (server.js) is running
const BACKEND_URL = "http://localhost:5000";

// Currently logged-in user's data (filled after signup/login)
let currentUser = { name: 'Priya', phone: '', contacts: [] };

// =====================================================================
// REAL GPS LOCATION + READABLE ADDRESS
// =====================================================================
let currentLocation = { lat: 28.6329, lng: 77.2195, label: 'Connaught Place, New Delhi' };

function requestRealLocation(){
  if(!navigator.geolocation){
    console.warn('Geolocation not supported, using demo location.');
    return;
  }
  navigator.geolocation.getCurrentPosition(
    pos=>{
      currentLocation.lat = pos.coords.latitude;
      currentLocation.lng = pos.coords.longitude;
      currentLocation.label = `${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`; // shown until address loads
      console.log('Real location captured:', currentLocation);
      fetchReadableAddress(currentLocation.lat, currentLocation.lng);
    },
    err=>{ console.warn('Location permission denied, using demo location.', err.message); },
    { enableHighAccuracy:true, timeout:8000 }
  );
}

// Converts lat/lng into a readable address like "Connaught Place, New Delhi"
// Uses OpenStreetMap's free Nominatim service — no API key needed
async function fetchReadableAddress(lat, lng){
  try{
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
    const data = await res.json();
    if(data && data.address){
      const a = data.address;
      const short = [
        a.suburb || a.neighbourhood || a.road || a.village,
        a.city || a.town || a.state_district,
        a.state
      ].filter(Boolean).join(', ');
      currentLocation.label = short || data.display_name || currentLocation.label;
      console.log('Readable address:', currentLocation.label);
    }
  }catch(err){
    console.warn('Could not fetch readable address, showing coordinates instead.', err.message);
  }
}
requestRealLocation();

// =====================================================================
// REAL SIGNUP / LOGIN (Firebase Auth + Firestore)
// =====================================================================
function showAuthError(id, msg){
  const el=document.getElementById(id);
  el.textContent = msg; el.style.display='block';
}
function hideAuthError(id){ document.getElementById(id).style.display='none'; }

function updateDashboardGreeting(){
  const firstName = (currentUser.name || 'there').split(' ')[0];
  const el = document.querySelector('.greet');
  if(el) el.textContent = `Hey ${firstName} 👋`;
}

async function signupUser(){
  hideAuthError('su-error');
  const name = document.getElementById('su-name').value.trim();
  const phone = document.getElementById('su-phone').value.trim();
  const email = document.getElementById('su-email').value.trim();
  const password = document.getElementById('su-password').value;

  if(!name || !email || !password){
    showAuthError('su-error','Please fill in name, email, and password.');
    return;
  }

  const rows = document.querySelectorAll('#screen-signup .contact-row');
  const contacts = Array.from(rows).map(r=>{
    const [nameInput, phoneInput] = r.querySelectorAll('input');
    return { name: nameInput.value.trim(), phone: phoneInput.value.trim() };
  }).filter(c=>c.name && c.phone);

  currentUser = { name, phone, contacts };

  if(!firebaseReady){
    toast('Demo mode: account created locally (Firebase not connected)');
    updateDashboardGreeting();
    go('screen-dashboard');
    return;
  }

  const btn=document.getElementById('su-submit-btn');
  btn.textContent='Creating account...'; btn.disabled=true;
  try{
    const cred = await auth.createUserWithEmailAndPassword(email, password);
    await db.collection('users').doc(cred.user.uid).set({ name, phone, email, contacts });
    toast(`Welcome to SafeHer, ${name}`);
    updateDashboardGreeting();
    go('screen-dashboard');
  }catch(err){
    showAuthError('su-error', err.message);
  }finally{
    btn.textContent='Create account'; btn.disabled=false;
  }
}

async function loginUser(){
  hideAuthError('li-error');
  const email = document.getElementById('li-email').value.trim();
  const password = document.getElementById('li-password').value;

  if(!email || !password){
    showAuthError('li-error','Please enter email and password.');
    return;
  }

  if(!firebaseReady){
    toast('Demo mode: logged in locally (Firebase not connected)');
    go('screen-dashboard');
    return;
  }

  const btn=document.getElementById('li-submit-btn');
  btn.textContent='Logging in...'; btn.disabled=true;
  try{
    const cred = await auth.signInWithEmailAndPassword(email, password);
    const doc = await db.collection('users').doc(cred.user.uid).get();
    if(doc.exists) currentUser = doc.data();
    toast('Logged in');
    updateDashboardGreeting();
    go('screen-dashboard');
  }catch(err){
    showAuthError('li-error', err.message);
  }finally{
    btn.textContent='Log in'; btn.disabled=false;
  }
}

// =====================================================================
// NAVIGATION
// =====================================================================
function go(id){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  if(id==='screen-journey') setTimeout(initMap,150);
  if(id==='screen-nearby') setTimeout(initMap2,150);
}

function toast(msg){
  const t=document.getElementById('toast');
  t.textContent=msg; t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'),2200);
}

function addContactRow(){
  const row=document.createElement('div');
  row.className='contact-row';
  row.innerHTML='<input type="text" placeholder="Name"><input type="tel" placeholder="Phone number">';
  document.querySelector('.add-contact-btn').insertAdjacentElement('beforebegin',row);
}

// =====================================================================
// MAPS (Leaflet + OpenStreetMap, free)
// =====================================================================
let mapInited=false, map2Inited=false, map3Inited=false;
let journeyMap=null;
function initMap(){
  if(mapInited) return; mapInited=true;
  journeyMap=L.map('map',{zoomControl:false,attributionControl:false}).setView([currentLocation.lat,currentLocation.lng],13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(journeyMap);
  L.marker([currentLocation.lat,currentLocation.lng]).addTo(journeyMap);
}
let map2Instance = null;
let nearby2Layers = [];
function initMap2(){
  if(map2Inited) return; map2Inited=true;
  map2Instance=L.map('map2',{zoomControl:false,attributionControl:false}).setView([currentLocation.lat,currentLocation.lng],14);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map2Instance);
  loadNearbyPlaces(map2Instance, currentLocation.lat, currentLocation.lng, 'You are here');
}
function initMap3(){
  if(map3Inited) return; map3Inited=true;
  const m=L.map('map3',{zoomControl:false,attributionControl:false}).setView([currentLocation.lat,currentLocation.lng],15);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(m);
  L.marker([currentLocation.lat,currentLocation.lng]).addTo(m).bindPopup('Live location').openPopup();
  fetchNearestPoliceForSOS();
}

// Lets the user search nearby help around any typed location instead of their live GPS
async function searchNearbyAt(){
  const text = document.getElementById('nearby-location-input').value.trim();
  const statusEl = document.getElementById('nearby-location-status');

  if(!text){
    statusEl.textContent = '📍 Showing results near your current location';
    if(map2Instance) { map2Instance.setView([currentLocation.lat,currentLocation.lng],14); loadNearbyPlaces(map2Instance, currentLocation.lat, currentLocation.lng, 'You are here'); }
    return;
  }

  // If the user picked a suggestion from the dropdown, use that precise coordinate directly
  if(nearbySearchCoord){
    statusEl.textContent = `📍 Showing results near "${text}"`;
    if(map2Instance){ map2Instance.setView([nearbySearchCoord.lat,nearbySearchCoord.lng],14); loadNearbyPlaces(map2Instance, nearbySearchCoord.lat, nearbySearchCoord.lng, text); }
    return;
  }

  statusEl.textContent = 'Searching…';
  try{
    const pt = await geocodeAddress(text);
    statusEl.textContent = `📍 Showing results near "${text}"`;
    if(map2Instance){ map2Instance.setView([pt.lat,pt.lng],14); loadNearbyPlaces(map2Instance, pt.lat, pt.lng, text); }
  }catch(err){
    statusEl.textContent = "Couldn't find that location — try picking a suggestion from the dropdown";
  }
}

function useLiveLocationNearby(){
  nearbySearchCoord = null;
  document.getElementById('nearby-location-input').value = '';
  searchNearbyAt();
}

function useCurrentLocationForFrom(){
  document.getElementById('journey-from').value = currentLocation.label;
  fromCoord = { lat: currentLocation.lat, lng: currentLocation.lng };
  toast('Using your current location as the starting point');
}

// =====================================================================
// REAL NEARBY POLICE / HOSPITAL (Overpass API, free, no key needed)
// =====================================================================
function distanceKm(lat1,lng1,lat2,lng2){
  const R=6371;
  const dLat=(lat2-lat1)*Math.PI/180, dLng=(lng2-lng1)*Math.PI/180;
  const a=Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}

let nearbySearchCoord = null; // set when user picks an autocomplete suggestion, for precise search

async function fetchNearbyAmenity(amenityType, lat, lng, radius=5000){
  // "nwr" searches nodes, ways, AND relations — many police stations/hospitals are mapped
  // as building outlines (ways), not just point markers, so node-only search missed them.
  const query = `[out:json][timeout:20];nwr["amenity"="${amenityType}"](around:${radius},${lat},${lng});out center 10;`;
  try{
    const res = await fetch('https://overpass-api.de/api/interpreter', { method:'POST', body: query });
    if(res.status === 429) throw new Error('RATE_LIMITED');
    if(!res.ok) throw new Error(`Overpass returned status ${res.status}`);
    const data = await res.json();
    return (data.elements||[]).map(el=>{
      const elLat = el.lat ?? el.center?.lat;
      const elLng = el.lon ?? el.center?.lon;
      return {
        name: el.tags?.name || (amenityType==='police' ? 'Police Station' : 'Hospital'),
        lat: elLat, lng: elLng,
        distance: distanceKm(lat,lng,elLat,elLng)
      };
    }).filter(p=>p.lat && p.lng).sort((a,b)=>a.distance-b.distance);
  }catch(err){
    console.error(`Overpass fetch FAILED for ${amenityType} — this is an error, not "zero results":`, err.message);
    return err.message === 'RATE_LIMITED' ? 'RATE_LIMITED' : null; // distinguish rate-limit from other errors
  }
}

function renderPlaceList(containerId, places, icon, emptyLabel){
  const el = document.getElementById(containerId);
  if(!el) return;
  if(places === 'RATE_LIMITED'){
    el.innerHTML = `<div class="contact-sent"><div class="av">⏳</div><div><b>Server busy right now</b><span>Free map data service is rate-limited — wait 30s and try again</span></div></div>`;
    return;
  }
  if(places === null){
    el.innerHTML = `<div class="contact-sent"><div class="av">⚠️</div><div><b>Search failed</b><span>Check your internet connection and try again</span></div></div>`;
    return;
  }
  if(!places.length){
    el.innerHTML = `<div class="contact-sent"><div class="av">${icon}</div><div><b>${emptyLabel}</b><span>Try again or check a wider area</span></div></div>`;
    return;
  }
  el.innerHTML = places.slice(0,4).map(p=>`
    <div class="contact-sent"><div class="av">${icon}</div><div><b>${p.name}</b><span>${p.distance.toFixed(1)} km away</span></div></div>
  `).join('');
}

async function loadNearbyPlaces(map, lat, lng, markerLabel){
  // Clear previously drawn markers so searching a new location doesn't stack old ones
  nearby2Layers.forEach(l=>map.removeLayer(l));
  nearby2Layers = [];

  const centerMarker = L.marker([lat,lng]).addTo(map).bindPopup(markerLabel||'Searched location').openPopup();
  nearby2Layers.push(centerMarker);

  document.getElementById('nearby-police').innerHTML = '<div class="contact-sent"><div class="av">🚓</div><div><b>Loading…</b><span>Searching nearby</span></div></div>';
  document.getElementById('nearby-hospitals').innerHTML = '<div class="contact-sent"><div class="av">🏥</div><div><b>Loading…</b><span>Searching nearby</span></div></div>';

  const police = await fetchNearbyAmenity('police', lat, lng);
  await new Promise(r=>setTimeout(r, 1200)); // small gap to avoid tripping the free server's rate limit
  const hospitals = await fetchNearbyAmenity('hospital', lat, lng);
  renderPlaceList('nearby-police', police, '🚓', 'No police station found nearby');
  renderPlaceList('nearby-hospitals', hospitals, '🏥', 'No hospital found nearby');

  (Array.isArray(police)?police:[]).slice(0,4).forEach(p=> nearby2Layers.push(L.circleMarker([p.lat,p.lng],{color:'#E85D75'}).addTo(map).bindPopup(p.name)));
  (Array.isArray(hospitals)?hospitals:[]).slice(0,4).forEach(h=> nearby2Layers.push(L.circleMarker([h.lat,h.lng],{color:'#4CAF82'}).addTo(map).bindPopup(h.name)));
}

async function fetchNearestPoliceForSOS(){
  const police = await fetchNearbyAmenity('police', currentLocation.lat, currentLocation.lng);
  renderPlaceList('sos-nearest-help', Array.isArray(police)?police.slice(0,1):police, '🚓', 'No police station found nearby');
}

// =====================================================================
// JOURNEY: REAL SAFE ROUTE (Nominatim geocoding + OSRM routing + Overpass POI scoring)
// =====================================================================
let foundRoutes = [];      // stores geometry + score for each route option
let selectedRouteIdx = 0;
let routeLayers = [];      // leaflet polyline layers, so we can re-color on selection
let checkinTimer = null, checkinReminderTimer = null, checkinFinalTimer = null;
let fromCoord = null, toCoord = null; // set when user picks a suggestion, so we skip re-geocoding

// Debounce helper — waits until the user pauses typing before firing a search
function debounce(fn, delay){
  let t;
  return (...args)=>{ clearTimeout(t); t = setTimeout(()=>fn(...args), delay); };
}

// Live address autocomplete using Photon (a free, open geocoder built on OpenStreetMap —
// handles fuzzy/informal place names much better than plain Nominatim, similar to how cab apps behave)
function setupAutocomplete(inputId, listId, onPick){
  const input = document.getElementById(inputId);
  const list = document.getElementById(listId);

  const search = debounce(async (query)=>{
    if(query.trim().length < 3){ list.classList.remove('show'); list.innerHTML=''; return; }
    try{
      const biasParams = `&lat=${currentLocation.lat}&lon=${currentLocation.lng}&zoom=12`;
      const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=5${biasParams}`);
      const data = await res.json();
      list.innerHTML = '';
      (data.features||[]).forEach(f=>{
        const p = f.properties;
        const mainName = p.name || p.street || p.city || 'Unknown place';
        const subName = [p.city, p.state, p.country].filter(Boolean).filter(v=>v!==mainName).join(', ');
        const item = document.createElement('div');
        item.className = 'suggestion-item';
        item.innerHTML = `${mainName}${subName ? `<small>${subName}</small>` : ''}`;
        item.onclick = ()=>{
          input.value = subName ? `${mainName}, ${subName}` : mainName;
          onPick({ lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0] });
          list.classList.remove('show'); list.innerHTML='';
        };
        list.appendChild(item);
      });
      if(data.features && data.features.length) list.classList.add('show');
      else list.classList.remove('show');
    }catch(err){
      console.warn('Autocomplete search failed:', err.message);
    }
  }, 350);

  input.addEventListener('input', ()=>{
    onPick(null); // typing manually invalidates any previously picked coordinate
    search(input.value);
  });
  document.addEventListener('click', (e)=>{
    if(e.target !== input) list.classList.remove('show');
  });
}
setupAutocomplete('journey-from','from-suggestions', (c)=>{ fromCoord = c; });
setupAutocomplete('journey-to','to-suggestions', (c)=>{ toCoord = c; });
setupAutocomplete('nearby-location-input','nearby-suggestions', (c)=>{
  nearbySearchCoord = c;
  if(!c) return; // typing manually (not yet picked a suggestion) — nothing to search yet
  const label = document.getElementById('nearby-location-input').value;
  document.getElementById('nearby-location-status').textContent = `📍 Showing results near "${label}"`;
  if(map2Instance){ map2Instance.setView([c.lat,c.lng],14); loadNearbyPlaces(map2Instance, c.lat, c.lng, label); }
});

// Fallback geocoder for when the user types an address and hits "Find routes" without
// picking a suggestion. Tries Photon first, then Nominatim, then retries with added
// regional context (e.g. ", Uttar Pradesh, India") for informal/local place names.
async function geocodeAddress(text){
  const tryPhoton = async (q)=>{
    const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=1&lat=${currentLocation.lat}&lon=${currentLocation.lng}`);
    const data = await res.json();
    if(data.features && data.features.length){
      return { lat: data.features[0].geometry.coordinates[1], lng: data.features[0].geometry.coordinates[0] };
    }
    return null;
  };
  const tryNominatim = async (q)=>{
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1`);
    const data = await res.json();
    if(data.length) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    return null;
  };

  let result = await tryPhoton(text) || await tryNominatim(text);
  if(!result){
    // Retry with extra regional context in case it's a local/informal place name
    const withContext = `${text}, India`;
    result = await tryPhoton(withContext) || await tryNominatim(withContext);
  }
  if(!result) throw new Error(`Could not find location: "${text}". Try picking it from the suggestions list instead.`);
  return result;
}

// Counts nearby shops/amenities around a point using Overpass — used as a rough "footfall/safety" proxy.
// More shops & amenities nearby generally means a busier, better-lit, more populated area.
async function countNearbyPOIs(lat, lng, radius=200){
  const query = `[out:json][timeout:15];(node["shop"](around:${radius},${lat},${lng});node["amenity"](around:${radius},${lat},${lng}););out count;`;
  try{
    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method:'POST',
      body: query
    });
    const data = await res.json();
    return parseInt(data.elements?.[0]?.tags?.total || 0, 10);
  }catch(err){
    console.warn('Overpass POI count failed for a sample point, treating as 0.', err.message);
    return 0;
  }
}

// Samples a few evenly-spaced points along a route's coordinates and sums up nearby POI counts
async function scoreRouteSafety(coordsLatLng){
  const sampleCount = 4;
  const step = Math.max(1, Math.floor(coordsLatLng.length / sampleCount));
  const samples = [];
  for(let i=0; i<coordsLatLng.length; i+=step) samples.push(coordsLatLng[i]);

  let total = 0;
  for(const [lat,lng] of samples){
    total += await countNearbyPOIs(lat, lng);
  }
  return total;
}

async function findRoutes(){
  const fromText = document.getElementById('journey-from').value.trim();
  const toText = document.getElementById('journey-to').value.trim();
  const btn = document.getElementById('find-routes-btn');

  if(!fromText || !toText){
    toast('Please enter both From and To');
    return;
  }

  btn.textContent = 'Finding routes…'; btn.disabled = true;
  document.getElementById('route-cards').innerHTML = '';

  try{
    const [fromPt, toPt] = await Promise.all([geocodeAddress(fromText), geocodeAddress(toText)]);

    // OSRM free public routing server — gives real road-following routes, with alternatives if available
    const url = `https://router.project-osrm.org/route/v1/driving/${fromPt.lng},${fromPt.lat};${toPt.lng},${toPt.lat}?alternatives=true&overview=full&geometries=geojson`;
    const res = await fetch(url);
    const data = await res.json();

    if(!data.routes || !data.routes.length) throw new Error('No routes found between these locations.');

    btn.textContent = 'Scoring route safety…';

    // Score each route's safety based on nearby POI density (shops/amenities = footfall proxy)
    const scored = [];
    for(const r of data.routes.slice(0,3)){
      const coordsLatLng = r.geometry.coordinates.map(c=>[c[1],c[0]]); // OSRM gives [lng,lat], Leaflet wants [lat,lng]
      const safetyScore = await scoreRouteSafety(coordsLatLng);
      scored.push({
        coords: coordsLatLng,
        durationMin: Math.round(r.duration/60),
        distanceKm: (r.distance/1000).toFixed(1),
        safetyScore
      });
    }

    // Rank: highest POI density = safest (green), lowest = riskiest (red)
    scored.sort((a,b)=>b.safetyScore - a.safetyScore);
    foundRoutes = scored;
    selectedRouteIdx = 0;
    renderRouteCards();
    drawRoutesOnMap();

    document.getElementById('routes-label').style.display = 'block';
    const startBtn = document.getElementById('start-journey-btn');
    startBtn.disabled = false;
    startBtn.textContent = 'Start journey with selected route';

  }catch(err){
    console.error('findRoutes error:', err.message);
    toast("Couldn't find routes — check the addresses and try again");
  }finally{
    btn.textContent = 'Find safest routes'; btn.disabled = false;
  }
}

function renderRouteCards(){
  const wrap = document.getElementById('route-cards');
  wrap.innerHTML = '';
  const onlyOneRoute = foundRoutes.length === 1;
  const labels = onlyOneRoute ? ['Only route found'] : ['Safest','Caution','Risky'];
  const colors = onlyOneRoute ? ['var(--ink-500)'] : ['var(--safe)','var(--caution)','var(--danger)'];

  foundRoutes.forEach((r, i)=>{
    const card = document.createElement('div');
    card.className = 'route-card' + (i===selectedRouteIdx ? ' selected' : '');
    card.onclick = ()=>{ selectedRouteIdx = i; renderRouteCards(); drawRoutesOnMap(); };
    const noteText = onlyOneRoute ? 'No alternative routes available for this distance' : `${r.safetyScore} nearby places`;
    card.innerHTML = `
      <div class="route-dot" style="background:${colors[i]||colors[colors.length-1]}"></div>
      <div class="route-info"><b>Route ${String.fromCharCode(65+i)}</b><span>${r.durationMin} min · ${r.distanceKm} km · ${noteText}</span></div>
      <div class="route-badge" style="background:${colors[i]||colors[colors.length-1]};color:white;opacity:0.85">${labels[i]||'Risky'}</div>
    `;
    wrap.appendChild(card);
  });
}

function drawRoutesOnMap(){
  if(!journeyMap) return;
  routeLayers.forEach(l=>journeyMap.removeLayer(l));
  routeLayers = [];
  const colors = ['#4CAF82','#E3A73F','#E2554F'];

  foundRoutes.forEach((r,i)=>{
    const isSelected = i===selectedRouteIdx;
    const line = L.polyline(r.coords, {
      color: colors[i]||colors[2],
      weight: isSelected ? 6 : 3,
      opacity: isSelected ? 1 : 0.45
    }).addTo(journeyMap);
    routeLayers.push(line);
  });
  if(routeLayers[selectedRouteIdx]) journeyMap.fitBounds(routeLayers[selectedRouteIdx].getBounds(), {padding:[20,20]});
}

// =====================================================================
// REAL MISSED CHECK-IN
// =====================================================================
function startJourney(){
  if(!foundRoutes.length){ toast('Find a route first'); return; }
  const minutes = parseFloat(document.getElementById('journey-minutes').value) || 30;

  toast(`Journey started — check-in in ${minutes} min`);
  go('screen-dashboard');

  clearTimeout(checkinTimer); clearTimeout(checkinReminderTimer); clearTimeout(checkinFinalTimer);

  // Main wait: fires when the expected arrival time is reached
  checkinTimer = setTimeout(()=>{
    document.getElementById('checkin-modal').classList.add('active');

    // Give a 2-minute reminder buffer before auto-alerting
    checkinReminderTimer = setTimeout(()=>{
      if(document.getElementById('checkin-modal').classList.contains('active')){
        toast('Still there? Tap "I\'m safe" or an alert will be sent automatically.');
      }
    }, 2*60*1000);

    // Final buffer: if still no response, auto-trigger SOS
    checkinFinalTimer = setTimeout(()=>{
      if(document.getElementById('checkin-modal').classList.contains('active')){
        document.getElementById('checkin-modal').classList.remove('active');
        triggerSOS('missed_checkin');
      }
    }, 5*60*1000);

  }, minutes*60*1000);
}

function confirmSafe(){
  clearTimeout(checkinReminderTimer); clearTimeout(checkinFinalTimer);
  document.getElementById('checkin-modal').classList.remove('active');
  toast("Great — glad you're safe!");
}

// =====================================================================
// SOS + AI MESSAGE (real Grok + real Twilio via backend)
// =====================================================================
const aiTemplates = {
  default:(n,l,t)=>`🚨 ${n} has triggered an emergency alert at ${t}. Last known location: ${l}. Please try to reach her or contact local authorities if needed.`,
  unsafe:(n,l,t)=>`🚨 ${n} feels unsafe right now (${t}). Location: ${l}. Please check in with her immediately.`,
  followed:(n,l,t)=>`🚨 ${n} believes she is being followed, reported at ${t}. Location: ${l}. Please respond urgently and consider alerting nearby authorities.`,
  missed_checkin:(n,l,t)=>`🚨 ${n} missed her expected check-in time (${t}) during a tracked journey. Last known location: ${l}. Please try to reach her immediately.`,
};
let lastFailedSOSKind = null;

function triggerSOS(kind){
  go('screen-sos');
  setTimeout(initMap3,150);
  document.getElementById('sos-fail-warning').style.display = 'none';

  const name = currentUser.name || 'Priya';
  const loc = currentLocation.label;
  const time = new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
  const situationMap = { unsafe:'feels unsafe', followed:'being followed', missed_checkin:'missed a scheduled safety check-in during a journey', voice:'triggered a voice-activated SOS using a safe word' };
  const situation = situationMap[kind] || 'general emergency';

  const preview=document.getElementById('ai-msg-preview');
  preview.textContent='Generating message…';

  // If the device is already known to be offline, don't even try — show the fallback immediately
  if(!navigator.onLine){
    handleSOSFailure(kind, name, loc, time);
    return;
  }

  fetch(`${BACKEND_URL}/api/generate-message`, {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ name, location: loc, time, situation })
  })
  .then(res=>res.json())
  .then(data=>{
    const finalMessage = data.message;
    preview.textContent = finalMessage;
    console.log('AI message source:', data.source); // "fallback-template" or "grok"

    const numbers = (currentUser.contacts||[]).map(c=>c.phone).filter(Boolean);
    return fetch(`${BACKEND_URL}/api/send-sms`, {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ contacts: numbers, message: finalMessage })
    });
  })
  .then(res=>res.json())
  .then(data=>{
    console.log('SMS result:', data);
    lastFailedSOSKind = null; // success — clear any pending retry
  })
  .catch(err=>{
    console.warn('SOS failed to reach the backend (likely no internet):', err.message);
    handleSOSFailure(kind, name, loc, time);
  });
}

function handleSOSFailure(kind, name, loc, time){
  const gen = aiTemplates[kind] || aiTemplates.default;
  const message = gen(name, loc, time);
  document.getElementById('ai-msg-preview').textContent = message + ' (not sent over internet — see options below)';
  document.getElementById('sos-fail-warning').style.display = 'block';
  lastFailedSOSKind = kind;

  // Build one tap-to-send SMS button per trusted contact.
  // sms: links open the phone's own SMS app pre-filled with the message —
  // this uses the normal mobile network, NOT internet, so it works even with zero data/WiFi.
  const btnWrap = document.getElementById('sos-fallback-sms-buttons');
  const contacts = currentUser.contacts || [];
  if(!contacts.length){
    btnWrap.innerHTML = `<p style="font-size:12.5px;color:var(--ink-500);">No trusted contacts saved on this account.</p>`;
    return;
  }
  btnWrap.innerHTML = contacts.map(c=>{
    const smsHref = `sms:${encodeURIComponent(c.phone)}?body=${encodeURIComponent(message)}`;
    return `<a href="${smsHref}" class="btn btn-ghost" style="display:block;text-align:left;padding:11px;font-size:13px;margin-bottom:6px;">📱 Send SMS to ${c.name || c.phone}</a>`;
  }).join('');
}

function retrySOS(){
  if(lastFailedSOSKind) triggerSOS(lastFailedSOSKind);
}

// =====================================================================
// CONNECTIVITY MONITOR — shows a banner when offline, auto-retries a failed SOS when back online
// =====================================================================
function updateOfflineBanner(){
  const banner = document.getElementById('offline-banner');
  if(navigator.onLine) banner.classList.remove('show');
  else banner.classList.add('show');
}
window.addEventListener('online', ()=>{
  updateOfflineBanner();
  toast('Back online');
  if(lastFailedSOSKind){ toast('Retrying your last alert…'); retrySOS(); }
});
window.addEventListener('offline', updateOfflineBanner);
updateOfflineBanner();
function resolveSOS(){
  toast('Alert closed — contacts notified you are safe');
  go('screen-dashboard');
}

// =====================================================================
// FAKE EXIT
// =====================================================================
function fakeExit(){ document.getElementById('fake-exit').classList.add('active'); }
function closeFakeExit(){ document.getElementById('fake-exit').classList.remove('active'); }

// =====================================================================
// FAKE INCOMING CALL (with a real ringtone, built using the Web Audio API — no audio file needed)
// =====================================================================
let ringtoneCtx = null, ringtoneInterval = null;
function playRingtone(){
  ringtoneCtx = new (window.AudioContext || window.webkitAudioContext)();
  const ringOnce = ()=>{
    if(!ringtoneCtx) return;
    [0, 0.35].forEach(delay=>{
      const osc = ringtoneCtx.createOscillator();
      const gain = ringtoneCtx.createGain();
      osc.frequency.value = 950;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.15, ringtoneCtx.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, ringtoneCtx.currentTime + delay + 0.3);
      osc.connect(gain).connect(ringtoneCtx.destination);
      osc.start(ringtoneCtx.currentTime + delay);
      osc.stop(ringtoneCtx.currentTime + delay + 0.3);
    });
  };
  ringOnce();
  ringtoneInterval = setInterval(ringOnce, 2000);
}
function stopRingtone(){
  if(ringtoneInterval) clearInterval(ringtoneInterval);
  if(ringtoneCtx) ringtoneCtx.close();
  ringtoneCtx = null; ringtoneInterval = null;
}
function triggerFakeCall(){
  document.getElementById('fake-call').classList.add('active');
  playRingtone();
}
function acceptFakeCall(){
  stopRingtone();
  document.getElementById('fake-call').classList.remove('active');
  toast('Call ended');
}
function endFakeCall(){
  stopRingtone();
  document.getElementById('fake-call').classList.remove('active');
}

// =====================================================================
// VOICE-TRIGGERED SOS (Web Speech API — says a safe word, triggers SOS automatically)
// =====================================================================
const SAFE_WORD = 'help me now'; // change this to whatever phrase you want as the trigger
let voiceRecognition = null;
let voiceSOSOn = false;

function toggleVoiceSOS(){
  const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!SpeechRecognitionAPI){
    toast('Voice SOS is not supported in this browser — try Chrome or Edge');
    return;
  }

  voiceSOSOn = !voiceSOSOn;
  const label = document.getElementById('voice-sos-label');

  if(voiceSOSOn){
    label.textContent = 'Voice SOS: On';
    toast(`Listening for safe word: "${SAFE_WORD}"`);
    startVoiceListening(SpeechRecognitionAPI);
  }else{
    label.textContent = 'Voice SOS: Off';
    if(voiceRecognition) voiceRecognition.stop();
    toast('Voice SOS turned off');
  }
}

function startVoiceListening(SpeechRecognitionAPI){
  voiceRecognition = new SpeechRecognitionAPI();
  voiceRecognition.continuous = true;
  voiceRecognition.interimResults = true;
  voiceRecognition.lang = 'en-IN';

  voiceRecognition.onresult = (event)=>{
    let transcript = '';
    for(let i=event.resultIndex; i<event.results.length; i++){
      transcript += event.results[i][0].transcript;
    }
    if(transcript.toLowerCase().includes(SAFE_WORD)){
      voiceSOSOn = false;
      document.getElementById('voice-sos-label').textContent = 'Voice SOS: Off';
      voiceRecognition.stop();
      triggerSOS('voice');
    }
  };

  voiceRecognition.onerror = (e)=>{
    console.warn('Voice recognition error:', e.error);
    if(e.error === 'not-allowed'){
      toast('Microphone permission denied — Voice SOS needs mic access');
      voiceSOSOn = false;
      document.getElementById('voice-sos-label').textContent = 'Voice SOS: Off';
    }
  };

  // Browsers auto-stop listening after a period of silence — restart automatically while toggle is ON
  voiceRecognition.onend = ()=>{
    if(voiceSOSOn) voiceRecognition.start();
  };

  voiceRecognition.start();
}

// =====================================================================
// CHATBOT — real AI Safety Assistant (Grok via backend)
// =====================================================================
let chatHistory = [];   // {role:'user'|'assistant', content:'...'} — sent to backend for context
let chatGreeted = false;

function openChat(){
  document.getElementById('chat-panel').classList.add('active');
  if(!chatGreeted){
    const firstName = (currentUser.name||'there').split(' ')[0];
    document.getElementById('chat-greeting').textContent = `Hi ${firstName}, I'm here with you. Are you feeling unsafe right now, or just checking in?`;
    chatGreeted = true;
  }
}
function closeChat(){ document.getElementById('chat-panel').classList.remove('active'); }

function pushBubble(text, who){
  const wrap=document.getElementById('chat-msgs');
  const b=document.createElement('div');
  b.className='bubble '+who;
  b.textContent=text;
  wrap.appendChild(b);
  wrap.scrollTop=wrap.scrollHeight;
}

function pushTypingIndicator(){
  const wrap=document.getElementById('chat-msgs');
  const b=document.createElement('div');
  b.className='bubble bot';
  b.id='typing-indicator';
  b.textContent='…';
  wrap.appendChild(b);
  wrap.scrollTop=wrap.scrollHeight;
}
function removeTypingIndicator(){
  const el=document.getElementById('typing-indicator');
  if(el) el.remove();
}

// Immediate safety net: these specific situations still trigger real SOS directly,
// regardless of what the AI says — safety-critical actions shouldn't depend on AI judgment.
function detectUrgentKind(text){
  const lower = text.toLowerCase();
  if(lower.includes('unsafe')) return 'unsafe';
  if(lower.includes('follow')) return 'followed';
  return null;
}

async function sendToBot(text){
  const kind = detectUrgentKind(text);
  chatHistory.push({ role:'user', content:text });
  pushTypingIndicator();

  try{
    const res = await fetch(`${BACKEND_URL}/api/chat`, {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ message:text, history:chatHistory, name: currentUser.name })
    });
    const data = await res.json();
    removeTypingIndicator();
    pushBubble(data.reply, 'bot');
    chatHistory.push({ role:'assistant', content:data.reply });
    console.log('Chat reply source:', data.source);
  }catch(err){
    removeTypingIndicator();
    pushBubble("I'm having trouble connecting right now, but I'm still here — tap SOS if you need help immediately.", 'bot');
    console.warn('Chat backend unreachable:', err.message);
  }

  // Safety net fires regardless of what the AI replied
  if(kind){ setTimeout(()=>{ closeChat(); triggerSOS(kind); }, 1200); }
}

function chatQuick(text){
  pushBubble(text,'user');
  sendToBot(text);
}
function chatSendTyped(){
  const inp=document.getElementById('chat-input');
  if(!inp.value.trim()) return;
  pushBubble(inp.value,'user');
  sendToBot(inp.value);
  inp.value='';
}
document.getElementById('chat-input').addEventListener('keydown', e=>{ if(e.key==='Enter') chatSendTyped(); });