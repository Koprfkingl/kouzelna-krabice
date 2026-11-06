// Hide and seek: the monster hides in the room and leaves a note.
import * as THREE from 'three';
import { syllableHTML } from './cteni.js';
import { play, initAudio } from './audio.js';
import { a as rod } from './hrac.js';
import { S } from './stav.js';
import { hideBubble, hidePanel, saveAlbum, setPhase, showBubble, speak } from './main.js';
import { $, animate, centerOf, pickOne, wait } from './util.js';
import { camera, room, sparkles } from './scena.js';
import { ageCare, albumEntry, floatUp } from './pece.js';
import { flashSyl, giveStar, readLower } from './citanka.js';
import { bringToStage, decor, spotById } from './pokojicek.js';
import { dayEvent } from './den.js';

const BED_ZONE = { c: [-3.7, 0.5, -1.6], r: 0.95 };
const ZONES = {
  postel: BED_ZONE,
  kytka: { c: [-2.4, 0.55, -2.15], r: 0.5 },
  okno: { c: [-1.45, 1.8, -2.55], r: 0.75 },
  krabice: { c: [0, 0.55, -1.05], r: 0.85 },
  taburet: { c: [2.15, 0.2, -1.2], r: 0.45 },
  pohary: { c: [3.3, 1.5, -2.45], r: 0.75 },
  knizky: { c: [1.4, 1.85, -2.47], r: 0.7 },
};
const SCHOVKY = [
  { id: 'pod-postylkou', zone: 'postel', text: 'JSEM POD PO-STÝL-KOU.', pos: [-3.0, 0, -1.3], size: 0.3 },
  { id: 'v-postylce', zone: 'postel', text: 'JSEM V PO-STÝL-CE.', pos: [-3.7, 0.56, -1.0], size: 0.45, conflict: 'perina' },
  { id: 'za-kytkou', zone: 'kytka', text: 'JSEM ZA KYT-KOU.', pos: [-2.4, 0, -2.45], size: 0.42 },
  { id: 'na-okne', zone: 'okno', text: 'JSEM NA OK-NĚ.', pos: [-1.45, 1.13, -2.45], size: 0.36 },
  { id: 'za-krabici', zone: 'krabice', text: 'JSEM ZA KRA-BI-CÍ.', pos: [0.45, 0, -1.95], size: 0.42 },
  { id: 'na-taburetu', zone: 'taburet', text: 'JSEM NA TA-BU-RE-TU.', size: 0.45, conflict: 'taburet', spot: 'taburet' },
  { id: 'u-poharu', zone: 'pohary', text: 'JSEM U PO-HÁ-RŮ.', pos: [3.0, 0, -2.25], size: 0.45, conflict: 'zemC' },
  { id: 'pod-knizkami', zone: 'knizky', text: 'JSEM POD KNÍŽ-KA-MI.', pos: [1.4, 0, -2.3], size: 0.45 },
];

