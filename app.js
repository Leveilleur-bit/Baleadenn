/* Baleadenn — sorties en famille en Cornouaille. Tout est stocké sur le téléphone. */
(function () {
"use strict";

// ---------- Constantes ----------
const QUIMPER = { lat: 47.9960, lon: -4.1020, label: "Quimper" };
const CATS = {
  plage:      { l: "Plages", e: "🏖️" },
  foret:      { l: "Forêts & nature", e: "🌳" },
  animaux:    { l: "Fermes & animaux", e: "🐐" },
  musee:      { l: "Musées & intérieur", e: "🏛️" },
  parc:       { l: "Parcs & jeux", e: "🎠" },
  patrimoine: { l: "Villages & patrimoine", e: "🏰" },
  vue:        { l: "Pointes & points de vue", e: "🌊" }
};
const CRITERIA = [
  { k: "poussette", l: "Accessible en poussette", e: "👶" },
  { k: "toilettes", l: "Toilettes sur place", e: "🚻" },
  { k: "piquenique", l: "Coin pique-nique", e: "🧺" },
  { k: "jeux", l: "Aire de jeux", e: "🛝" },
  { k: "animaux", l: "Animaux à voir", e: "🐾" },
  { k: "interieur", l: "À l'abri de la pluie", e: "☔" },
  { k: "gratuit", l: "Gratuit", e: "🆓" },
  { k: "resto", l: "Café ou crêperie", e: "☕" },
  { k: "parking", l: "Parking proche", e: "🅿️" },
  { k: "annee", l: "Ouvert toute l'année", e: "📅" },
  { k: "eau", l: "Pieds dans l'eau", e: "🌊" },
  { k: "courte", l: "Balade courte (< 1 h)", e: "⏱️" }
];
const DURS = [20, 40, 60, 90, 0];
const MOODS = [["😍", "Adoré"], ["🙂", "Aimé"], ["😐", "Bof"], ["😕", "Pas aimé"]];
const MONTHS = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
const DAYS = ["dim.","lun.","mar.","mer.","jeu.","ven.","sam."];
const KEY = "baleadenn.v1";

// ---------- État ----------
const defaults = () => ({
  settings: { onboarded: false, child: "", criteria: ["poussette", "toilettes", "interieur", "gratuit", "piquenique"], maxMin: 60, from: "home", home: { ...QUIMPER } },
  edits: {}, custom: [], hidden: [], fav: [], visits: []
});
let S;
try { S = Object.assign(defaults(), JSON.parse(localStorage.getItem(KEY) || "{}")); }
catch (e) { S = defaults(); }
S.settings = Object.assign(defaults().settings, S.settings);
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast("Mémoire pleine : impossible d'enregistrer"); } };

const F = { q: "", status: "all", cat: null, crit: new Set(), max: S.settings.maxMin };
let gps = null;          // {lat, lon}
let weatherDay = 0;

