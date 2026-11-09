// Advent and Christmas: a calendar with 24 windows (each one a short Christmas sentence to read, an ornament
// for the tree and a star), snow behind the window and a Christmas tree in the room from 1 December to 6 January.
// The "season pass" (sezónní permice) is the calendar itself, free: rewards at 6, 12, 18 and 24 opened windows.
// For testing, ?datum=2026-12-05 pretends it is that day.
import * as THREE from 'three';
import { play, initAudio } from './audio.js';
import { showBubble, speak } from './main.js';
import { $, CARTOON, params, store } from './util.js';
import { room, sparkles } from './scena.js';
import { syllableHTML } from './cteni.js';
import { flashSyl, giveStar, readLower } from './citanka.js';
import { pokoj, savePokoj } from './pokojicek.js';
import { addBoost } from './boost.js';
import { toonify } from './vzhled.js';

export function seasonDate() {
  const d = params.get('datum');
  const t = d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(d + 'T12:00:00') : new Date();
  return isNaN(t) ? new Date() : t;
}
const adventDay = (d = seasonDate()) => (d.getMonth() === 11 && d.getDate() <= 26 ? Math.min(24, d.getDate()) : 0);
export const isWinter = (d = seasonDate()) => (d.getMonth() === 11) || (d.getMonth() === 0 && d.getDate() <= 6);
const seasonYear = (d = seasonDate()) => (d.getMonth() === 0 ? d.getFullYear() - 1 : d.getFullYear());

const TEXTY = [
  'UŽ JE AD-VENT!', 'PE-ČE-ME CUK-RO-VÍ.', 'VEN-KU SNĚ-ŽÍ.', 'ZDO-BÍ-ME STRO-ME-ČEK.', 'PŘI-JDE MI-KU-LÁŠ.', 'AN-DĚL NE-SE DÁ-REK.',
  'ČERT MÁ RO-HY.', 'STA-VÍ-ME SNĚ-HU-LÁ-KA.', 'KOU-LU-JE-ME SE.', 'PÍ-ŠU DO-PIS JE-ŽÍŠ-KO-VI.', 'SVÍČ-KA HO-ŘÍ.', 'ZPÍ-VÁ-ME KO-LE-DY.',
  'MÁ-ME RÁ-DI ZI-MU.', 'JE-DU NA SÁŇ-KÁCH.', 'BRUS-LÍ-ME NA LE-DĚ.', 'VO-NÍ PER-NÍK.', 'HVĚZ-DA SVÍ-TÍ.', 'DÁ-ME NA-HO-RU HVĚZ-DU.',
  'PŘÍ-ŠER-KA BA-LÍ DÁR-KY.', 'RYB-KA PLA-VE.', 'MRÁZ KRES-LÍ NA OK-NO.', 'UŽ JEN DVA DNY!', 'ZÍT-RA JSOU VÁ-NO-CE!', 'VE-SE-LÉ VÁ-NO-CE!',
];
const IKONY = ['🕯️', '🍪', '❄️', '🎄', '😇', '👼', '😈', '⛄', '⚪', '✉️', '🕯️', '🎶', '🧣', '🛷', '⛸️', '🫚', '⭐', '🌟', '🎁', '🐟', '🌨️', '🔔', '🦌', '🎅'];
const ORDER = [13, 7, 21, 2, 18, 10, 5, 24, 15, 1, 20, 8, 12, 3, 17, 22, 6, 11, 16, 4, 23, 9, 19, 14]; // like a real calendar
const TIERS = [
  { n: 6, ikona: '⛄', text: 'Sněhulák do pokojíčku' },
  { n: 12, ikona: '🌟', text: '3× Laser Boost' },
  { n: 18, ikona: '⭐', text: 'Zlatá hvězda na stromeček' },
  { n: 24, ikona: '🎅', text: 'Santova čepice pro příšerky' },
];
const BALL_COLORS = [0xff4f6d, 0xffd34d, 0x4fc3f7, 0xb46bff, 0x5fd4a8, 0xff9f43];

let st = { year: 0, opened: [], tiers: [], greeted: '' };
function load() {
  st = { year: 0, opened: [], tiers: [], greeted: '', ...store.get('kk-advent', {}) };
  if (st.year !== seasonYear()) st = { year: seasonYear(), opened: [], tiers: [], greeted: '' };
}
const save = () => store.set('kk-advent', st);
export const hasSantaHat = () => !!store.get('kk-santa', false);

