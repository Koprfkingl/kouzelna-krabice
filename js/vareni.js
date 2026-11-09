// Cooking in the box: the child reads a recipe (in syllables), picks the right ingredients into a bowl,
// the bowl goes into the box and the laser cooks the dish. Every monster in the collection gets a taste.
import * as THREE from 'three';
import { play, initAudio } from './audio.js';
import { S } from './stav.js';
import { saveAlbum, speak } from './main.js';
import { $ } from './util.js';
import { syllableHTML } from './cteni.js';
import { flashSyl, readLower } from './citanka.js';

// ingredients: picture and name in syllables
const SUROVINY = {
  vejce: ['🥚', 'VEJ-CE'], mouka: ['🌾', 'MOU-KA'], mleko: ['🥛', 'MLÉ-KO'], jahody: ['🍓', 'JA-HO-DY'], syr: ['🧀', 'SÝR'],
  rajce: ['🍅', 'RAJ-ČE'], mrkev: ['🥕', 'MRKEV'], brambory: ['🥔', 'BRAM-BO-RY'], banan: ['🍌', 'BA-NÁN'], jablko: ['🍎', 'JA-BLKO'],
  cokolada: ['🍫', 'ČO-KO-LÁ-DA'], led: ['🧊', 'LED'], hrozny: ['🍇', 'HROZ-NY'], cibule: ['🧅', 'CI-BU-LE'],
};
export const RECEPTY = [
  { id: 'palacinky', nazev: 'Palačinky', ikona: '🥞', acc: 'palačinky', g: 'p', nazevS: 'PA-LA-ČIN-KY', s: ['vejce', 'mouka', 'mleko', 'jahody'] },
  { id: 'pizza', nazev: 'Pizza', ikona: '🍕', acc: 'pizzu', g: 'f', nazevS: 'PI-ZZA', s: ['mouka', 'rajce', 'syr'] },
  { id: 'polevka', nazev: 'Polévka', ikona: '🍲', acc: 'polévku', g: 'f', nazevS: 'PO-LÉV-KA', s: ['mrkev', 'brambory', 'cibule'] },
  { id: 'zmrzlina', nazev: 'Zmrzlina', ikona: '🍨', acc: 'zmrzlinu', g: 'f', nazevS: 'ZMRZ-LI-NA', s: ['mleko', 'led', 'cokolada', 'jahody'] },
  { id: 'salat', nazev: 'Ovocný salát', ikona: '🥗', acc: 'ovocný salát', g: 'm', nazevS: 'O-VOC-NÝ SA-LÁT', s: ['banan', 'jablko', 'hrozny'] },
];
export const receptById = id => RECEPTY.find(r => r.id === id);

// ---------- the recipe card ----------
let cooking = null; // { r, got: Set, onDone }
export function openKucharka(id, onDone) {
  const r = receptById(id);
  cooking = { r, got: new Set(), onDone };
  const text = `${r.nazevS}: ${r.s.map(k => SUROVINY[k][1]).join(', ')}.`;
  $('kucharka-nazev').textContent = `${r.ikona} ${r.nazev}`;
  $('kucharka-text').innerHTML = syllableHTML(text, readLower, true);
  $('kucharka-text').querySelectorAll('.slabika').forEach(el => el.addEventListener('click', () => { initAudio(); flashSyl(el); speak(el.dataset.s.toLowerCase()); }));
  // the ingredients of the recipe and a few others
  const others = Object.keys(SUROVINY).filter(k => !r.s.includes(k)).sort(() => Math.random() - 0.5).slice(0, 8 - r.s.length);
  const grid = $('kucharka-suroviny');
  grid.innerHTML = '';
  for (const k of [...r.s, ...others].sort(() => Math.random() - 0.5)) {
    const b = document.createElement('button');
    b.className = 'surovina';
    b.dataset.k = k;
    b.textContent = SUROVINY[k][0];
    b.onclick = () => tapSurovina(b);
    grid.append(b);
  }
  $('kucharka-napoveda').textContent = 'Přečti recept a dej do misky všechno, co v něm je.';
  $('kucharka').hidden = false;
  speak(`Recept: ${text.replace(/-/g, '').toLowerCase()}`);
}
function tapSurovina(b) {
  if (!cooking) return;
  initAudio();
  const k = b.dataset.k, r = cooking.r;
  if (cooking.got.has(k)) return;
  if (!r.s.includes(k)) {
    play('boing');
    b.classList.remove('spatne'); void b.offsetWidth; b.classList.add('spatne');
    const t = `${SUROVINY[k][1].replace(/-/g, '').toLowerCase()} v receptu není. Přečti si ho ještě jednou.`;
    $('kucharka-napoveda').textContent = '🤔 ' + t.charAt(0).toUpperCase() + t.slice(1); speak(t);
    return;
  }
  play('place');
  speak(SUROVINY[k][1].replace(/-/g, '').toLowerCase());
  cooking.got.add(k);
  b.classList.add('v-misce');
  $('kucharka-miska').textContent = '🥣 ' + [...cooking.got].map(x => SUROVINY[x][0]).join('');
  if (cooking.got.size === r.s.length) {
    $('kucharka-napoveda').textContent = 'Všechno je v misce! Teď ji dej do krabice a vystřel laser.';
    const done = cooking.onDone, id = r.id;
    cooking = null;
    setTimeout(() => { $('kucharka').hidden = true; $('kucharka-miska').textContent = '🥣'; done(id); }, 900);
  }
}
$('kucharka-zavrit').addEventListener('click', () => { $('kucharka').hidden = true; cooking = null; $('kucharka-miska').textContent = '🥣'; });