// ---------- Utilitaires ----------
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const today = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
const fmtDate = iso => { const d = new Date(iso + "T12:00"); return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`; };
function toast(msg) { const t = $("#toast"); t.textContent = msg; t.classList.remove("hidden"); clearTimeout(t._h); t._h = setTimeout(() => t.classList.add("hidden"), 2600); }
function km(a, b) {
  const R = 6371, r = x => x * Math.PI / 180;
  const dLa = r(b.lat - a.lat), dLo = r(b.lon - a.lon);
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
// Estimation du trajet en voiture : distance à vol d'oiseau × 1,25, à 65 km/h de moyenne.
const driveMin = (a, b) => Math.round(km(a, b) * 1.25 / 65 * 60 + 3);
const fmtMin = m => m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}`;
const origin = () => (S.settings.from === "gps" && gps) ? gps : S.settings.home;
const childName = () => S.settings.child.trim() || "l'enfant";

// ---------- Lieux ----------
function parseK(k) { if (typeof k === "object" && k) return k; const o = {}; String(k || "").split(/\s+/).filter(Boolean).forEach(x => o[x] = true); return o; }
function allPlaces() {
  const seed = (window.SEED_PLACES || []).filter(p => !S.hidden.includes(p.id)).map(p => {
    const e = S.edits[p.id] || {};
    return { ...p, k: parseK(p.k), ...e, k: e.k ? e.k : parseK(p.k), seed: true };
  });
  return seed.concat(S.custom.map(p => ({ ...p, k: parseK(p.k) })));
}
const placeById = id => allPlaces().find(p => p.id === id);
const visitsOf = id => S.visits.filter(v => v.placeId === id).sort((a, b) => b.date.localeCompare(a.date));
const isDone = id => S.visits.some(v => v.placeId === id);
const isFav = id => S.fav.includes(id);
const closedNow = (p, month) => Array.isArray(p.mo) && p.mo.length && !p.mo.includes(month || new Date().getMonth() + 1);
function enrich(p) { return { ...p, min: driveMin(origin(), p), done: isDone(p.id), fav: isFav(p.id) }; }

function filtered() {
  const q = F.q.trim().toLowerCase();
  return allPlaces().map(enrich).filter(p => {
    if (F.max && p.min > F.max) return false;
    if (F.status === "todo" && p.done) return false;
    if (F.status === "done" && !p.done) return false;
    if (F.status === "fav" && !p.fav) return false;
    if (F.cat && p.c !== F.cat) return false;
    for (const c of F.crit) if (!p.k[c]) return false;
    if (q && !(`${p.n} ${p.v} ${p.d || ""}`.toLowerCase().includes(q))) return false;
    return true;
  }).sort((a, b) => a.min - b.min);
}

function cardHTML(p) {
  const crits = CRITERIA.filter(c => p.k[c.k] && (S.settings.criteria.length === 0 || S.settings.criteria.includes(c.k))).map(c => `<span title="${esc(c.l)}">${c.e}</span>`).join("");
  const last = visitsOf(p.id)[0];
  return `<article class="card cat-${p.c}" data-open="${esc(p.id)}">
    <div class="ic">${CATS[p.c]?.e || "📍"}</div>
    <div class="body">
      <h3>${esc(p.n)}</h3>
      <div class="meta">${esc(p.v)} · 🚗 ~${fmtMin(p.min)}</div>
      <div class="crit">${crits}</div>
      ${p.done ? `<span class="badge b-done">✓ Fait${last ? " · " + "★".repeat(last.note || 0) : ""}</span>` : ""}
      ${last && last.refaire ? `<span class="badge b-again">↻ À refaire</span>` : ""}
      ${closedNow(p) ? `<span class="badge b-closed">Sans doute fermé ce mois-ci</span>` : ""}
    </div>
    <button class="fav" data-fav="${esc(p.id)}" aria-label="Envie">${p.fav ? "★" : "☆"}</button>
  </article>`;
}

// ---------- Vue Lieux ----------
function renderFilters() {
  $$("#fromSeg button").forEach(b => b.classList.toggle("on", b.dataset.from === S.settings.from));
  $("#durChips").innerHTML = DURS.map(d => `<button class="chip ${F.max === d ? "on" : ""}" data-dur="${d}">${d ? "≤ " + fmtMin(d) : "Toutes distances"}</button>`).join("");
  $$("#statusSeg button").forEach(b => b.classList.toggle("on", b.dataset.st === F.status));
  $("#catChips").innerHTML = `<button class="chip ${!F.cat ? "on" : ""}" data-cat="">Tout</button>` +
    Object.entries(CATS).map(([k, c]) => `<button class="chip ${F.cat === k ? "on" : ""}" data-cat="${k}">${c.e} ${c.l}</button>`).join("");
  const mine = CRITERIA.filter(c => S.settings.criteria.includes(c.k));
  $("#critChips").innerHTML = mine.map(c => `<button class="chip orange ${F.crit.has(c.k) ? "on" : ""}" data-crit="${c.k}">${c.e} ${c.l}</button>`).join("");
  $("#critChips").classList.toggle("hidden", mine.length === 0);
}
function renderList() {
  renderFilters();
  const items = filtered();
  $("#count").textContent = `${items.length} lieu${items.length > 1 ? "x" : ""} · départ ${S.settings.from === "gps" && gps ? "de ma position" : "de " + S.settings.home.label}`;
  $("#list").innerHTML = items.length ? items.map(cardHTML).join("") : `<div class="empty">Aucun lieu avec ces filtres.<br>Élargissez la durée de trajet ou retirez un critère.</div>`;
  updateHello();
}
function updateHello() {
  const n = S.settings.child.trim();
  $("#hello").textContent = n ? `Demat ! Les sorties de ${n} en Kerne` : "Demat ! Nos sorties en famille en Kerne";
}

$("#q").addEventListener("input", e => { F.q = e.target.value; renderList(); });
$("#v-lieux").addEventListener("click", e => {
  const t = e.target.closest("button");
  if (t) {
    if (t.dataset.from) { setFrom(t.dataset.from); return; }
    if (t.dataset.dur !== undefined) { F.max = +t.dataset.dur; renderList(); return; }
    if (t.dataset.st) { F.status = t.dataset.st; renderList(); return; }
    if (t.dataset.cat !== undefined) { F.cat = t.dataset.cat || null; renderList(); return; }
    if (t.dataset.crit) { F.crit.has(t.dataset.crit) ? F.crit.delete(t.dataset.crit) : F.crit.add(t.dataset.crit); renderList(); return; }
  }
});
document.addEventListener("click", e => {
  const fav = e.target.closest("[data-fav]");
  if (fav) { e.stopPropagation(); toggleFav(fav.dataset.fav); return; }
  const op = e.target.closest("[data-open]");
  if (op && !e.target.closest(".sheet") && !e.target.closest("img[data-photo]")) { openDetail(op.dataset.open); }
});
function toggleFav(id) {
  S.fav = isFav(id) ? S.fav.filter(x => x !== id) : S.fav.concat(id); save();
  refresh(); if (!$("#sheet").classList.contains("hidden") && currentDetail === id) openDetail(id, true);
}

function locate() {
  return new Promise((res, rej) => {
    if (!navigator.geolocation) return rej(new Error("Géolocalisation indisponible"));
    navigator.geolocation.getCurrentPosition(
      p => { gps = { lat: p.coords.latitude, lon: p.coords.longitude, label: "ma position" }; res(gps); },
      err => rej(err), { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 });
  });
}
function setFrom(f) {
  if (f === "gps") {
    toast("📍 Recherche de votre position…");
    locate().then(() => { S.settings.from = "gps"; save(); refresh(); toast("Position trouvée"); })
      .catch(() => { toast("Position refusée ou introuvable"); });
  } else { S.settings.from = "home"; save(); refresh(); }
}

// ---------- Navigation ----------
let currentView = "lieux";
$("#tabs").addEventListener("click", e => { const b = e.target.closest("button"); if (b) show(b.dataset.view); });
function show(v) {
  currentView = v;
  $$("#tabs button").forEach(b => b.classList.toggle("on", b.dataset.view === v));
  $$(".view").forEach(s => s.classList.toggle("active", s.id === "v-" + v));
  $("#fab").classList.toggle("hidden", !(v === "lieux" || v === "carte"));
  window.scrollTo(0, 0);
  if (v === "lieux") renderList();
  if (v === "carte") renderMap();
  if (v === "amzer") renderWeather();
  if (v === "souvenirs") renderMemories();
  if (v === "reglages") renderSettings();
}
function refresh() { show(currentView); }

// ---------- Feuille (avec bouton retour Android) ----------
let sheetOpen = false, onSheetClose = null;
function openSheet(html, mount) {
  if (pickMap) { pickMap.remove(); pickMap = null; }
  $("#sheetIn").innerHTML = html;
  $("#sheet").classList.remove("hidden");
  $("#sheetIn").scrollTop = 0;
  document.body.style.overflow = "hidden";
  if (!sheetOpen) { history.pushState({ sheet: 1 }, ""); sheetOpen = true; }
  if (mount) mount($("#sheetIn"));
}
function closeSheet(fromPop) {
  if (!sheetOpen) return;
  sheetOpen = false;
  $("#sheet").classList.add("hidden");
  document.body.style.overflow = "";
  $("#sheetIn").innerHTML = "";
  if (pickMap) { pickMap.remove(); pickMap = null; }
  if (onSheetClose) { const f = onSheetClose; onSheetClose = null; f(); }
  if (!fromPop) history.back();
}
window.addEventListener("popstate", () => {
  if (!$("#lightbox").classList.contains("hidden")) { $("#lightbox").classList.add("hidden"); return; }
  if (sheetOpen) closeSheet(true);
});
$("#sheet").addEventListener("click", e => { if (e.target.id === "sheet") closeSheet(); });
const head = (title, extra = "") => `<div class="sheet-head">${extra}<h2>${title}</h2><button class="x" data-close>✕</button></div>`;
$("#sheetIn").addEventListener("click", e => { if (e.target.closest("[data-close]")) closeSheet(); });

// ---------- Photos (IndexedDB) ----------
let dbP;
function db() {
  if (!dbP) dbP = new Promise((res, rej) => {
    const r = indexedDB.open("baleadenn", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("photos");
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
  return dbP;
}
async function idb(mode, fn) {
  const d = await db();
  return new Promise((res, rej) => {
    const tx = d.transaction("photos", mode); const st = tx.objectStore("photos");
    const r = fn(st); tx.oncomplete = () => res(r && r.result); tx.onerror = () => rej(tx.error);
  });
}
const putPhoto = (id, blob) => idb("readwrite", s => s.put(blob, id));
const getPhoto = id => idb("readonly", s => s.get(id));
const delPhoto = id => idb("readwrite", s => s.delete(id));
const urlCache = new Map();
async function photoURL(id) {
  if (urlCache.has(id)) return urlCache.get(id);
  const b = await getPhoto(id); if (!b) return "";
  const u = URL.createObjectURL(b); urlCache.set(id, u); return u;
}
async function hydratePhotos(root) {
  for (const img of $$("img[data-photo]", root)) img.src = await photoURL(img.dataset.photo);
}
async function compress(file) {
  let bmp;
  try { bmp = await createImageBitmap(file, { imageOrientation: "from-image" }); }
  catch (e) { bmp = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(file); }); }
  const max = 1600, w = bmp.width, h = bmp.height, r = Math.min(1, max / Math.max(w, h));
  const c = document.createElement("canvas"); c.width = Math.round(w * r); c.height = Math.round(h * r);
  c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise(res => c.toBlob(b => res(b), "image/jpeg", 0.82));
}
document.addEventListener("click", async e => {
  const img = e.target.closest("img[data-photo]");
  if (img && !e.target.closest(".photo-new")) { $("#lbImg").src = await photoURL(img.dataset.photo); $("#lightbox").classList.remove("hidden"); history.pushState({ lb: 1 }, ""); }
});
$("#lightbox").addEventListener("click", () => history.back());

// ---------- Détail d'un lieu ----------
let currentDetail = null;
function openDetail(id, keepScroll) {
  const p0 = placeById(id); if (!p0) return;
  const p = enrich(p0); currentDetail = id;
  const vs = visitsOf(id);
  const ordered = CRITERIA.slice().sort((a, b) => S.settings.criteria.includes(b.k) - S.settings.criteria.includes(a.k));
  const critHTML = ordered.map(c => {
    const v = p.k[c.k];
    const cls = v === true ? "y" : v === false ? "n" : "u";
    return `<div class="${cls}">${v === true ? "✓" : v === false ? "✗" : "?"} ${c.e} ${esc(c.l)}</div>`;
  }).join("");
  const nav = `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lon}`;
  const scroll = $("#sheetIn").scrollTop;
  openSheet(`${head(esc(p.n), `<span style="font-size:28px">${CATS[p.c]?.e || "📍"}</span>`)}
    <div class="muted">${esc(p.v)} · ${esc(CATS[p.c]?.l || "")} · 🚗 ~${fmtMin(p.min)} depuis ${S.settings.from === "gps" && gps ? "ma position" : esc(S.settings.home.label)}</div>
    ${p.s ? `<div class="info">🗓️ ${esc(p.s)}${closedNow(p) ? " — <b style='color:var(--ruz)'>sans doute fermé ce mois-ci</b>" : ""}</div>` : ""}
    ${p.d ? `<p>${esc(p.d)}</p>` : ""}
    <div class="btns">
      <a class="btn primary" href="${nav}" target="_blank" rel="noopener">🧭 Y aller</a>
      <button class="btn" data-fav="${esc(id)}">${p.fav ? "★ Dans mes envies" : "☆ Envie d'y aller"}</button>
      <button class="btn orange wide" id="addVisit">✍️ Raconter une sortie ici</button>
    </div>
    <div class="label">Infos pratiques</div>
    <div class="info crit-list">${critHTML}</div>
    <div class="label">Nos sorties ici (${vs.length})</div>
    ${vs.length ? vs.map(visitHTML).join("") : `<div class="muted" style="padding:6px 0 4px">Pas encore venus. À découvrir !</div>`}
    <div class="btns">
      <button class="btn" id="editPlace">✏️ Modifier le lieu</button>
      <button class="btn danger" id="delPlace">${p.seed ? "🙈 Masquer" : "🗑️ Supprimer"}</button>
    </div>`, root => {
    if (keepScroll) root.scrollTop = scroll;
    hydratePhotos(root);
    $("#addVisit", root).onclick = () => openVisitForm(id);
    $("#editPlace", root).onclick = () => openPlaceForm(id);
    $("#delPlace", root).onclick = () => {
      if (p.seed) {
        if (!confirm("Masquer ce lieu de la liste ? (Récupérable dans les réglages)")) return;
        S.hidden.push(id);
      } else {
        if (!confirm("Supprimer ce lieu et ses sorties ?")) return;
        S.custom = S.custom.filter(x => x.id !== id);
        visitsOf(id).forEach(v => (v.photos || []).forEach(delPhoto));
        S.visits = S.visits.filter(v => v.placeId !== id);
      }
      save(); closeSheet(); refresh();
    };
    $$("[data-editvisit]", root).forEach(b => b.onclick = () => openVisitForm(id, b.dataset.editvisit));
  });
}
function visitHTML(v) {
  const mood = MOODS[v.plu] ? `${MOODS[v.plu][0]} ${esc(MOODS[v.plu][1])} par ${esc(childName())}` : "";
  return `<div class="memo">
    <div style="display:flex;gap:8px;align-items:center"><div style="flex:1"><b>${fmtDate(v.date)}</b>
    <div><span class="stars">${"★".repeat(v.note || 0)}${"☆".repeat(5 - (v.note || 0))}</span> ${mood}</div></div>
    <button class="x" data-editvisit="${esc(v.id)}" aria-label="Modifier">✏️</button></div>
    ${v.refaire ? `<span class="badge b-again">↻ À refaire</span>` : ""}
    ${v.comment ? `<p>${esc(v.comment)}</p>` : ""}
    ${(v.photos || []).length ? `<div class="thumbs">${v.photos.map(ph => `<img data-photo="${esc(ph)}" alt="">`).join("")}</div>` : ""}
  </div>`;
}

// ---------- Formulaire de sortie ----------
function openVisitForm(placeId, visitId) {
  const p = placeById(placeId);
  const old = visitId ? S.visits.find(v => v.id === visitId) : null;
  const v = old ? { ...old, photos: [...(old.photos || [])] } : { id: uid(), placeId, date: today(), note: 0, plu: null, comment: "", refaire: false, photos: [] };
  const pending = []; // {tmp, blob}
  const removed = [];
  const draw = root => {
    $(".starpick", root).innerHTML = [1, 2, 3, 4, 5].map(n => `<button type="button" data-star="${n}" class="${v.note >= n ? "on" : ""}">★</button>`).join("");
    $(".moodpick", root).innerHTML = MOODS.map((m, i) => `<button type="button" data-mood="${i}" class="${v.plu === i ? "on" : ""}" title="${m[1]}">${m[0]}</button>`).join("");
    $(".photo-new", root).innerHTML =
      v.photos.map(ph => `<div class="ph"><img data-photo="${esc(ph)}" alt=""><button type="button" class="rm" data-rmold="${esc(ph)}">✕</button></div>`).join("") +
      pending.map((x, i) => `<div class="ph"><img src="${x.url}" alt=""><button type="button" class="rm" data-rmnew="${i}">✕</button></div>`).join("");
    hydratePhotos($(".photo-new", root));
  };
  openSheet(`${head(old ? "Modifier la sortie" : "Raconter une sortie")}
    <div class="muted">${esc(p.n)}</div>
    <div class="field"><label>Date</label><input type="date" id="vDate" value="${esc(v.date)}"></div>
    <div class="field"><label>Notre note</label><div class="starpick"></div></div>
    <div class="field"><label>Ça a plu à ${esc(childName())} ?</label><div class="moodpick"></div></div>
    <div class="field"><label>Nos notes</label><textarea id="vCom" placeholder="Ce qu'on a vu, ce qu'il faut savoir pour la prochaine fois…">${esc(v.comment)}</textarea></div>
    <label class="check"><input type="checkbox" id="vAgain" ${v.refaire ? "checked" : ""}> ↻ À refaire</label>
    <div class="field"><label>Photos</label>
      <input type="file" id="vFiles" accept="image/*" multiple class="hidden">
      <button type="button" class="btn" id="vAdd" style="width:100%">📷 Ajouter des photos</button>
      <div class="photo-new"></div>
    </div>
    <div class="btns">
      ${old ? `<button class="btn danger" id="vDel">🗑️ Supprimer</button>` : `<button class="btn" data-close>Annuler</button>`}
      <button class="btn primary" id="vSave">💾 Enregistrer</button>
    </div>`, root => {
    draw(root);
    root.addEventListener("click", e => {
      const s = e.target.closest("[data-star]"); if (s) { v.note = +s.dataset.star === v.note ? 0 : +s.dataset.star; draw(root); }
      const m = e.target.closest("[data-mood]"); if (m) { v.plu = v.plu === +m.dataset.mood ? null : +m.dataset.mood; draw(root); }
      const ro = e.target.closest("[data-rmold]"); if (ro) { removed.push(ro.dataset.rmold); v.photos = v.photos.filter(x => x !== ro.dataset.rmold); draw(root); }
      const rn = e.target.closest("[data-rmnew]"); if (rn) { pending.splice(+rn.dataset.rmnew, 1); draw(root); }
    });
    $("#vAdd", root).onclick = () => $("#vFiles", root).click();
    $("#vFiles", root).onchange = async e => {
      const files = Array.from(e.target.files || []); e.target.value = "";
      toast(`Préparation de ${files.length} photo${files.length > 1 ? "s" : ""}…`);
      for (const f of files) { try { const b = await compress(f); pending.push({ blob: b, url: URL.createObjectURL(b) }); } catch (err) { toast("Une photo n'a pas pu être lue"); } }
      draw(root);
    };
    if (old) $("#vDel", root).onclick = () => {
      if (!confirm("Supprimer cette sortie et ses photos ?")) return;
      (old.photos || []).forEach(delPhoto);
      S.visits = S.visits.filter(x => x.id !== old.id); save();
      openDetail(placeId); refresh();
    };
    $("#vSave", root).onclick = async () => {
      v.date = $("#vDate", root).value || today();
      v.comment = $("#vCom", root).value.trim();
      v.refaire = $("#vAgain", root).checked;
      try {
        for (const x of pending) { const pid = "ph_" + uid(); await putPhoto(pid, x.blob); v.photos.push(pid); }
        for (const r of removed) await delPhoto(r);
      } catch (err) { toast("Erreur en enregistrant les photos (mémoire pleine ?)"); return; }
      S.visits = S.visits.filter(x => x.id !== v.id).concat(v); save();
      toast(old ? "Sortie modifiée" : "Sortie ajoutée — trugarez !");
      openDetail(placeId); refresh();
    };
  });
}

// ---------- Formulaire de lieu (questionnaire) ----------
let pickMap = null;
function openPlaceForm(id, preset) {
  const old = id ? placeById(id) : null;
  const p = old ? { ...old, k: { ...old.k } } : { id: "c_" + uid(), n: "", v: "", c: "foret", d: "", s: "", k: {}, lat: preset?.lat ?? origin().lat, lon: preset?.lon ?? origin().lon };
  const triRow = c => {
    const v = p.k[c.k];
    return `<div class="tri"><span>${c.e} ${esc(c.l)}</span><div class="seg" data-tri="${c.k}">
      <button type="button" data-v="1" class="${v === true ? "on" : ""}">Oui</button>
      <button type="button" data-v="0" class="${v === false ? "on" : ""}">Non</button>
      <button type="button" data-v="" class="${v === undefined || v === null ? "on" : ""}">?</button></div></div>`;
  };
  openSheet(`${head(old ? "Modifier le lieu" : "Nouveau lieu")}
    <div class="field"><label>Nom</label><input type="text" id="pN" value="${esc(p.n)}" placeholder="Ex. : Le parc près de chez mamie"></div>
    <div class="field"><label>Commune</label><input type="text" id="pV" value="${esc(p.v)}"></div>
    <div class="field"><label>Type de sortie</label><select id="pC">${Object.entries(CATS).map(([k, c]) => `<option value="${k}" ${p.c === k ? "selected" : ""}>${c.e} ${c.l}</option>`).join("")}</select></div>
    <div class="field"><label>Description</label><textarea id="pD">${esc(p.d)}</textarea></div>
    <div class="field"><label>Ouverture / saison</label><input type="text" id="pS" value="${esc(p.s || "")}" placeholder="Ex. : avril à septembre"></div>
    <div class="field"><label>Emplacement — touchez la carte</label>
      <div id="pickmap"></div>
      <div class="btns"><button type="button" class="btn" id="pGps">📍 Je suis sur place</button><button type="button" class="btn" id="pCenter">🎯 Centrer</button></div>
    </div>
    <div class="label">Questionnaire pratique</div>
    <div class="info">${CRITERIA.map(triRow).join("")}</div>
    <div class="btns"><button class="btn" data-close>Annuler</button><button class="btn primary" id="pSave">💾 Enregistrer</button></div>`, root => {
    root.addEventListener("click", e => {
      const b = e.target.closest("[data-tri] button"); if (!b) return;
      const k = b.parentElement.dataset.tri;
      p.k[k] = b.dataset.v === "1" ? true : b.dataset.v === "0" ? false : undefined;
      if (p.k[k] === undefined) delete p.k[k];
      $$("button", b.parentElement).forEach(x => x.classList.toggle("on", x === b));
    });
    setTimeout(() => {
      pickMap = L.map($("#pickmap", root), { zoomControl: true }).setView([p.lat, p.lon], old ? 14 : 11);
      tiles().addTo(pickMap);
      const mk = L.marker([p.lat, p.lon], { draggable: true, icon: L.divIcon({ className: "", iconSize: [34, 34], iconAnchor: [17, 41],
        html: `<div class="pin cat-${p.c}" style="position:relative;--cat:var(--orange)"><span>📌</span></div>` }) }).addTo(pickMap);
      const set = (la, lo) => { p.lat = +la.toFixed(5); p.lon = +lo.toFixed(5); mk.setLatLng([p.lat, p.lon]); };
      pickMap.on("click", e => set(e.latlng.lat, e.latlng.lng));
      mk.on("dragend", () => { const ll = mk.getLatLng(); set(ll.lat, ll.lng); });
      $("#pGps", root).onclick = () => locate().then(g => { set(g.lat, g.lon); pickMap.setView([g.lat, g.lon], 15); }).catch(() => toast("Position introuvable"));
      $("#pCenter", root).onclick = () => pickMap.setView([p.lat, p.lon], 14);
    }, 60);
    $("#pSave", root).onclick = () => {
      p.n = $("#pN", root).value.trim(); if (!p.n) { toast("Donnez un nom au lieu"); return; }
      p.v = $("#pV", root).value.trim(); p.c = $("#pC", root).value; p.d = $("#pD", root).value.trim(); p.s = $("#pS", root).value.trim();
      if (old && old.seed) {
        S.edits[p.id] = { n: p.n, v: p.v, c: p.c, d: p.d, s: p.s, lat: p.lat, lon: p.lon, k: p.k };
      } else {
        const rec = { id: p.id, n: p.n, v: p.v, c: p.c, d: p.d, s: p.s, lat: p.lat, lon: p.lon, k: p.k };
        S.custom = S.custom.filter(x => x.id !== p.id).concat(rec);
      }
      save(); toast("Lieu enregistré");
      openDetail(p.id); refresh();
    };
  });
}
$("#fab").onclick = () => {
  if (currentView === "carte" && map) { const c = map.getCenter(); openPlaceForm(null, { lat: c.lat, lon: c.lng }); }
  else openPlaceForm(null);
};

// ---------- Carte ----------
let map = null, layer = null;
const tiles = () => L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, attribution: "© OpenStreetMap" });
function renderMap() {
  if (typeof L === "undefined") { $("#map").innerHTML = `<div class="empty">La carte a besoin d'internet pour se charger.</div>`; return; }
  if (!map) {
    map = L.map("map").setView([S.settings.home.lat, S.settings.home.lon], 9);
    tiles().addTo(map);
    layer = L.layerGroup().addTo(map);
    $("#map").addEventListener("click", e => { const b = e.target.closest("[data-pop]"); if (b) openDetail(b.dataset.pop); });
    const Loc = L.Control.extend({ onAdd() {
      const b = L.DomUtil.create("button", "leaflet-bar"); b.innerHTML = "📍"; b.title = "Ma position";
      b.style.cssText = "width:38px;height:38px;background:#fff;font-size:18px;border:2px solid rgba(0,0,0,.2);border-radius:6px";
      L.DomEvent.on(b, "click", ev => { L.DomEvent.stop(ev); locate().then(g => { drawMarkers(); map.setView([g.lat, g.lon], 12); }).catch(() => toast("Position introuvable")); });
      return b; } });
    new Loc({ position: "topleft" }).addTo(map);
    $("#legend").innerHTML = Object.values(CATS).map(c => `<span>${c.e} ${c.l}</span>`).join("") + `<span>✅ déjà fait</span>`;
  }
  setTimeout(() => map.invalidateSize(), 50);
  drawMarkers();
}
function drawMarkers() {
  layer.clearLayers();
  const h = S.settings.home;
  L.marker([h.lat, h.lon], { icon: L.divIcon({ className: "", html: `<div class="home-pin">🏠</div>`, iconSize: [26, 26], iconAnchor: [13, 13] }) }).addTo(layer);
  if (gps) L.marker([gps.lat, gps.lon], { icon: L.divIcon({ className: "", html: `<div class="me-dot"></div>`, iconSize: [16, 16], iconAnchor: [8, 8] }) }).addTo(layer);
  allPlaces().map(enrich).forEach(p => {
    const icon = L.divIcon({ className: "", iconSize: [34, 34], iconAnchor: [17, 41], popupAnchor: [0, -38],
      html: `<div class="pin cat-${p.c} ${p.done ? "done" : ""}" style="position:relative"><span>${CATS[p.c]?.e || "📍"}</span></div>` });
    L.marker([p.lat, p.lon], { icon }).addTo(layer).bindPopup(
      `<b>${esc(p.n)}</b><br>${esc(p.v)} · 🚗 ~${fmtMin(p.min)}${p.done ? "<br>✅ déjà fait" : ""}<button class="pop-btn" data-pop="${esc(p.id)}">Voir le lieu</button>`);
  });
}

