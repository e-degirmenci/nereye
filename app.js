(function(){
"use strict";

/* ================= sabitler ================= */
const ORIGINS = {
  gps:{label:"Konumum",gps:true},
  marienplatz:{label:"Marienplatz",lat:48.1374,lon:11.5755},
  lmu:{label:"LMU Ana bina",lat:48.1508,lon:11.5803},
  sendlinger:{label:"Sendlinger Tor",lat:48.1340,lon:11.5670},
  gaertner:{label:"Gärtnerplatz",lat:48.1311,lon:11.5760},
  freiheit:{label:"Münchner Freiheit",lat:48.1622,lon:11.5867},
  hbf:{label:"Hauptbahnhof",lat:48.1402,lon:11.5600}
};
const CATS = {
  food:{label:"Yemek",color:"--cat-food",types:["restaurant"]},
  bar:{label:"Bar",color:"--cat-bar",types:["bar","pub","wine_bar"]},
  beer:{label:"Biergarten",color:"--cat-beer",types:null},       // Google'da ayrı tür yok; canlı modda gizlenir
  cafe:{label:"Kafe",color:"--cat-cafe",types:["cafe","coffee_shop"]}
};
const GROUP_SIZE = 12;
const HOURS = ["now","8","12","15","18","20","22","0","2"];
const CONFIG = window.NEREYE_CONFIG || {};
const API_KEY = (CONFIG.googleMapsApiKey||"").trim();

/* ================= yardımcılar ================= */
const $ = s=>document.querySelector(s);
const el = (tag, cls, txt)=>{const e=document.createElement(tag); if(cls) e.className=cls; if(txt!=null) e.textContent=txt; return e;};
const toMin = s=>{const [h,m]=s.split(":").map(Number); return h*60+m;};
const fmt = m=>{m=((m%1440)+1440)%1440; return String(Math.floor(m/60)).padStart(2,"0")+":"+String(m%60).padStart(2,"0");};
const rad = d=>d*Math.PI/180;
function distKm(a,b){const R=6371,dLat=rad(b.lat-a.lat),dLon=rad(b.lon-a.lon);const x=Math.sin(dLat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dLon/2)**2;return 2*R*Math.asin(Math.sqrt(x));}
function distLabel(km){const walk=Math.max(1,Math.round(km*1.25/4.8*60));return (km<1? Math.round(km*1000/10)*10+" m" : km.toFixed(1).replace(".",",")+" km")+" · "+walk+" dk yürüme";}
const price = p=>p?"€".repeat(p):"";
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
function berlinNow(){
  const parts=new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/Berlin",weekday:"short",hour:"2-digit",minute:"2-digit",hour12:false}).formatToParts(new Date());
  const g=t=>parts.find(p=>p.type===t).value;
  return {day:["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].indexOf(g("weekday")), min:(Number(g("hour"))%24)*60+Number(g("minute"))};
}
function timeCtx(hour){
  const now=berlinNow();
  if(hour==="now") return {day:now.day,min:now.min,label:"Şimdi"};
  const h=Number(hour); let day=now.day;
  if(h<6 && now.min>=6*60) day=(day+1)%7;
  return {day,min:h*60,label:fmt(h*60)};
}
// Kurallar: {d:"günler (0=Pzt)", o:dakika, c:dakika (gece yarısını geçebilir)}
function rulesFromSample(h){return h.map(([d,o,c])=>{const om=toMin(o);let cm=toMin(c);if(cm<=om)cm+=1440;return {d,o:om,c:cm};});}
function openInfo(v,ctx){
  if(v.always) return {open:true,text:"7/24 açık"};
  if(!v.rules||!v.rules.length) return {open:null,text:"Saat bilgisi yok"};
  const rs=v.rules, prev=(ctx.day+6)%7;
  for(const r of rs){
    if(r.d.includes(String(ctx.day)) && ctx.min>=r.o && ctx.min<r.c) return {open:true,text:"Açık · kapanış "+fmt(r.c)};
    if(r.d.includes(String(prev)) && r.c>1440 && ctx.min<r.c-1440) return {open:true,text:"Açık · kapanış "+fmt(r.c)};
  }
  const later=rs.filter(r=>r.d.includes(String(ctx.day))&&r.o>ctx.min).sort((a,b)=>a.o-b.o)[0];
  if(later) return {open:false,text:"Kapalı · açılış "+fmt(later.o)};
  const tom=rs.filter(r=>r.d.includes(String((ctx.day+1)%7))).sort((a,b)=>a.o-b.o)[0];
  return {open:false,text: tom? "Kapalı · yarın "+fmt(tom.o) : "Bugün kapalı"};
}
const store={
  get(k,d){try{const v=localStorage.getItem(k);return v?JSON.parse(v):d;}catch(e){return d;}},
  set(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}
};
let toastT=null;
function toast(msg){const t=$("#toast");t.textContent=msg;t.hidden=false;clearTimeout(toastT);toastT=setTimeout(()=>t.hidden=true,2000);}
function mapsUrl(v){return v.url || "https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(v.n+", "+v.a+", München");}

/* ================= mekan deposu ================= */
const BY_ID = {};
(window.NEREYE_SAMPLE||[]).forEach(v=>{ v.rules=rulesFromSample(v.h); BY_ID[v.id]=v; });
const SAMPLE_IDS = Object.keys(BY_ID);

/* ================= Google (canlı veri) ================= */
const live = { source: API_KEY ? "google" : "osm", ready:false, failed:null, cache:new Map(), lib:null };
window.gm_authFailure = function(){ live.failed="Google anahtarı reddedildi (anahtar yanlış ya da bu site adresine izin verilmemiş)."; live.ready=false; rebuild(); };
function loadGoogle(){
  if(live.loading) return live.loading;
  live.loading = new Promise((resolve,reject)=>{
    window.__nereyeMapsReady=()=>resolve();
    const s=document.createElement("script");
    s.src="https://maps.googleapis.com/maps/api/js?key="+encodeURIComponent(API_KEY)+"&v=weekly&loading=async&language=tr&region=DE&callback=__nereyeMapsReady";
    s.async=true; s.onerror=()=>reject(new Error("Google Maps yüklenemedi"));
    document.head.appendChild(s);
  }).then(()=>google.maps.importLibrary("places")).then(lib=>{ live.lib=lib; live.ready=true; return lib; });
  return live.loading;
}
const PRICE_MAP={FREE:1,INEXPENSIVE:1,MODERATE:2,EXPENSIVE:3,VERY_EXPENSIVE:4};
function categoryOf(types){
  types=types||[];
  if(types.some(t=>["bar","pub","wine_bar","night_club","cocktail_bar"].includes(t))) return "bar";
  if(types.some(t=>["cafe","coffee_shop","bakery","tea_house"].includes(t)) && !types.includes("restaurant")) return "cafe";
  return "food";
}
function rulesFromPeriods(periods){
  const rules=[]; let always=false;
  (periods||[]).forEach(p=>{
    if(!p||!p.open) return;
    if(!p.close){ always=true; return; }
    const od=(p.open.day+6)%7, cd=(p.close.day+6)%7;
    const o=p.open.hour*60+(p.open.minute||0);
    let c=((cd-od+7)%7)*1440 + p.close.hour*60+(p.close.minute||0);
    if(c<=o) c+=7*1440;
    rules.push({d:String(od),o,c});
  });
  return {rules,always};
}
const FIELDS=["id","displayName","location","rating","userRatingCount","regularOpeningHours","priceLevel","primaryType","primaryTypeDisplayName","formattedAddress","googleMapsURI","types"];
async function searchNearby(center, radiusKm, types){
  const {Place}=live.lib;
  const req={fields:FIELDS, locationRestriction:{center:{lat:center.lat,lng:center.lon}, radius:Math.min(50000,Math.round(radiusKm*1000))}, includedTypes:types, maxResultCount:20, language:"tr", region:"de"};
  try{ return (await Place.searchNearby(req)).places||[]; }
  catch(e){
    // Bir tür ya da alan adı reddedilirse daha sade istekle bir kez daha dene
    const simple={...req, fields:FIELDS.filter(f=>f!=="primaryTypeDisplayName"), includedTypes:[types[0]]};
    return (await Place.searchNearby(simple)).places||[];
  }
}
function toVenue(p){
  const types=p.types||[];
  const {rules,always}=rulesFromPeriods(p.regularOpeningHours&&p.regularOpeningHours.periods);
  const addr=(p.formattedAddress||"").split(",")[0];
  return {
    id:"g_"+p.id, live:true,
    n:p.displayName||"İsimsiz mekan", c:categoryOf(types),
    k:p.primaryTypeDisplayName||"", a:addr,
    p:PRICE_MAP[String(p.priceLevel||"").toUpperCase()]||0,
    lat:p.location.lat(), lon:p.location.lng(),
    rating:typeof p.rating==="number"?p.rating:null, ratingCount:p.userRatingCount||0,
    rules, always, url:p.googleMapsURI||null, t:""
  };
}
async function fetchGoogle(origin, radiusKm, cats){
  await loadGoogle();
  const ids=new Set();
  for(const c of cats){
    const types=CATS[c].types; if(!types) continue;
    // Oturum içi önbellek: aynı yer, mesafe ve kategori için tekrar istek atma (sadece bellekte, kalıcı değil)
    const key=[origin.lat.toFixed(3),origin.lon.toFixed(3),radiusKm,c].join("|");
    let list=live.cache.get(key);
    if(!list){
      const places=await searchNearby(origin,radiusKm,types);
      list=places.map(toVenue);
      // Kategori, mekanın hangi aramadan geldiğine göre belirlenir (ör. kafe aramasından gelen yer "Kafe")
      list.forEach(v=>{ if(BY_ID[v.id]) { v.c=BY_ID[v.id].c; } else { v.c=c; } BY_ID[v.id]=v; });
      live.cache.set(key,list.map(v=>v.id));
      list=list.map(v=>v.id);
    }
    list.forEach(id=>ids.add(id));
  }
  return [...ids];
}
/* ================= OpenStreetMap (canlı, ücretsiz, anahtarsız) ================= */
const OVERPASS = ["https://overpass-api.de/api/interpreter","https://overpass.private.coffee/api/interpreter"];
const OSM_AMENITY = { food:["restaurant","fast_food"], bar:["bar","pub"], beer:["biergarten"], cafe:["cafe"] };
const CUISINE_TR = {
  italian:"İtalyan", pizza:"Pizza", burger:"Burger", german:"Alman", bavarian:"Bavyera", regional:"Yöresel",
  turkish:"Türk", kebab:"Döner · kebap", asian:"Asya", japanese:"Japon", sushi:"Sushi", ramen:"Ramen",
  chinese:"Çin", korean:"Kore", thai:"Tayland", vietnamese:"Vietnam", indian:"Hint", nepalese:"Nepal",
  mexican:"Meksika", greek:"Yunan", spanish:"İspanyol", french:"Fransız", lebanese:"Lübnan", syrian:"Suriye",
  persian:"İran", arab:"Arap", american:"Amerikan", steak_house:"Steakhouse", seafood:"Deniz ürünleri",
  fish:"Balık", vegan:"Vegan", vegetarian:"Vejetaryen", international:"Uluslararası", sandwich:"Sandviç",
  bagel:"Bagel", falafel:"Falafel", chicken:"Tavuk", bakery:"Fırın", cake:"Pasta", ice_cream:"Dondurma",
  coffee_shop:"Kahve", breakfast:"Kahvaltı", austrian:"Avusturya", african:"Afrika", ethiopian:"Etiyopya",
  georgian:"Gürcü", russian:"Rus", portuguese:"Portekiz", peruvian:"Peru", hawaiian:"Hawaii", poke:"Poke",
  noodle:"Erişte", dumplings:"Mantı · dumpling", tapas:"Tapas", wine:"Şarap", beer:"Bira", cocktail:"Kokteyl"
};
const AMENITY_TR = { restaurant:"Restoran", fast_food:"Hızlı yemek", bar:"Bar", pub:"Pub", biergarten:"Biergarten", cafe:"Kafe" };
const DAYS = ["Mo","Tu","We","Th","Fr","Sa","Su"];

// OSM opening_hours alanının yaygın biçimlerini çözer: "Mo-Fr 11:00-23:00; Sa,Su 12:00-01:00; Mo off", "24/7".
// Çözülemeyen bir şey görürse null döner (saat bilinmiyor).
function parseOsmHours(str){
  if(!str) return null;
  str=String(str).trim();
  if(/^24\/7$/.test(str)) return {always:true,rules:[]};
  const perDay=[null,null,null,null,null,null,null];
  const parts=str.split(/\s*(?:;|\|\|)\s*/).filter(Boolean);
  for(let part of parts){
    part=part.replace(/"[^"]*"/g,"").trim();
    if(/^(PH|SH)\b/.test(part)) continue;              // resmi tatil kuralları: atla
    let m=part.match(/^((?:Mo|Tu|We|Th|Fr|Sa|Su)(?:\s*[-,]\s*(?:Mo|Tu|We|Th|Fr|Sa|Su))*)(?:\s*,\s*PH)?\s*(.*)$/);
    let days, rest;
    if(m){ days=expandDays(m[1].replace(/\s+/g,"")); rest=m[2].trim(); }
    else { days=[0,1,2,3,4,5,6]; rest=part; }
    if(!days) return null;
    rest=rest.replace(/\bopen\b/,"").trim();
    let spans;
    if(/^(off|closed)$/i.test(rest)) spans=[];
    else{
      spans=[];
      for(const t of rest.replace(/\s+/g,"").split(",").filter(Boolean)){
        const tm=t.match(/^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})\+?$/) || t.match(/^(\d{1,2}):(\d{2})\+$/);
        if(!tm) return null;
        const o=Number(tm[1])*60+Number(tm[2]);
        let c= tm[3]!=null ? Number(tm[3])*60+Number(tm[4]) : o+6*60;
        if(c<=o) c+=1440;
        spans.push([o,c]);
      }
    }
    days.forEach(d=>perDay[d]=spans);
  }
  const rules=[];
  perDay.forEach((spans,d)=>{ (spans||[]).forEach(([o,c])=>rules.push({d:String(d),o,c})); });
  if(perDay.every(x=>x===null)) return null;
  return {always:false,rules};
}
function expandDays(sel){
  const out=new Set();
  for(const piece of sel.split(",")){
    const r=piece.split("-");
    const a=DAYS.indexOf(r[0]), b= r[1]!=null ? DAYS.indexOf(r[1]) : a;
    if(a<0||b<0) return null;
    for(let i=a;;i=(i+1)%7){ out.add(i); if(i===b) break; }
  }
  return [...out];
}
function osmToVenue(e){
  const t=e.tags||{};
  const lat=e.lat!=null?e.lat:(e.center&&e.center.lat), lon=e.lon!=null?e.lon:(e.center&&e.center.lon);
  if(lat==null||lon==null||!t.name) return null;
  const am=t.amenity;
  const c= am==="biergarten" ? "beer" : (am==="bar"||am==="pub") ? "bar" : am==="cafe" ? "cafe" : "food";
  const cuisines=(t.cuisine||"").split(";").map(x=>x.trim().toLowerCase()).filter(Boolean);
  let kind=cuisines.map(x=>CUISINE_TR[x]).filter(Boolean).slice(0,2).join(" · ");
  if(!kind && (t["diet:vegan"]==="only")) kind="Vegan";
  kind = kind ? (am==="restaurant"? kind : AMENITY_TR[am]+" · "+kind) : (AMENITY_TR[am]||"");
  const street=[t["addr:street"],t["addr:housenumber"]].filter(Boolean).join(" ");
  const h=parseOsmHours(t.opening_hours);
  const extras=[];
  if(t.outdoor_seating==="yes") extras.push("Dış mekan oturma var");
  if(t["diet:vegan"]==="yes"||t["diet:vegan"]==="only") extras.push("Vegan seçenek");
  if(t.wheelchair==="yes") extras.push("Tekerlekli sandalyeye uygun");
  return {
    id:"o_"+e.type[0]+e.id, live:true, src:"osm",
    n:t.name, c, k:kind, a:street || t["addr:suburb"] || "",
    p:0, lat, lon, rating:null, ratingCount:0,
    rules:h?h.rules:null, always:!!(h&&h.always),
    url:null, t:extras.join(" · ")
  };
}
async function overpass(query){
  let lastErr;
  for(const url of OVERPASS){
    try{
      const ctrl=new AbortController(); const timer=setTimeout(()=>ctrl.abort(),25000);
      const r=await fetch(url,{method:"POST",body:"data="+encodeURIComponent(query),headers:{"Content-Type":"application/x-www-form-urlencoded"},signal:ctrl.signal});
      clearTimeout(timer);
      if(r.ok) return await r.json();
      lastErr=new Error("OpenStreetMap şu an yoğun (HTTP "+r.status+").");
    }catch(err){ lastErr=new Error("OpenStreetMap'e ulaşılamadı."); }
  }
  throw lastErr;
}
async function fetchOSM(origin, radiusKm, cats){
  const amenities=[...new Set(cats.flatMap(c=>OSM_AMENITY[c]||[]))];
  if(!amenities.length) return [];
  const r=Math.round(Math.min(6,radiusKm)*1000);
  const key=["osm",origin.lat.toFixed(3),origin.lon.toFixed(3),r,amenities.sort().join(",")].join("|");
  if(live.cache.has(key)) return live.cache.get(key);
  const q=`[out:json][timeout:25];nwr["amenity"~"^(${amenities.join("|")})$"]["name"](around:${r},${origin.lat.toFixed(5)},${origin.lon.toFixed(5)});out center tags 2000;`;
  const data=await overpass(q);
  const ids=[];
  (data.elements||[]).forEach(e=>{ const v=osmToVenue(e); if(v){ BY_ID[v.id]=v; ids.push(v.id); } });
  live.cache.set(key,ids);
  return ids;
}
async function fetchLive(origin, radiusKm, cats){
  return live.source==="google" ? fetchGoogle(origin,radiusKm,cats) : fetchOSM(origin,radiusKm,cats);
}
function useLive(){ return !live.failed; }


/* ================= konum (GPS) ================= */
const gps = { pos:null, asking:false, error:null };
function requestGps(){
  return new Promise(resolve=>{
    if(!("geolocation" in navigator)){ gps.error="Bu tarayıcı konumu desteklemiyor."; resolve(false); return; }
    if(!window.isSecureContext){ gps.error="Konum sadece https adreslerinde çalışır."; resolve(false); return; }
    gps.asking=true; render();
    navigator.geolocation.getCurrentPosition(p=>{
      gps.asking=false; gps.error=null;
      gps.pos={lat:p.coords.latitude, lon:p.coords.longitude, acc:p.coords.accuracy};
      resolve(true);
    }, err=>{
      gps.asking=false;
      gps.error = err.code===1 ? "Konum izni verilmedi. Tarayıcı ayarlarından izin verebilir ya da noktayı elle seçebilirsin." : "Konum bulunamadı, noktayı elle seç.";
      resolve(false);
    }, {enableHighAccuracy:true, timeout:12000, maximumAge:60000});
  });
}
async function useMyLocation(){
  const ok=await requestGps();
  if(ok){ state.cfg.origin="gps"; saveCfg(); state.flow=null; rebuild(); toast("Konumun kullanılıyor"); }
  else { toast(gps.error||"Konum alınamadı"); if(state.cfg.origin==="gps"){ state.cfg.origin="marienplatz"; saveCfg(); } rebuild(); }
}

/* ================= durum ================= */
const state = {
  cfg: Object.assign({origin:"marienplatz",radius:2,cats:["food","bar","beer","cafe"],prices:[1,2,3,4],openOnly:true,hour:"now"}, store.get("nereye.cfg",{})),
  deck:[], pos:0, history:[], dist:{}, ctx:null, loading:false, error:null,
  favs: store.get("nereye.favs",{}),
  flow:null, group:null, busy:false, buildSeq:0
};
if(!ORIGINS[state.cfg.origin]) state.cfg.origin="marienplatz";

function originPoint(){
  const o=ORIGINS[state.cfg.origin];
  if(o.gps) return gps.pos ? {label:"Konumun",lat:gps.pos.lat,lon:gps.pos.lon,gps:true} : {...ORIGINS.marienplatz};
  return o;
}
function activeCats(cats){ return useLive() && live.source==="google" ? cats.filter(c=>CATS[c].types) : cats; }
function effective(){
  const c=state.cfg;
  if(state.flow){
    const last=BY_ID[state.flow.stops[state.flow.stops.length-1]];
    return {origin:{label:last.n,lat:last.lat,lon:last.lon},radius:1.2,cats:activeCats(["bar","beer"]),prices:c.prices,openOnly:true,hour:state.flow.hour};
  }
  const cats=activeCats(c.cats);
  return {origin:originPoint(),radius:c.radius,cats:cats.length?cats:["food"],prices:c.prices,openOnly:c.openOnly,hour:c.hour};
}
async function buildDeck(e){
  const ctx=timeCtx(e.hour), dist={};
  const exclude = state.flow? new Set(state.flow.stops):new Set();
  const pool = useLive() ? await fetchLive(e.origin,e.radius,e.cats) : SAMPLE_IDS;
  const ids=pool.filter(id=>{
    const v=BY_ID[id]; if(!v||exclude.has(id)) return false;
    const d=distKm(e.origin,v); dist[id]=d;
    if(d>e.radius*1.05) return false;
    if(!e.cats.includes(v.c)) return false;
    if(v.p && !e.prices.includes(v.p)) return false;
    if(e.openOnly && openInfo(v,ctx).open!==true) return false;
    return true;
  }).sort((a,b)=>dist[a]-dist[b]);
  return {ids,dist,ctx};
}
async function rebuild(){
  const seq=++state.buildSeq;
  state.loading=true; state.error=null; state.deck=[]; state.pos=0; state.history=[];
  render();
  try{
    const b=await buildDeck(effective());
    if(seq!==state.buildSeq) return;
    state.deck=b.ids; state.dist=b.dist; state.ctx=b.ctx;
  }catch(err){
    if(seq!==state.buildSeq) return;
    console.error(err);
    state.error = (err&&err.message)||"Mekanlar yüklenemedi";
  }
  state.loading=false;
  render();
}
function distFor(id){ return state.dist[id]!=null ? state.dist[id] : distKm(effective().origin,BY_ID[id]); }

/* ================= çizim ================= */
const GLYPHS={
 food:'<svg class="glyph" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 8v18a6 6 0 0 0 12 0V8M26 8v48"/><path d="M44 56V8c-6 4-8 12-8 22h8"/></svg>',
 bar:'<svg class="glyph" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 10h44L32 34z"/><path d="M32 34v20M20 56h24M44 4l-6 14"/><circle cx="20" cy="16" r="2.5" fill="currentColor"/></svg>',
 beer:'<svg class="glyph" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 20h28v34a4 4 0 0 1-4 4H18a4 4 0 0 1-4-4z"/><path d="M42 26h6a6 6 0 0 1 6 6v8a6 6 0 0 1-6 6h-6"/><path d="M12 20c0-6 5-10 10-9 2-4 8-5 11-2 4-2 10 1 10 7v4"/><path d="M22 30v20M30 30v20"/></svg>',
 cafe:'<svg class="glyph" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 26h34v12a14 14 0 0 1-14 14h-6a14 14 0 0 1-14-14z"/><path d="M46 30h4a6 6 0 0 1 0 12h-5"/><path d="M8 58h44M22 6c-3 4 3 6 0 12M32 6c-3 4 3 6 0 12"/></svg>'
};
function cardEl(v){
  const card=el("article","card"); card.dataset.id=v.id;
  const cover=el("div","cover"); cover.style.setProperty("--c","var("+CATS[v.c].color+")");
  cover.insertAdjacentHTML("beforeend",GLYPHS[v.c]);
  cover.appendChild(el("span","kind",CATS[v.c].label));
  cover.appendChild(el("span","stamp like","EVET"));
  cover.appendChild(el("span","stamp pass","GEÇ"));
  cover.appendChild(el("span","stamp super","SÜPER"));
  const body=el("div","body");
  body.appendChild(el("h2","name",v.n));
  body.appendChild(el("div","sub",[v.k,v.a].filter(Boolean).join(" · ")));
  const meta=el("div","meta");
  if(v.rating!=null){ meta.appendChild(el("span","rating","★ "+v.rating.toFixed(1).replace(".",","))); meta.appendChild(el("span","mono","("+v.ratingCount.toLocaleString("tr-TR")+")")); }
  const oi=openInfo(v,state.ctx||timeCtx("now"));
  meta.appendChild(el("span","status "+(oi.open?"open":"closed"),oi.text));
  meta.appendChild(el("span","mono",distLabel(distFor(v.id))));
  if(v.p) meta.appendChild(el("span","mono",price(v.p)));
  body.appendChild(meta);
  if(v.t) body.appendChild(el("p","note",v.t));
  const foot=el("div","footrow");
  const a=el("a","gmaps","Google Maps'te aç ↗"); a.href=mapsUrl(v); a.target="_blank"; a.rel="noopener";
  foot.appendChild(a);
  if(v.live) foot.appendChild(el("span","attr", v.src==="osm" ? "© OpenStreetMap katkıcıları" : "Veri: Google Maps"));
  body.appendChild(foot);
  card.append(cover,body);
  return card;
}
function currentDeck(){ return state.group ? state.group.deck : state.deck; }
function currentPos(){ return state.group ? state.group.pos : state.pos; }

function render(){
  renderSummary();
  $("#favCount").textContent=Object.keys(state.favs).filter(id=>BY_ID[id]||state.favs[id].snap).length;
  const deckEl=$("#deck"); deckEl.textContent="";
  const deck=currentDeck(), pos=currentPos();
  const remaining = state.loading? [] : deck.slice(pos,pos+3);
  const enable = remaining.length>0 && !state.busy;
  ["#aPass","#aLike","#aStar"].forEach(s=>$(s).disabled=!enable);
  $("#aUndo").disabled = !canUndo();
  if(state.loading){
    const box=el("div","empty"); box.appendChild(el("div","spinner")); box.appendChild(el("p",null, gps.asking?"Konumun alınıyor…":(useLive()?"Yakındaki mekanlar aranıyor…":"Mekanlar hazırlanıyor…")));
    deckEl.appendChild(box); return;
  }
  if(state.error){ deckEl.appendChild(emptyBox("Mekanlar yüklenemedi",state.error,[["Tekrar dene",()=>rebuild(),true],["Örnek veriyle devam",()=>{live.failed="Örnek veriye geçildi.";rebuild();}]])); return; }
  if(!remaining.length){ deckEl.appendChild(endState()); return; }
  remaining.slice().reverse().forEach((id,i,arr)=>{
    const depth=arr.length-1-i;
    const c=cardEl(BY_ID[id]);
    if(depth===1) c.classList.add("under1");
    if(depth===2) c.classList.add("under2");
    if(depth===0) attachDrag(c); else c.setAttribute("aria-hidden","true");
    deckEl.appendChild(c);
  });
}
function emptyBox(title,text,buttons){
  const box=el("div","empty"); box.appendChild(el("h2",null,title)); box.appendChild(el("p",null,text));
  const row=el("div","row"); buttons.forEach(([label,fn,primary])=>{const b=el("button","btn"+(primary?" primary":""),label);b.onclick=fn;row.appendChild(b);}); box.appendChild(row);
  return box;
}
function endState(){
  const g=state.group;
  if(g) return emptyBox("Bitti","Sonuçlara bakabilirsin.",[["Sonuçlar",()=>openResults(),true]]);
  const any=state.deck.length>0;
  if(state.flow) return emptyBox("Yakında başka yer yok","Bu durağın 1,2 km çevresinde o saatte açık bar kalmadı.",[["Planı gör",()=>openPlan(),true]]);
  const btns=[];
  if(state.cfg.radius<6) btns.push(["Mesafeyi artır",()=>{state.cfg.radius=Math.min(6,state.cfg.radius+1.5);saveCfg();rebuild();},true]);
  if(state.cfg.openOnly) btns.push(["Kapalıları da göster",()=>{state.cfg.openOnly=false;saveCfg();rebuild();}]);
  if(state.cfg.hour==="now") btns.push(["20:00 için bak",()=>{state.cfg.hour="20";saveCfg();rebuild();}]);
  if(any) btns.push(["Baştan",()=>{state.pos=0;state.history=[];render();}]);
  return emptyBox(any?"Hepsini gördün":"Bu filtreyle yer yok", any?"Beğendiklerin favorilerde. Çemberi büyütebilir ya da baştan alabilirsin.":"Mesafeyi büyüt ya da saati değiştir.",btns);
}
function pillBtn(label,fn,cls){ const p=el("span","pill"+(cls?" "+cls:"")); const b=el("button",null,label); b.onclick=fn; p.appendChild(b); return p; }
function renderSummary(){
  const s=$("#summary"); s.textContent="";
  const g=state.group;
  if(g){
    s.appendChild(el("span","pill strong",g.players[g.cur]+" seçiyor"));
    s.appendChild(el("span","pill mono",Math.min(g.pos+1,g.deck.length)+"/"+g.deck.length));
    s.appendChild(el("span","pill",(g.cur+1)+". kişi / "+g.players.length));
    s.appendChild(pillBtn("Sonuçlar",openResults));
    return;
  }
  if(state.flow){
    s.appendChild(el("span","pill flow","Plan: "+state.flow.stops.map(id=>BY_ID[id].n).join(" → ")+" → ?"));
    s.appendChild(pillBtn("Planı gör",openPlan));
    return;
  }
  const e=effective();
  if(e.origin.gps) s.appendChild(el("span","pill gps","Konumun"));
  else {
    const p=pillBtn(e.origin.label,()=>openSheet("sheetFilter")); p.querySelector("button").style.textDecoration="none"; s.appendChild(p);
    if("geolocation" in navigator) s.appendChild(pillBtn(gps.asking?"Konum alınıyor…":"Konumumu kullan",useMyLocation));
  }
  s.appendChild(el("span","pill mono",String(e.radius).replace(".",",")+" km"));
  s.appendChild(el("span","pill",(e.openOnly?(e.hour==="now"?"Şimdi açık":timeCtx(e.hour).label+" açık"):"Tüm saatler")));
  s.appendChild(el("span","pill"+(useLive()?" live":""), useLive()?(live.source==="osm"?"Canlı · OSM":"Canlı · Google"):"Örnek veri"));
}

/* ================= swipe ================= */
function attachDrag(card){
  let start=null;
  const stamps={like:card.querySelector(".stamp.like"),pass:card.querySelector(".stamp.pass"),super:card.querySelector(".stamp.super")};
  card.addEventListener("pointerdown",e=>{
    if(e.target.closest("a,button")||state.busy) return;
    start={x:e.clientX,y:e.clientY,id:e.pointerId,dx:0,dy:0};
    card.setPointerCapture(e.pointerId); card.classList.add("dragging");
  });
  card.addEventListener("pointermove",e=>{
    if(!start||e.pointerId!==start.id) return;
    start.dx=e.clientX-start.x; start.dy=e.clientY-start.y;
    card.style.transform=`translate(${start.dx}px,${start.dy}px) rotate(${start.dx/18}deg)`;
    stamps.like.style.opacity=Math.max(0,Math.min(1,start.dx/100));
    stamps.pass.style.opacity=Math.max(0,Math.min(1,-start.dx/100));
    stamps.super.style.opacity=Math.max(0,Math.min(1,(-start.dy-40)/90))*(Math.abs(start.dx)<80?1:0);
  });
  const end=e=>{
    if(!start||e.pointerId!==start.id) return;
    const {dx,dy}=start; start=null; card.classList.remove("dragging");
    if(dx>100) decide("like");
    else if(dx<-100) decide("pass");
    else if(dy<-120 && Math.abs(dx)<80) decide("super");
    else { card.style.transform=""; Object.values(stamps).forEach(s=>s.style.opacity=0); }
  };
  card.addEventListener("pointerup",end);
  card.addEventListener("pointercancel",end);
}
function decide(action){
  if(state.busy||state.loading) return;
  const deck=currentDeck(), pos=currentPos();
  if(!deck||pos>=deck.length) return;
  const id=deck[pos], card=$("#deck .card:last-child");
  state.busy=true;
  if(card){
    const st=card.querySelector(".stamp."+action); if(st) st.style.opacity=1;
    card.style.transition= reduce? "none":"transform .28s ease, opacity .28s ease";
    card.style.transform= action==="like"?"translate(140%,-4%) rotate(18deg)": action==="pass"?"translate(-140%,-4%) rotate(-18deg)":"translate(0,-130%)";
    card.style.opacity="0";
  }
  apply(id,action);
  setTimeout(()=>{state.busy=false; afterAdvance();}, reduce?0:260);
}
function ctxKey(){ return state.group ? "local:"+state.group.cur : "solo"; }
function snapshot(v){ return {id:v.id,n:v.n,c:v.c,k:v.k,a:v.a,p:v.p,lat:v.lat,lon:v.lon,url:mapsUrl(v),live:!!v.live}; }
function apply(id,action){
  const g=state.group, liked= action!=="pass";
  state.history.push({id,action,ctx:ctxKey(),prevFav:state.favs[id]?{...state.favs[id]}:null});
  if(!g){
    if(liked){
      // Google içeriği kalıcı saklanmaz: canlı mekanlarda sadece kimlik, isim ve link tutulur
      const v=BY_ID[id];
      state.favs[id]={star: action==="super" || !!(state.favs[id]&&state.favs[id].star), snap: v.live? {n:v.n,c:v.c,url:mapsUrl(v)} : null};
      saveFavs();
    }
    state.pos++;
    if(state.flow && liked){ state.flow.stops.push(id); state.flow.hour=bumpHour(state.flow.hour); toast("Plana eklendi"); setTimeout(openPlan, reduce?0:300); }
    else if(liked) toast(action==="super"?"Süper favori ★":"Favorilere eklendi");
  }else{
    if(liked) g.likes[g.cur].add(id);
    g.pos++;
  }
}
function canUndo(){const h=state.history[state.history.length-1]; return !!h && h.ctx===ctxKey() && currentPos()>0 && !(state.flow&&h.action!=="pass");}
function undo(){
  if(!canUndo()||state.busy) return;
  const h=state.history.pop(), g=state.group;
  if(!g){ if(h.prevFav) state.favs[h.id]=h.prevFav; else delete state.favs[h.id]; saveFavs(); state.pos--; }
  else { g.likes[g.cur].delete(h.id); g.pos--; }
  render();
}
function afterAdvance(){
  const g=state.group;
  if(g && g.pos>=g.deck.length){
    if(g.cur<g.players.length-1){ showHandoff(); return; }
    render(); openResults(); return;
  }
  render();
}
function bumpHour(h){ if(h==="now"){ const n=berlinNow(); return String((Math.floor(n.min/60)+2)%24);} return String((Number(h)+2)%24); }

/* ================= favoriler ================= */
function saveFavs(){store.set("nereye.favs",state.favs);}
function saveCfg(){store.set("nereye.cfg",state.cfg);}
function favView(id){
  const v=BY_ID[id]; if(v) return v;
  const s=state.favs[id]&&state.favs[id].snap; if(!s) return null;
  return {id,n:s.n,c:s.c,k:"",a:"",p:0,url:s.url,stale:true};
}
function renderFavs(){
  const list=$("#favList"); list.textContent="";
  const ids=Object.keys(state.favs).filter(id=>favView(id));
  if(!ids.length){ list.appendChild(el("p","fine","Henüz favori yok. Sağa kaydırdığın yerler burada birikir.")); return; }
  ids.sort((a,b)=>(state.favs[b].star?1:0)-(state.favs[a].star?1:0));
  const ctx=timeCtx("now");
  ids.forEach(id=>{
    const v=favView(id), it=el("div","item");
    const dot=el("span","dot"); dot.style.background="var("+CATS[v.c].color+")";
    it.append(dot, el("span","t",(state.favs[id].star?"★ ":"")+v.n), el("span","mono",price(v.p)));
    const s=el("div","s");
    if(!v.stale){ const oi=openInfo(v,ctx); s.append(el("span",null,[v.k,v.a].filter(Boolean).join(" · ")), el("span","status "+(oi.open?"open":"closed"),oi.text)); }
    else s.append(el("span",null,"Güncel bilgi için Google Maps'e bak"));
    it.appendChild(s);
    const acts=el("div","acts");
    const a=el("a","linkbtn","Google Maps ↗"); a.href=mapsUrl(v); a.target="_blank"; a.rel="noopener"; acts.appendChild(a);
    if(!v.stale && (v.c==="food"||v.c==="cafe")){ const f=el("button","linkbtn","Sonra nereye? Bar seç"); f.onclick=()=>{closeSheet("sheetFavs"); startFlow(id);}; acts.appendChild(f); }
    const r=el("button","linkbtn danger","Çıkar"); r.onclick=()=>{delete state.favs[id]; saveFavs(); renderFavs(); render();}; acts.appendChild(r);
    it.appendChild(acts); list.appendChild(it);
  });
}

/* ================= gece akışı ================= */
function startFlow(id){
  if(state.group) endGroup(true);
  state.flow={stops:[id],hour:bumpHour(state.cfg.hour)};
  rebuild();
  toast(BY_ID[id].n+" sonrası için yakın barlar");
}
function openPlan(){
  const ch=$("#planChain"); ch.textContent="";
  if(!state.flow){ closeSheet("sheetPlan"); return; }
  state.flow.stops.forEach((id,i)=>{
    const v=BY_ID[id];
    if(i>0){ const prev=BY_ID[state.flow.stops[i-1]]; ch.appendChild(el("div","leg",distLabel(distKm(prev,v)))); }
    const st=el("div","stop"); const pin=el("span","pin"); pin.style.background="var("+CATS[v.c].color+")";
    const txt=el("div"); const t=el("div","t",v.n); t.style.fontWeight="700"; txt.appendChild(t);
    const sub=el("div","sub",[v.k,v.a].filter(Boolean).join(" · ")+" · "); const a=el("a","linkbtn","Maps ↗"); a.href=mapsUrl(v); a.target="_blank"; a.rel="noopener"; sub.appendChild(a);
    txt.appendChild(sub); st.append(pin,txt); ch.appendChild(st);
  });
  $("#planMore").textContent = state.flow.stops.length>1 ? "Bir durak daha" : "Bar seçmeye devam";
  openSheet("sheetPlan");
}
$("#planMore").onclick=()=>{closeSheet("sheetPlan"); rebuild();};
$("#planDone").onclick=()=>{
  if(state.flow){ state.flow.stops.forEach(id=>{ if(!state.favs[id]){ const v=BY_ID[id]; state.favs[id]={star:false,snap:v.live?{n:v.n,c:v.c,url:mapsUrl(v)}:null}; } }); saveFavs(); }
  state.flow=null; closeSheet("sheetPlan"); rebuild(); toast("Plan favorilerde");
};

/* ================= paneller ================= */
function openSheet(id){ if(id==="sheetFilter") fillFilter(); if(id==="sheetFavs") renderFavs(); $("#"+id).hidden=false; const f=$("#"+id).querySelector("button,select,input"); if(f) f.focus({preventScroll:true}); }
function closeSheet(id){ $("#"+id).hidden=true; }
document.querySelectorAll(".scrim").forEach(s=>{
  s.addEventListener("click",e=>{ if(e.target===s||e.target.closest("[data-close]")) s.hidden=true; });
});
document.addEventListener("keydown",e=>{
  const open=[...document.querySelectorAll(".scrim")].find(s=>!s.hidden);
  if(e.key==="Escape" && open){ open.hidden=true; return; }
  if(open || !$("#handoff").hidden || e.target.matches("input,select,textarea")) return;
  if(e.key==="ArrowRight") decide("like");
  else if(e.key==="ArrowLeft") decide("pass");
  else if(e.key==="ArrowUp"){ e.preventDefault(); decide("super"); }
  else if(e.key==="Backspace"||(e.key==="z"&&(e.metaKey||e.ctrlKey))) undo();
});

/* filtreler */
let draft=null;
function fillFilter(){
  draft=JSON.parse(JSON.stringify(state.cfg));
  const o=$("#fOrigin"); o.textContent="";
  Object.entries(ORIGINS).forEach(([k,v])=>{ if(v.gps && !("geolocation" in navigator)) return; const op=el("option",null,v.gps?"Konumum (GPS)":v.label); op.value=k; o.appendChild(op);}); o.value=draft.origin;
  $("#fRadius").value=draft.radius; $("#radiusOut").textContent=String(draft.radius).replace(".",",")+" km";
  const hs=$("#fHour"); hs.textContent="";
  HOURS.forEach(h=>{const op=el("option",null,h==="now"?"Şimdi":fmt(Number(h)*60)); op.value=h; hs.appendChild(op);}); hs.value=draft.hour;
  $("#fOpen").checked=draft.openOnly;
  chipSet("#fCats",Object.entries(CATS).filter(([k,v])=>!(useLive()&&live.source==="google")||v.types).map(([k,v])=>[k,v.label]),draft.cats);
  chipSet("#fPrice",[[1,"€"],[2,"€€"],[3,"€€€"],[4,"€€€€"]],draft.prices);
  $("#dataNote").textContent = useLive()
    ? (live.source==="osm"
        ? "Canlı veri: mekanlar ve açılış saatleri OpenStreetMap'ten geliyor (ücretsiz, anahtarsız). Fiyat ve puan bilgisi yok; puan için karttaki Google Maps linkine bak. Saati girilmemiş mekanlar \"sadece açık\" filtresinde gizlenir."
        : "Canlı veri: mekanlar, puanlar ve saatler Google Maps'ten geliyor.")
    : (live.failed ? live.failed+" Şu an örnek veri kullanılıyor." : "Örnek veri: Münih'teki gerçek mekanlar, açılış saatleri tahmini.");
}
function chipSet(sel,opts,arr){
  const box=$(sel); box.textContent="";
  opts.forEach(([val,label])=>{
    const b=el("button","chip",label); b.type="button"; b.setAttribute("aria-pressed",arr.includes(val));
    b.onclick=()=>{const i=arr.indexOf(val); if(i>=0){ if(arr.length>1) arr.splice(i,1);} else arr.push(val); b.setAttribute("aria-pressed",arr.includes(val));};
    box.appendChild(b);
  });
}
$("#fRadius").addEventListener("input",e=>{draft.radius=Number(e.target.value); $("#radiusOut").textContent=String(draft.radius).replace(".",",")+" km";});
$("#fOrigin").addEventListener("change",e=>draft.origin=e.target.value);
$("#fHour").addEventListener("change",e=>draft.hour=e.target.value);
$("#fOpen").addEventListener("change",e=>draft.openOnly=e.target.checked);
$("#applyFilter").onclick=async()=>{
  const wantsGps = draft.origin==="gps" && !gps.pos;
  state.cfg=draft; state.flow=null; saveCfg(); closeSheet("sheetFilter");
  if(wantsGps) await useMyLocation(); else rebuild();
};

/* butonlar */
$("#aLike").onclick=()=>decide("like");
$("#aPass").onclick=()=>decide("pass");
$("#aStar").onclick=()=>decide("super");
$("#aUndo").onclick=undo;
$("#aFilter").onclick=()=>{ if(state.group){ toast("Grup sırasında filtre değişmez"); return;} openSheet("sheetFilter"); };
$("#btnFavs").onclick=()=>openSheet("sheetFavs");
$("#btnGroup").onclick=()=>{ if(state.group){ openResults(); return; } renderPlayers(); openSheet("sheetGroup"); };

/* ================= grup: tek telefon ================= */
let players=store.get("nereye.players",["",""]);
if(!Array.isArray(players)||players.length<2) players=["",""];
function renderPlayers(){
  const list=$("#playerList"); list.textContent="";
  players.forEach((p,i)=>{
    const row=el("div"); row.style.display="flex"; row.style.gap="8px";
    const inp=el("input"); inp.type="text"; inp.id="player"+i; inp.maxLength=20; inp.placeholder=(i+1)+". kişinin adı"; inp.value=p;
    inp.addEventListener("input",()=>players[i]=inp.value);
    row.appendChild(inp);
    if(players.length>2){ const x=el("button","btn small ghost","Sil"); x.onclick=()=>{players.splice(i,1); renderPlayers();}; row.appendChild(x); }
    list.appendChild(row);
  });
  $("#addPlayer").disabled=players.length>=6;
}
$("#addPlayer").onclick=()=>{ if(players.length<6){players.push(""); renderPlayers(); $("#player"+(players.length-1)).focus();} };
$("#startLocal").onclick=()=>{
  const names=players.map((p,i)=>p.trim()||((i+1)+". kişi"));
  store.set("nereye.players",players);
  if(state.flow||state.loading){ toast("Önce mekan listesi yüklensin"); return; }
  const ids=state.deck.slice(0,GROUP_SIZE);
  if(ids.length<2){ toast("Bu filtreyle yeterli mekan yok"); return; }
  state.group={players:names,cur:0,pos:0,likes:names.map(()=>new Set()),deck:ids};
  state.history=[];
  closeSheet("sheetGroup"); showHandoff();
};
function showHandoff(){
  const g=state.group;
  if(g.pos>=g.deck.length){ g.cur++; g.pos=0; }
  $("#handoffTitle").textContent="Sıra: "+g.players[g.cur];
  $("#handoffSub").textContent = g.cur===0 ? g.deck.length+" mekan var. Sağa kaydır evet, sola kaydır geç." : "Önceki kişinin seçimleri görünmüyor. Telefonu şimdi "+g.players[g.cur]+" alsın.";
  $("#handoff").hidden=false; render(); $("#handoffGo").focus();
}
$("#handoffGo").onclick=()=>{ $("#handoff").hidden=true; render(); };

/* sonuçlar */
function openResults(){ renderResults(); openSheet("sheetResults"); }
function renderResults(){
  const g=state.group; if(!g){ closeSheet("sheetResults"); return; }
  const ps=g.players.map((name,i)=>({name,likes:g.likes[i],done: i<g.cur || (i===g.cur && g.pos>=g.deck.length)}));
  const pl=$("#peopleList"); pl.textContent="";
  ps.forEach(p=>pl.appendChild(el("span","person"+(p.done?" done":""),p.name+(p.done?" ✓":""))));
  const list=$("#resultList"); list.textContent="";
  const n=ps.length, allDone=ps.every(p=>p.done);
  const scored=g.deck.map(id=>({id,c:ps.filter(p=>p.likes.has(id)).length})).filter(x=>x.c>0).sort((a,b)=>b.c-a.c);
  if(!allDone){ list.appendChild(el("p","fine","Herkes bitirince sonuçlar burada görünür. Erken bakmak sürprizi bozar.")); return; }
  if(!scored.length){ list.appendChild(el("p","fine","Ortak beğeni çıkmadı. Filtreyi genişletip tekrar deneyin.")); return; }
  list.appendChild(el("div","label", scored[0].c===n ? "Eşleşme var" : "Tam eşleşme yok, en çok beğenilenler"));
  scored.slice(0,8).forEach(({id,c})=>{
    const v=BY_ID[id], it=el("div","item");
    const dot=el("span","dot"); dot.style.background="var("+CATS[v.c].color+")";
    const meter=el("span","meter"); const fill=el("i"); fill.style.width=(c/n*100)+"%"; meter.appendChild(fill);
    it.append(dot, el("span","t",v.n), meter);
    const s=el("div","s"); s.append(el("span","mono",c+"/"+n+" kişi"), el("span",null,[v.k,v.a].filter(Boolean).join(" · ")));
    if(c===n) s.appendChild(el("span","match","Eşleşme"));
    it.appendChild(s);
    const acts=el("div","acts");
    const a=el("a","linkbtn","Google Maps ↗"); a.href=mapsUrl(v); a.target="_blank"; a.rel="noopener"; acts.appendChild(a);
    if(v.c==="food"||v.c==="cafe"){ const f=el("button","linkbtn","Sonra nereye? Bar seç"); f.onclick=()=>{ closeSheet("sheetResults"); startFlow(id); }; acts.appendChild(f); }
    it.appendChild(acts); list.appendChild(it);
  });
}
function endGroup(silent){
  if(!state.group) return;
  state.group=null; closeSheet("sheetResults"); $("#handoff").hidden=true;
  if(!silent){ state.pos=0; state.history=[]; render(); }
}
$("#endGroup").onclick=()=>endGroup(false);

/* ================= açılış ================= */
async function boot(){
  // Daha önce konum seçildiyse ve izin zaten verildiyse sormadan konumu al
  if(state.cfg.origin==="gps"){
    let granted=false;
    try{ if(navigator.permissions){ granted=(await navigator.permissions.query({name:"geolocation"})).state==="granted"; } }catch(e){}
    if(granted && await requestGps()){ rebuild(); return; }
    state.cfg.origin="marienplatz";
  }
  rebuild();
}
boot();
})();