// ---------- after cooking: every monster has a taste ----------
export function feedEveryone() {
  let n = 0;
  for (const a of S.album) if (a.pece && !a.vylet) { a.pece.jidlo = 100; a.pece.hra = Math.min(100, (a.pece.hra || 0) + 20); n++; }
  if (n) saveAlbum();
  return n;
}

// ---------- 3D: the bowl with ingredients and the dishes ----------
const M = (color, o = {}) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.5, clearcoat: 0.3, ...o });
const mesh = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; return m; };
const Sph = (r, w = 20, h = 14) => new THREE.SphereGeometry(r, w, h);
const COLORS = { vejce: 0xfff6e0, mouka: 0xf5ecd8, mleko: 0xffffff, jahody: 0xff4f5e, syr: 0xffd84d, rajce: 0xff5a3c, mrkev: 0xff8a2a, brambory: 0xd9a85b,
  banan: 0xffe066, jablko: 0x7ccf4a, cokolada: 0x6b3d24, led: 0xcfefff, hrozny: 0x8a4fd6, cibule: 0xf2dcc2 };

function bowl(color = 0x5fb4ff) {
  const g = new THREE.Group();
  const pts = []; for (let i = 0; i <= 10; i++) { const a = i / 10 * Math.PI / 2; pts.push(new THREE.Vector2(0.05 + Math.sin(a) * 0.2, 0.2 - Math.cos(a) * 0.17)); }
  const b = mesh(new THREE.LatheGeometry(pts, 40), M(color, { side: THREE.DoubleSide, roughness: 0.3, clearcoat: 1 }));
  g.add(b);
  g.add(mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.02, 24), M(color), 0, 0.03, 0));
  return g;
}
function buildMiska(id) {
  const g = bowl(), r = receptById(id);
  r.s.forEach((k, i) => { const a = i / r.s.length * Math.PI * 2; const b = mesh(Sph(0.06), M(COLORS[k] ?? 0xffffff), Math.cos(a) * 0.09, 0.17, Math.sin(a) * 0.09); b.scale.y = 0.7; g.add(b); });
  return g;
}
const DISHES = {
  palacinky() {
    const g = new THREE.Group();
    g.add(mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.02, 32), M(0xffffff), 0, 0.01, 0));
    for (let i = 0; i < 5; i++) g.add(mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.03, 32), M(0xf2c27a, { roughness: 0.7 }), 0, 0.035 + i * 0.032, 0));
    g.add(mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.02, 24), M(0xd61f45, { roughness: 0.2, clearcoat: 1 }), 0, 0.2, 0));
    for (let i = 0; i < 3; i++) g.add(mesh(Sph(0.035), M(0xff4f5e), Math.cos(i * 2.1) * 0.06, 0.23, Math.sin(i * 2.1) * 0.06));
    return g;
  },
  pizza() {
    const g = new THREE.Group();
    g.add(mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.03, 40), M(0xe0a35a, { roughness: 0.8 }), 0, 0.015, 0));
    g.add(mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.012, 40), M(0xe8452c, { roughness: 0.6 }), 0, 0.034, 0));
    for (let i = 0; i < 9; i++) { const a = i * 2.4, d = 0.06 + (i % 3) * 0.06; g.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.012, 16), M(i % 2 ? 0xffd84d : 0xb03a2e), Math.cos(a) * d, 0.045, Math.sin(a) * d)); }
    g.rotation.x = 0.35;
    g.position.y = 0.05;
    const h = new THREE.Group(); h.add(g); return h;
  },
  polevka() {
    const g = bowl(0xffffff);
    g.add(mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.01, 32), M(0xffb347, { roughness: 0.2, clearcoat: 1 }), 0, 0.17, 0));
    for (let i = 0; i < 6; i++) { const a = i; g.add(mesh(new THREE.BoxGeometry(0.035, 0.02, 0.035), M(i % 2 ? 0xff8a2a : 0xf2dcc2), Math.cos(a) * 0.1, 0.18, Math.sin(a) * 0.1)); }
    const sp = mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.3, 8), M(0xd0d0d8, { metalness: 0.9, roughness: 0.2 }), 0.08, 0.27, 0); sp.rotation.z = -0.6; g.add(sp);
    return g;
  },
  zmrzlina() {
    const g = new THREE.Group();
    const cone = mesh(new THREE.ConeGeometry(0.1, 0.3, 24), M(0xd9a05b, { roughness: 0.8 }), 0, 0.15, 0); cone.rotation.x = Math.PI; g.add(cone);
    [[0xfff3e0, 0, 0.33], [0xff8fb3, -0.05, 0.43], [0x6b3d24, 0.05, 0.43]].forEach(([c, x, y]) => g.add(mesh(Sph(0.095, 24, 16), M(c, { roughness: 0.6 }), x, y, 0)));
    g.add(mesh(Sph(0.03), M(0xd61f45, { roughness: 0.2, clearcoat: 1 }), 0, 0.53, 0));
    return g;
  },
  salat() {
    const g = bowl(0xfff3c4);
    [[0xffe066, 0.05, 0.03], [0x7ccf4a, -0.06, 0.02], [0x8a4fd6, 0.0, -0.07], [0xff4f5e, -0.03, 0.08], [0x8a4fd6, 0.08, -0.04], [0xffe066, -0.09, -0.04]].forEach(([c, x, z]) => g.add(mesh(Sph(0.045), M(c, { roughness: 0.3, clearcoat: 1 }), x, 0.2, z)));
    return g;
  },
};
export function buildJidlo(src) { return src.miska ? buildMiska(src.id) : DISHES[src.id](); }
export function describeJidlo(src) {
  const r = receptById(src.id);
  if (src.miska) return { living: false, name: `Miska na ${r.acc}`, acc: `misku na ${r.acc}`, g: 'f' };
  return { living: false, name: r.nazev, acc: r.acc, g: r.g };
}
