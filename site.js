import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

// Volgorde van de thema's op de pagina. Onbekende thema's komen daarna, op alfabet.
const THEMAS = ["Iconische bouwwerken", "Games & retro", "Superhelden", "Auto's & motoren", "Tovenaarswereld", "Fantasy & film"];
const LINK = nr => `https://www.brickwatch.net/nl-NL/set/${encodeURIComponent(nr)}/`;

const fs = getFirestore(initializeApp(firebaseConfig));
const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
const eur = n => { n = Number(n) || 0; return "€ " + (n % 1 ? n.toFixed(2).replace(".", ",") : `${n},-`); };
const slug = t => t.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const V = { items: [], loaded: false, onlyAvail: false, thema: "", q: "" };

const themaOrder = t => { const i = THEMAS.indexOf(t); return i < 0 ? 99 : i; };
const themas = () => [...new Set(V.items.map(i => i.thema || "Overig"))]
  .sort((a,b) => themaOrder(a) - themaOrder(b) || a.localeCompare(b, "nl"));

function card(i){
  const out = i.status === "uitverkocht";
  const ph = i.foto
    ? `<img src="${esc(i.foto)}" alt="${esc(i.naam)}" loading="lazy" decoding="async">`
    : `<span class="empty-ph"><span class="studs"><i></i><i></i><i></i><i></i></span>Foto volgt</span>`;
  const href = i.nummer ? LINK(i.nummer) : null;
  const wrapPh = href
    ? `<a class="ph" href="${href}" target="_blank" rel="noopener" aria-label="${esc(i.naam)} bekijken op Brickwatch">${ph}<span class="pill ${out?"out":"ok"}">${out?"Uitverkocht":"Beschikbaar"}</span><span class="peek">Bekijk origineel ↗</span></a>`
    : `<div class="ph">${ph}<span class="pill ${out?"out":"ok"}">${out?"Uitverkocht":"Beschikbaar"}</span></div>`;
  return `<article class="card ${out?"out":""}">
    ${wrapPh}
    <div class="body">
      <h3 class="name">${esc(i.naam)}</h3>
      ${href ? `<a class="ref" href="${href}" target="_blank" rel="noopener">Vergelijkbaar met nr. ${esc(i.nummer)} <span aria-hidden="true">↗</span></a>` : ""}
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

  const avail = V.items.filter(i => i.status !== "uitverkocht").length;
  $("count").textContent = avail === 1 ? "1 set beschikbaar" : `${avail} sets beschikbaar`;

  const q = V.q.trim().toLowerCase();
  const match = i => (!V.onlyAvail || i.status !== "uitverkocht")
    && (!V.thema || (i.thema || "Overig") === V.thema)
    && (!q || i.naam.toLowerCase().includes(q) || String(i.nummer).includes(q));
  if (!V.items.length){ main.innerHTML = `<div class="msg">Er staan op dit moment geen sets online. Kijk later nog eens.</div>`; return; }

  const html = ts.map(t => {
    const list = V.items.filter(i => (i.thema || "Overig") === t && match(i))
      .sort((a,b) => ((a.status==="uitverkocht") - (b.status==="uitverkocht")) || a.naam.localeCompare(b.naam, "nl"));
    if (!list.length) return "";
    return `<section class="theme" id="${slug(t)}"><h2>${esc(t)} <span class="n">${list.length}</span></h2><div class="grid">${list.map(card).join("")}</div></section>`;
  }).join("");
  main.innerHTML = html || `<div class="msg">Geen sets gevonden${V.q ? ` voor “${esc(V.q)}”` : ""}.</div>`;
}

$("chips").addEventListener("click", e => { const b = e.target.closest("[data-t]"); if (!b) return; V.thema = b.dataset.t; render(); });
$("q").addEventListener("input", e => { V.q = e.target.value; render(); });
$("avail").addEventListener("change", e => { V.onlyAvail = e.target.checked; render(); });

render();
const slow = setTimeout(() => { if (!V.loaded) $("count").textContent = "Het laden duurt langer dan normaal…"; }, 8000);
onSnapshot(collection(fs, "shop"), snap => {
  clearTimeout(slow);
  V.items = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(i => i.naam);
  V.loaded = true;
  render();
}, () => {
  clearTimeout(slow);
  V.loaded = true; V.items = [];
  $("count").textContent = "";
  $("chips").innerHTML = "";
  $("list").innerHTML = `<div class="msg">De voorraad kan nu niet geladen worden. Probeer het over een paar minuten opnieuw.</div>`;
});