// ---------- Météo ----------
const WMO = c => {
  if (c === 0) return ["☀️", "Grand soleil", "Heol"];
  if (c <= 2) return ["🌤️", "Éclaircies", "Heol ha koumoul"];
  if (c === 3) return ["☁️", "Couvert", "Koumoulek"];
  if (c === 45 || c === 48) return ["🌫️", "Brouillard", "Brumenn"];
  if (c >= 51 && c <= 57) return ["🌦️", "Bruine", "Glav munut"];
  if (c >= 61 && c <= 67) return ["🌧️", "Pluie", "Glav"];
  if (c >= 71 && c <= 77) return ["🌨️", "Neige", "Erc'h"];
  if (c >= 80 && c <= 82) return ["🌦️", "Averses", "Kawadoù"];
  if (c >= 95) return ["⛈️", "Orage", "Taran"];
  return ["🌥️", "Variable", "Amzer cheñch"];
};
const rainy = d => (d.code >= 51 && d.code <= 67) || (d.code >= 80) || d.pp >= 60 || d.sum >= 3;
async function fetchWeather() {
  const o = origin();
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${o.lat.toFixed(3)}&longitude=${o.lon.toFixed(3)}` +
    `&current=temperature_2m,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,wind_speed_10m_max` +
    `&timezone=Europe%2FParis&forecast_days=7`;
  const r = await fetch(url); if (!r.ok) throw new Error("météo");
  const j = await r.json();
  const data = { at: Date.now(), where: S.settings.from === "gps" && gps ? "ma position" : S.settings.home.label,
    now: { t: j.current.temperature_2m, code: j.current.weather_code, wind: j.current.wind_speed_10m },
    days: j.daily.time.map((t, i) => ({ date: t, code: j.daily.weather_code[i], max: j.daily.temperature_2m_max[i], min: j.daily.temperature_2m_min[i],
      pp: j.daily.precipitation_probability_max[i] ?? 0, sum: j.daily.precipitation_sum[i] ?? 0, wind: j.daily.wind_speed_10m_max[i] ?? 0 })) };
  try { localStorage.setItem("baleadenn.meteo", JSON.stringify(data)); } catch (e) {}
  return data;
}
async function renderWeather() {
  const box = $("#weather");
  let data = null;
  try { data = JSON.parse(localStorage.getItem("baleadenn.meteo") || "null"); } catch (e) {}
  if (data) drawWeather(data, true); else box.innerHTML = `<div class="empty">⏳ Chargement de la météo…</div>`;
  try { data = await fetchWeather(); if (currentView === "amzer") drawWeather(data, false); }
  catch (e) { if (!data) box.innerHTML = `<div class="empty">Météo indisponible (pas de réseau ?).<br><button class="btn" id="wRetry">Réessayer</button></div>`;
    else toast("Météo hors ligne : dernières prévisions affichées");
    const b = $("#wRetry"); if (b) b.onclick = renderWeather; }
}
function drawWeather(data, stale) {
  const box = $("#weather");
  if (weatherDay >= data.days.length) weatherDay = 0;
  const n = WMO(data.now.code);
  const d = data.days[weatherDay];
  const dd = new Date(d.date + "T12:00");
  const dayName = weatherDay === 0 ? "aujourd'hui" : weatherDay === 1 ? "demain" : `${["dimanche","lundi","mardi","mercredi","jeudi","vendredi","samedi"][dd.getDay()]}`;
  const wet = rainy(d), windy = d.wind >= 45;
  const month = dd.getMonth() + 1;
  let ideas = allPlaces().map(enrich).filter(p => (!F.max || p.min <= Math.max(F.max, 20)) && !closedNow(p, month));
  ideas = wet ? ideas.filter(p => p.k.interieur) : ideas.filter(p => !p.k.interieur && !(windy && p.c === "vue"));
  ideas.sort((a, b) => (a.done - b.done) || (b.fav - a.fav) || (a.min - b.min));
  ideas = ideas.slice(0, 8);
  box.innerHTML = `
    <div class="now"><div class="w">${n[0]}</div><div style="flex:1"><div class="t">${Math.round(data.now.t)}°</div><div>${n[1]} · vent ${Math.round(data.now.wind)} km/h</div></div><div class="br">${n[2]}</div></div>
    <div class="muted" style="font-size:12px;margin-top:4px">Prévisions pour ${esc(data.where)}${stale ? " · mise à jour…" : ""}</div>
    <div class="days">${data.days.map((x, i) => { const w = WMO(x.code); const dt = new Date(x.date + "T12:00"); const we = dt.getDay() === 0 || dt.getDay() === 6;
      return `<button class="day ${we ? "we" : ""} ${i === weatherDay ? "on" : ""}" data-wd="${i}"><div class="d">${i === 0 ? "Auj." : DAYS[dt.getDay()] + " " + dt.getDate()}</div><div class="w">${w[0]}</div><div class="t">${Math.round(x.min)}° / ${Math.round(x.max)}°</div><div class="p">💧 ${x.pp}%</div></button>`; }).join("")}</div>
    <div class="advice ${wet ? "rain" : "sun"}">${wet
      ? `☔ ${WMO(d.code)[2]} ! Pluie probable ${dayName} (${d.pp}%). Voici des idées à l'abri :`
      : `${WMO(d.code)[0]} ${dayName.charAt(0).toUpperCase() + dayName.slice(1)} s'annonce sec (${d.pp}% de risque de pluie). Idées dehors :`}</div>
    ${windy ? `<div class="advice wind">💨 Avel bras ! Vent fort (${Math.round(d.wind)} km/h) : évitez les pointes et les falaises avec le petit.</div>` : ""}
    <div class="list">${ideas.length ? ideas.map(cardHTML).join("") : `<div class="empty">Pas d'idée dans la durée de trajet choisie (onglet Lieux).</div>`}</div>
    <p class="muted" style="font-size:12px">Les lieux pas encore faits et vos envies passent en premier. Données météo : Open-Meteo.</p>`;
  $$("[data-wd]", box).forEach(b => b.onclick = () => { weatherDay = +b.dataset.wd; drawWeather(data, false); });
}

// ---------- Souvenirs ----------
function renderMemories() {
  const box = $("#memories");
  const vs = S.visits.slice().sort((a, b) => b.date.localeCompare(a.date));
  const places = new Set(vs.map(v => v.placeId));
  const total = allPlaces().length;
  const photos = vs.reduce((n, v) => n + (v.photos || []).length, 0);
  let html = `<h2>Eñvorennoù <small>nos souvenirs</small></h2>
    <div class="stats"><div class="stat"><b>${vs.length}</b><span>sorties</span></div><div class="stat"><b>${places.size}/${total}</b><span>lieux découverts</span></div><div class="stat"><b>${photos}</b><span>photos</span></div></div>`;
  if (!vs.length) html += `<div class="empty">Pas encore de souvenirs.<br>Ouvrez un lieu puis « Raconter une sortie ».</div>`;
  let cur = "";
  for (const v of vs) {
    const p = placeById(v.placeId); if (!p) continue;
    const d = new Date(v.date + "T12:00"); const m = `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
    if (m !== cur) { cur = m; html += `<div class="month">${m.charAt(0).toUpperCase() + m.slice(1)}</div>`; }
    html += `<div class="memo" data-open="${esc(p.id)}"><h3>${CATS[p.c]?.e || ""} ${esc(p.n)}</h3>
      <div class="when">${fmtDate(v.date)} · <span class="stars">${"★".repeat(v.note || 0)}</span> ${MOODS[v.plu] ? MOODS[v.plu][0] : ""} ${v.refaire ? "· ↻ à refaire" : ""}</div>
      ${v.comment ? `<p>${esc(v.comment.length > 180 ? v.comment.slice(0, 180) + "…" : v.comment)}</p>` : ""}
      ${(v.photos || []).length ? `<div class="thumbs">${v.photos.map(ph => `<img data-photo="${esc(ph)}" alt="">`).join("")}</div>` : ""}</div>`;
  }
  box.innerHTML = html;
  hydratePhotos(box);
}

