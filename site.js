import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, onSnapshot, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

// Volgorde van de thema's op de pagina. Onbekende thema's komen daarna, op alfabet.
const THEMAS = ["Icons", "Ideas", "Marvel", "DC", "Technic", "Harry Potter", "Lord of the Rings", "Pokémon", "Super Mario", "Pirates of the Caribbean", "Star Wars", "Stranger Things"];

const fs = getFirestore(initializeApp(firebaseConfig));
const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
const eur = n => { n = Number(n) || 0; return "€ " + (n % 1 ? n.toFixed(2).replace(".", ",") : `${n},-`); };
const slug = t => t.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const V = { items: [], soon: false, loaded: false, onlyAvail: false, thema: "", q: "" };

const rank = i => ({ beschikbaar: 0, binnenkort: 1, uitverkocht: 2 }[i.status] ?? 1);
const themaOrder = t => { const i = THEMAS.indexOf(t); return i < 0 ? 99 : i; };
const themas = () => [...new Set(V.items.map(i => i.thema || "Overig"))]
  .sort((a,b) => themaOrder(a) - themaOrder(b) || a.localeCompare(b, "nl"));

function card(i){
  const out = !V.soon && i.status === "uitverkocht";
  const pill = (V.soon || i.status === "binnenkort") ? `<span class="pill soon">Binnenkort beschikbaar</span>` : `<span class="pill ${out?"out":"ok"}">${out?"Uitverkocht":"Beschikbaar"}</span>`;
  const ph = i.foto
    ? `<img src="${esc(i.foto)}" alt="${esc(i.naam)}" loading="lazy" decoding="async">`
    : `<span class="empty-ph"><span class="studs"><i></i><i></i><i></i><i></i></span>Foto volgt</span>`;
  const ids = i.fotos || [], n = ids.length;
  const slides = n > 1
    ? ids.map((fid, k) => `<div class="slide" data-k="${k}">${k === 0 ? ph : `<span class="slide-wait" data-fid="${esc(fid)}"></span>`}</div>`).join("")
    : `<div class="slide" data-k="0">${ph}</div>`;
  const wrapPh = i.foto
    ? `<div class="ph zoom" data-open="${esc(i.id)}" role="button" tabindex="0" aria-label="Foto's van ${esc(i.naam)} vergroten">
        <div class="slides">${slides}</div>${pill}
        ${n > 1 ? `<button type="button" class="snav prev" data-step="-1" aria-label="Vorige foto">‹</button><button type="button" class="snav next" data-step="1" aria-label="Volgende foto">›</button>
        <span class="sdots">${ids.map((_, k) => `<i class="${k===0?"on":""}"></i>`).join("")}</span>` : ""}
      </div>`
    : `<div class="ph">${ph}${pill}</div>`;
  return `<article class="card ${out?"out":""}">
    ${wrapPh}
    <div class="body">
      <h3 class="name">${esc(i.naam)}</h3>
      ${i.nummer ? `<span class="ref">Vergelijkbaar met nr. ${esc(i.nummer)}</span>` : ""}
      <div class="prices">
        <span class="price num">${eur(i.prijs)}</span>
        ${i.advies ? `<span class="advies num">Adviesprijs origineel <s>${eur(i.advies)}</s></span>` : ""}
      </div>
    </div>
  </article>`;
}