async function startSchovka() {
  const c = S.current;
  if (!c || c.type !== 'monster') return;
  const free = SCHOVKY.filter(p => !(p.conflict && decor[p.conflict]) && p.id !== S.schovka?.place.id && (!p.spot || spotById(p.spot)));
  const place = free[Math.floor(Math.random() * free.length)];
  S.schovka = { place, c, misses: 0, help: false, found: false };
  hideBubble();
  play('giggle');
  speak('Zavři oči, já se schovám! Raz, dva, tři!');
  await animate(0.6, k => { c.dis.uDis.value = k; });
  room.add(c.holder);
  const pos = place.spot ? spotById(place.spot).pos : new THREE.Vector3(...place.pos);
  c.holder.position.copy(pos);
  c.holder.rotation.set(0, 0, 0);
  c.holder.scale.setScalar(Math.min(1, place.size / c.maxDim));
  c.where = 'schovka';
  S.roomPan = 0;
  await wait(0.6);
  setPhase('schovka');
  speak('Přečti vzkaz a najdi mě.');
}
function renderSchovkaCard() {
  const k = $('schovka-karta');
  k.innerHTML = syllableHTML(S.schovka.place.text, readLower, true) + `<span class="podpis">${S.schovka.c.monster.name}</span>`;
  k.querySelectorAll('.slabika').forEach(el => el.addEventListener('click', () => { initAudio(); flashSyl(el); speak(el.dataset.s.toLowerCase()); }));
}
function readSchovka() {
  S.schovka.help = true;
  const els = [...$('schovka-karta').querySelectorAll('.slabika')];
  els.forEach((el, i) => setTimeout(() => flashSyl(el), i * 650));
  speak(S.schovka.place.text.replace(/-/g, '').toLowerCase());
}
function schovkaTap(e) {
  if (!S.schovka || S.schovka.found || S.busy) return;
  let best = null, bd = Infinity;
  for (const [id, z] of Object.entries(ZONES)) {
    const v = new THREE.Vector3(...z.c).project(camera);
    if (v.z > 1) continue;
    const sx = (v.x + 1) / 2 * innerWidth, sy = (1 - v.y) / 2 * innerHeight;
    const v2 = new THREE.Vector3(z.c[0] + z.r, z.c[1], z.c[2]).project(camera);
    const rad = Math.max(50, Math.hypot((v2.x + 1) / 2 * innerWidth - sx, (1 - v2.y) / 2 * innerHeight - sy));
    const d = Math.hypot(sx - e.clientX, sy - e.clientY) / rad;
    if (d < bd) { bd = d; best = id; }
  }
  if (bd > 1.25) { play('tap'); return; }
  if (best === S.schovka.place.zone) { foundSchovka(); return; }
  S.schovka.misses++;
  play('boing');
  const z = ZONES[best];
  sparkles.userData.emit(new THREE.Vector3(...z.c), 12, 0.6, 0.2);
  const t = S.schovka.misses >= 3 ? 'Tady nejsem! Poslechni si vzkaz.' : pickOne(['Tady nejsem!', 'Tady ne! Přečti si vzkaz ještě jednou.', 'Hihi, vedle!']);
  showBubble('🙈 ' + t);
  speak(t);
  if (S.schovka.misses >= 3) setTimeout(readSchovka, 1200);
}
async function foundSchovka() {
  const s = S.schovka, c = s.c;
  s.found = true;
  S.busy = true;
  hidePanel(true);
  try {
    play('poof');
    const y0 = c.holder.position.y;
    await animate(0.7, k => { c.dis.uDis.value = 1 - k; c.holder.position.y = y0 + Math.sin(k * Math.PI) * 0.35; });
    c.dis.uDis.value = 0; c.holder.position.y = y0;
    const ctr = centerOf(c.obj).c;
    sparkles.userData.emit(ctr, 60, 1.2, 0.35);
    for (const ch of ['🎉', '✨', '💖']) floatUp(ch, ctr, { n: 2, spread: 0.6, rise: 0.8, life: 2 });
    play('giggle');
    const news = s.help ? null : giveStar(ctr);
    const t = `Hurá! ${rod('Našla', 'Našel')} jsi mě!` + (s.help ? '' : ' Máš hvězdičku.') + (news ? ' ' + news : '');
    showBubble('🙈 ' + t + (s.help ? '' : ' ⭐'));
    speak(t.replace(/[^\p{L}\p{N}\s!?.,]/gu, ''));
    const a = albumEntry(c);
    if (a) { ageCare(a); a.pece.hra = Math.min(100, a.pece.hra + 10); saveAlbum(); }
    dayEvent('schovka');
    await wait(1.2);
  } finally { S.busy = false; }
  setPhase('schovka');
}
async function endSchovka() {
  const s = S.schovka;
  S.schovka = null;
  if (!s || S.current !== s.c || s.c.where !== 'schovka') { setPhase(S.current ? 'stage' : 'stage'); return; }
  const c = s.c;
  if (c.dis.uDis.value > 0) await animate(0.4, k => { c.dis.uDis.value = 1 - k; });
  c.dis.uDis.value = 0;
  await bringToStage(c);
  setPhase('stage');
}

export { endSchovka, readSchovka, renderSchovkaCard, schovkaTap, startSchovka };