// ---------- Réglages ----------
function questionnaireHTML() {
  return `<div class="field"><label>Prénom de l'enfant</label><input type="text" id="sChild" value="${esc(S.settings.child)}" placeholder="Pour « Ça a plu à … ? »"></div>
    <div class="field"><label>Qu'est-ce qui compte pour vos sorties ?</label>
      <div class="muted" style="font-size:14px;margin-bottom:4px">Les critères cochés deviennent des filtres et s'affichent sur les fiches.</div>
      ${CRITERIA.map(c => `<label class="check"><input type="checkbox" data-sc="${c.k}" ${S.settings.criteria.includes(c.k) ? "checked" : ""}> ${c.e} ${esc(c.l)}</label>`).join("")}
    </div>
    <div class="field"><label>Trajet maximum par défaut</label><select id="sMax">${DURS.map(d => `<option value="${d}" ${S.settings.maxMin === d ? "selected" : ""}>${d ? "≤ " + fmtMin(d) : "Toutes distances"}</option>`).join("")}</select></div>`;
}
function readQuestionnaire(root) {
  S.settings.child = $("#sChild", root).value.trim();
  S.settings.criteria = $$("[data-sc]", root).filter(x => x.checked).map(x => x.dataset.sc);
  S.settings.maxMin = +$("#sMax", root).value; F.max = S.settings.maxMin;
  F.crit = new Set([...F.crit].filter(k => S.settings.criteria.includes(k)));
  save();
}
async function renderSettings() {
  const box = $("#settings");
  const h = S.settings.home;
  box.innerHTML = `<h2>Arventennoù <small>réglages</small></h2>
    <div class="section"><h3>Mon questionnaire</h3>${questionnaireHTML()}<button class="btn primary" id="sSave" style="width:100%">💾 Enregistrer</button></div>
    <div class="section"><h3>Maison</h3>
      <div class="muted">Point de départ : <b>${esc(h.label)}</b> (${h.lat.toFixed(3)}, ${h.lon.toFixed(3)})</div>
      <div class="btns"><button class="btn" id="sHomeGps">📍 Ma position = maison</button><button class="btn" id="sHomeQ">↺ Quimper centre</button></div></div>
    <div class="section"><h3>Sauvegarde</h3>
      <div class="muted" style="font-size:14px">Tout est gardé uniquement sur ce téléphone. Faites une sauvegarde de temps en temps (Google Drive, mail…).</div>
      <label class="check"><input type="checkbox" id="sWithPh" checked> Inclure les photos</label>
      <div class="btns"><button class="btn primary" id="sExport">⬇️ Sauvegarder</button><button class="btn" id="sImport">⬆️ Restaurer</button></div>
      <input type="file" id="sFile" accept="application/json,.json" class="hidden">
      <div class="muted" id="sUsage" style="font-size:13px"></div></div>
    ${S.hidden.length ? `<div class="section"><h3>Lieux masqués</h3><div class="muted">${S.hidden.length} lieu(x) masqué(s).</div><button class="btn" id="sUnhide" style="width:100%;margin-top:8px">👀 Tout réafficher</button></div>` : ""}
    <div class="section"><h3>Petit lexique</h3><div class="lexique">
      <b>Demat</b><span>Bonjour</span><b>Kenavo</b><span>Au revoir</span><b>Trugarez</b><span>Merci</span>
      <b>Baleadenn</b><span>Balade, promenade</span><b>Mor</b><span>Mer</span><b>Koad</b><span>Bois, forêt</span>
      <b>Heol</b><span>Soleil</span><b>Glav</b><span>Pluie</span><b>Avel</b><span>Vent</span><b>Kerne</b><span>Cornouaille</span></div></div>
    <div class="foot">Baleadenn · Kenavo ar wech all ! ⚘</div>`;
  $("#sSave").onclick = () => { readQuestionnaire(box); toast("Réglages enregistrés"); updateHello(); };
  $("#sHomeGps").onclick = () => locate().then(g => { S.settings.home = { lat: g.lat, lon: g.lon, label: "Maison" }; save(); renderSettings(); toast("Maison enregistrée"); }).catch(() => toast("Position introuvable"));
  $("#sHomeQ").onclick = () => { S.settings.home = { ...QUIMPER }; save(); renderSettings(); };
  $("#sExport").onclick = () => exportData($("#sWithPh").checked);
  $("#sImport").onclick = () => $("#sFile").click();
  $("#sFile").onchange = e => { const f = e.target.files[0]; e.target.value = ""; if (f) importData(f); };
  const u = $("#sUnhide"); if (u) u.onclick = () => { S.hidden = []; save(); renderSettings(); toast("Lieux réaffichés"); };
  if (navigator.storage && navigator.storage.estimate) {
    const est = await navigator.storage.estimate();
    const el = $("#sUsage"); if (el) el.textContent = `Espace utilisé : ${(est.usage / 1048576).toFixed(1)} Mo`;
  }
}
const blobToDataURL = b => new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(b); });
async function exportData(withPhotos) {
  toast("Préparation de la sauvegarde…");
  const out = { app: "baleadenn", version: 1, date: new Date().toISOString(), data: S, photos: {} };
  if (withPhotos) for (const v of S.visits) for (const id of v.photos || []) { const b = await getPhoto(id); if (b) out.photos[id] = await blobToDataURL(b); }
  const blob = new Blob([JSON.stringify(out)], { type: "application/json" });
  const name = `baleadenn-sauvegarde-${today()}.json`;
  const file = new File([blob], name, { type: "application/json" });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: "Sauvegarde Baleadenn" }); return; } catch (e) { if (e.name === "AbortError") return; }
  }
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
  toast("Sauvegarde téléchargée");
}
async function importData(file) {
  try {
    const j = JSON.parse(await file.text());
    if (j.app !== "baleadenn" || !j.data) throw new Error("format");
    if (!confirm("Remplacer toutes les données actuelles par cette sauvegarde ?")) return;
    for (const [id, du] of Object.entries(j.photos || {})) { const b = await (await fetch(du)).blob(); await putPhoto(id, b); }
    S = Object.assign(defaults(), j.data); S.settings = Object.assign(defaults().settings, S.settings);
    save(); urlCache.clear(); F.max = S.settings.maxMin; toast("Sauvegarde restaurée"); refresh();
  } catch (e) { toast("Fichier de sauvegarde invalide"); }
}

// ---------- Premier lancement ----------
function onboarding() {
  openSheet(`${head("Degemer mat !")}
    <p><b>Bienvenue dans Baleadenn</b>, votre carnet de sorties en Cornouaille. ${(window.SEED_PLACES || []).length} lieux adaptés aux petits sont déjà prêts, à trier selon le temps de trajet depuis Quimper.</p>
    <p class="muted">Répondez à ce petit questionnaire (modifiable plus tard dans Réglages).</p>
    ${questionnaireHTML()}
    <button class="btn primary" id="oGo" style="width:100%">C'est parti ! 🚗</button>`, root => {
    $("#oGo", root).onclick = () => { readQuestionnaire(root); S.settings.onboarded = true; save(); closeSheet(); refresh(); };
  });
  onSheetClose = () => { if (!S.settings.onboarded) { S.settings.onboarded = true; save(); } };
}

// ---------- Démarrage ----------
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
if (S.settings.from === "gps") locate().then(() => refresh()).catch(() => { S.settings.from = "home"; save(); refresh(); });
renderList();
if (!S.settings.onboarded) onboarding();
if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
})();