function render(){
  const main = $("list");
  if (!V.loaded){
    main.innerHTML = `<div class="grid">${Array.from({length:8}, () => `<div class="skel"><div class="ph"></div><div class="l"></div><div class="l s"></div></div>`).join("")}</div>`;
    return;
  }
  // thema-chips
  const ts = themas();
  $("chips").innerHTML = [`<button data-t="" aria-pressed="${!V.thema}">Alle thema's</button>`]
    .concat(ts.map(t => `<button data-t="${esc(t)}" aria-pressed="${V.thema===t}">${esc(t)}</button>`)).join("");

  const avail = V.items.filter(i => i.status === "beschikbaar").length;
  const soon = V.items.filter(i => i.status === "binnenkort").length;
  $("count").textContent = V.soon ? `${V.items.length} sets · binnenkort beschikbaar`
    : [avail === 1 ? "1 set beschikbaar" : `${avail} sets beschikbaar`, soon ? `${soon} binnenkort` : ""].filter(Boolean).join(" · ");
  $("availWrap").hidden = V.soon;

  const q = V.q.trim().toLowerCase();
  const match = i => (V.soon || !V.onlyAvail || i.status === "beschikbaar")
    && (!V.thema || (i.thema || "Overig") === V.thema)
    && (!q || i.naam.toLowerCase().includes(q) || String(i.nummer).includes(q));
  if (!V.items.length){ main.innerHTML = `<div class="msg">Er staan op dit moment geen sets online. Kijk later nog eens.</div>`; return; }

  const html = ts.map(t => {
    const list = V.items.filter(i => (i.thema || "Overig") === t && match(i))
      .sort((a,b) => (V.soon ? 0 : rank(a) - rank(b)) || a.naam.localeCompare(b.naam, "nl"));
    if (!list.length) return "";
    return `<section class="theme" id="${slug(t)}"><h2>${esc(t)} <span class="n">${list.length}</span></h2><div class="grid">${list.map(card).join("")}</div></section>`;
  }).join("");
  main.innerHTML = html || `<div class="msg">Geen sets gevonden${V.q ? ` voor “${esc(V.q)}”` : ""}.</div>`;
}

/* ---------- foto's vergroten ---------- */
const big = new Map(); // fid -> data-URL (grote versie), eenmaal geladen
const LB = { item: null, i: 0 };
const small = new Map(); // fid -> kleine versie voor het vegen op het kaartje
function loadSmall(fid){
  if (!small.has(fid)) small.set(fid, getDoc(doc(fs, "shopfoto", "t_" + fid)).then(d => d.exists() ? d.data().data : null).catch(() => null));
  return small.get(fid);
}
// vegen op het kaartje: foto's laden zodra ze (bijna) in beeld komen
function cardIndex(ph){ const sl = ph.querySelector(".slides"); return sl ? Math.round(sl.scrollLeft / sl.clientWidth) : 0; }
function fillSlide(ph, k){
  const slot = ph.querySelector(`.slide[data-k="${k}"] .slide-wait`); if (!slot || slot.dataset.busy) return;
  slot.dataset.busy = "1";
  const fid = slot.dataset.fid;
  loadSmall(fid).then(src => src || loadBig(fid)).then(src => { if (src && slot.isConnected) slot.outerHTML = `<img src="${esc(src)}" alt="" decoding="async">`; });
}
function onSlide(ph){
  const k = cardIndex(ph);
  ph.querySelectorAll(".sdots i").forEach((d, j) => d.classList.toggle("on", j === k));
  fillSlide(ph, k); fillSlide(ph, k + 1);
}
$("list").addEventListener("scroll", e => { if (e.target.classList?.contains("slides")) onSlide(e.target.closest(".ph")); }, true);
$("list").addEventListener("touchstart", e => { const ph = e.target.closest(".ph.zoom"); if (ph) fillSlide(ph, 1); }, { passive: true });
$("list").addEventListener("mouseover", e => { const ph = e.target.closest(".ph.zoom"); if (ph) fillSlide(ph, 1); });