// ---------- the tree and the snow ----------
let tree = null, snow = null;
function buildTree() {
  const g = new THREE.Group();
  const green = new THREE.MeshStandardMaterial({ color: 0x2fa85a, roughness: 0.8 });
  const layers = [[0.62, 0.7, 0.45], [0.5, 0.6, 0.85], [0.36, 0.5, 1.2]];
  for (const [r, h, y] of layers) { const c = new THREE.Mesh(new THREE.ConeGeometry(r, h, 10), green); c.position.y = y; c.castShadow = true; g.add(c); }
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.25, 12), new THREE.MeshStandardMaterial({ color: 0x8a5a2b, roughness: 0.9 }));
  trunk.position.y = 0.12; g.add(trunk);
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.16, 0.2, 16), new THREE.MeshStandardMaterial({ color: 0xff6f8f, roughness: 0.6 }));
  pot.position.y = 0.1; g.add(pot);
  g.userData.balls = new THREE.Group(); g.add(g.userData.balls);
  const star = new THREE.Group();
  const shape = new THREE.Shape();
  for (let i = 0; i < 10; i++) { const r = i % 2 ? 0.06 : 0.14, a = Math.PI / 2 + i * Math.PI / 5; if (i) shape.lineTo(Math.cos(a) * r, Math.sin(a) * r); else shape.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
  star.add(new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.04, bevelEnabled: true, bevelSize: 0.01, bevelThickness: 0.01, bevelSegments: 1 }), new THREE.MeshStandardMaterial({ color: 0xffd34d, emissive: 0xffb300, emissiveIntensity: 0.5, metalness: 0.8, roughness: 0.3 })));
  star.position.set(0, 1.5, -0.02);
  star.visible = false;
  g.add(star);
  g.userData.star = star;
  g.position.set(-1.3, 0, -1.95); // under the window, left of the box, clear of the curtain and the plant
  g.rotation.y = 0.3;
  if (CARTOON) toonify(g);
  return g;
}
// one ornament for every opened window, always in the same place
function dressTree() {
  if (!tree) return;
  const balls = tree.userData.balls;
  balls.clear();
  st.opened.forEach((day, i) => {
    const layer = i % 3, a = day * 2.39996, y = [0.3, 0.68, 1.02][layer] + ((day * 7) % 5) * 0.03, r = [0.5, 0.4, 0.27][layer] * (1 - ((y - [0.1, 0.55, 0.95][layer]) / [0.7, 0.6, 0.5][layer]) * 0.55);
    const col = BALL_COLORS[day % BALL_COLORS.length];
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.045, 14, 10), new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.35, roughness: 0.3 }));
    b.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
    balls.add(b);
  });
  if (CARTOON) toonify(balls);
  tree.userData.star.visible = st.tiers.includes(18);
}
function buildSnow() {
  const n = 160, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { pos[i * 3] = -2.03 + Math.random() * 1.16; pos[i * 3 + 1] = 1.22 + Math.random() * 1.26; pos[i * 3 + 2] = -2.588 + Math.random() * 0.012; }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const p = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.045, transparent: true, opacity: 0.95, depthWrite: false }));
  p.frustumCulled = false;
  return p;
}
export function updateAdvent(t, dt) {
  if (snow) {
    const a = snow.geometry.attributes.position;
    for (let i = 0; i < a.count; i++) {
      let y = a.getY(i) - dt * (0.25 + (i % 5) * 0.04);
      if (y < 1.22) y = 2.48;
      a.setY(i, y); a.setX(i, a.getX(i) + Math.sin(t * 1.3 + i) * dt * 0.05);
    }
    a.needsUpdate = true;
  }
  if (tree && tree.userData.star.visible) tree.userData.star.rotation.y = Math.sin(t * 0.8) * 0.4;
}