async function loadBig(fid){
  if (big.has(fid)) return big.get(fid);
  const p = getDoc(doc(fs, "shopfoto", fid)).then(d => d.exists() ? d.data().data : null).catch(() => null);
  big.set(fid, p);
  return p;
}
function openLB(id, start = 0){
  const it = V.items.find(x => x.id === id); if (!it || !it.foto) return;
  LB.item = it; LB.i = start;
  $("lb").hidden = false; document.body.style.overflow = "hidden";
  $("lbName").textContent = it.naam;
  showLB();
  $("lbClose").focus();
}
function closeLB(){ $("lb").hidden = true; document.body.style.overflow = ""; LB.item = null; }
async function showLB(){
  const it = LB.item; if (!it) return;
  const ids = it.fotos || [], n = Math.max(ids.length, 1);
  LB.i = (LB.i + n) % n;
  const idx = LB.i;
  $("lbCount").textContent = n > 1 ? `${idx + 1} / ${n}` : "";
  $("lbPrev").hidden = $("lbNext").hidden = n < 2;
  $("lbDots").innerHTML = n > 1 ? ids.map((_, k) => `<i class="${k===idx?"on":""}"></i>`).join("") : "";
  const img = $("lbImg");
  if (idx === 0) img.src = it.foto;          // kleine versie direct, grote laadt erachteraan
  else { const sm = small.has(ids[idx]) ? await small.get(ids[idx]) : null; if (sm && LB.item === it && LB.i === idx) img.src = sm; }
  img.classList.add("loading");
  if (!ids.length){ img.classList.remove("loading"); return; }
  const src = await loadBig(ids[idx]);
  if (LB.item !== it || LB.i !== idx) return; // inmiddels doorgebladerd
  if (src) img.src = src;
  img.classList.remove("loading");
  [idx + 1, idx - 1].forEach(k => ids[(k + n) % n] && loadBig(ids[(k + n) % n])); // buren alvast laden
}
const step = d => { LB.i += d; showLB(); };
$("lbPrev").onclick = () => step(-1);
$("lbNext").onclick = () => step(1);
$("lbClose").onclick = closeLB;
$("lb").addEventListener("click", e => { if (e.target.id === "lb" || e.target.classList.contains("lb-stage")) closeLB(); });
addEventListener("keydown", e => {
  if ($("lb").hidden) return;
  if (e.key === "Escape") closeLB();
  if (e.key === "ArrowRight") step(1);
  if (e.key === "ArrowLeft") step(-1);
});
let tx = null;
$("lb").addEventListener("touchstart", e => { tx = e.touches[0].clientX; }, { passive: true });
$("lb").addEventListener("touchend", e => {
  if (tx === null) return; const dx = e.changedTouches[0].clientX - tx; tx = null;
  if (Math.abs(dx) > 45) step(dx < 0 ? 1 : -1);
});
$("list").addEventListener("click", e => {
  const st = e.target.closest("[data-step]");
  if (st){ const sl = st.closest(".ph").querySelector(".slides"); sl.scrollBy({ left: sl.clientWidth * Number(st.dataset.step), behavior: "smooth" }); return; }
  const b = e.target.closest("[data-open]"); if (b) openLB(b.dataset.open, cardIndex(b));
});
$("list").addEventListener("keydown", e => { if ((e.key === "Enter" || e.key === " ") && e.target.matches("[data-open]")){ e.preventDefault(); openLB(e.target.dataset.open, cardIndex(e.target)); } });

$("chips").addEventListener("click", e => { const b = e.target.closest("[data-t]"); if (!b) return; V.thema = b.dataset.t; render(); });
$("q").addEventListener("input", e => { V.q = e.target.value; render(); });
$("avail").addEventListener("change", e => { V.onlyAvail = e.target.checked; render(); });

render();
const slow = setTimeout(() => { if (!V.loaded) $("count").textContent = "Het laden duurt langer dan normaal…"; }, 8000);
onSnapshot(collection(fs, "shop"), snap => {
  clearTimeout(slow);
  const site = snap.docs.find(d => d.id === "_site");
  V.soon = !!(site && site.data().binnenkort);
  V.items = snap.docs.filter(d => d.id !== "_site").map(d => ({ id: d.id, ...d.data() })).filter(i => i.naam);
  V.loaded = true;
  render();
  if (LB.item){ const upd = V.items.find(x => x.id === LB.item.id); if (upd) LB.item = upd; else closeLB(); }
}, () => {
  clearTimeout(slow);
  V.loaded = true; V.items = [];
  $("count").textContent = "";
  $("chips").innerHTML = "";
  $("list").innerHTML = `<div class="msg">De voorraad kan nu niet geladen worden. Probeer het over een paar minuten opnieuw.</div>`;
});