// ---------- the calendar window ----------
function renderAdvent(msg) {
  const today = adventDay();
  const grid = $('advent-mrizka');
  grid.innerHTML = '';
  for (const day of ORDER) {
    const el = document.createElement('button');
    const open = st.opened.includes(day), can = day <= today;
    el.className = 'okenko' + (open ? ' otevrene' : can ? (day === today ? ' dnes' : ' muze') : ' zamcene');
    el.innerHTML = open ? `<span class="ikona">${IKONY[day - 1]}</span><span class="cislo">${day}</span>` : `<span class="cislo zavrene">${day}</span>`;
    el.onclick = () => tapWindow(day);
    grid.append(el);
  }
  const n = st.opened.length;
  $('permice-pruh').style.width = (n / 24 * 100) + '%';
  $('permice-stav').textContent = `${n} / 24`;
  const tiers = $('permice-odmeny');
  tiers.innerHTML = '';
  for (const t of TIERS) {
    const el = document.createElement('div');
    el.className = 'odmena' + (st.tiers.includes(t.n) ? ' ziskana' : '');
    el.innerHTML = `<b>${t.ikona}</b>${t.n}`;
    el.title = t.text;
    el.onclick = () => { play('tap'); speak(`${t.text}: za ${t.n} okének.`); showVzkaz(`${t.ikona} ${t.text} (za ${t.n} okének)`); };
    tiers.append(el);
  }
  if (msg !== undefined) showVzkaz(msg);
}
function showVzkaz(html, text) {
  const v = $('advent-vzkaz');
  v.innerHTML = html;
  v.hidden = !html;
  if (text) v.querySelectorAll('.slabika').forEach(el => el.addEventListener('click', () => { initAudio(); flashSyl(el); speak(el.dataset.s.toLowerCase()); }));
}
function tapWindow(day) {
  initAudio();
  const today = adventDay();
  if (st.opened.includes(day)) { play('tap'); readText(day); return; }
  if (!today || day > today) {
    play('boing');
    const t = today ? `Okénko ${day} ještě nejde otevřít. Počkej ${day - today === 1 ? 'do zítřka' : `ještě ${day - today} ${day - today < 5 ? 'dny' : 'dní'}`}!` : `Kalendář se otevírá prvního prosince.`;
    showVzkaz('🔒 ' + t); speak(t);
    return;
  }
  st.opened.push(day);
  save();
  play('poof'); setTimeout(() => play('giggle'), 250);
  dressTree();
  const news = giveStar(tree ? tree.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 1, 0)) : new THREE.Vector3(0, 1.5, -1));
  if (tree) sparkles.userData.emit(tree.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.8, 0)), 40, 1, 0.5);
  const tier = TIERS.find(t => st.opened.length >= t.n && !st.tiers.includes(t.n));
  let extra = '';
  if (tier) extra = claimTier(tier);
  renderAdvent();
  readText(day, `Na stromeček přibyla ozdoba a máš hvězdičku ⭐.${news ? ' ' + news : ''}${extra ? '<br><b>Sezónní permice:</b> ' + extra : ''}`);
  updateAdventBtn();
}
function readText(day, note = '') {
  const text = TEXTY[day - 1];
  showVzkaz(`<div class="advent-text">${syllableHTML(text, readLower, true)}</div>${note ? `<p>${note}</p>` : ''}`, true);
  speak(text.replace(/-/g, '').toLowerCase());
}
function claimTier(t) {
  st.tiers.push(t.n);
  save();
  if (t.n === 6) { if (!pokoj.ozdoby.includes('snehulak')) { pokoj.ozdoby.push('snehulak'); savePokoj(); } else addBoost(1); }
  if (t.n === 12) addBoost(3);
  if (t.n === 18) dressTree();
  if (t.n === 24) store.set('kk-santa', true);
  const msg = `${t.ikona} ${t.text}!` + (t.n === 6 ? ' Postav ho v pokojíčku.' : t.n === 12 ? ' Najdeš ho u laseru.' : t.n === 24 ? ' Najdeš ji v šatníku. Veselé Vánoce!' : '');
  setTimeout(() => { showBubble('🎄 ' + msg); speak(msg); }, 1800);
  return msg;
}
function openAdvent() {
  load();
  renderAdvent(adventDay() ? '' : 'Adventní kalendář se otevírá prvního prosince. Pak každý den jedno okénko!');
  $('advent').hidden = false;
}
function updateAdventBtn() {
  const today = adventDay(), b = $('btn-advent');
  b.hidden = !isWinter();
  b.classList.toggle('ceka', !!today && !st.opened.includes(today));
}

// ---------- start ----------
export function initAdvent() {
  load();
  if (isWinter()) {
    tree = buildTree(); room.add(tree);
    snow = buildSnow(); room.add(snow);
    dressTree();
  }
  updateAdventBtn();
  const today = adventDay(), key = `${seasonYear()}-${today}`;
  if (today && !st.opened.includes(today) && st.greeted !== key && !params.has('demo')) {
    st.greeted = key; save();
    setTimeout(() => { const t = today === 24 ? 'Je Štědrý den! Otevři poslední okénko v adventním kalendáři.' : `Adventní kalendář: dnes můžeš otevřít okénko ${today}!`; showBubble('🎄 ' + t); speak(t); }, 2500);
  }
}
$('btn-advent').addEventListener('click', () => { initAudio(); play('tap'); openAdvent(); });
$('advent-zavrit').addEventListener('click', () => { $('advent').hidden = true; });
$('advent').addEventListener('click', e => { if (e.target.id === 'advent') $('advent').hidden = true; });

export { openAdvent };
