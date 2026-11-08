// The child's room: decorating it.
import * as THREE from 'three';
import { byId } from './catalog.js';
import { HODNOSTI } from './cteni.js';
import { play, initAudio } from './audio.js';
import { hrac } from './hrac.js';
import { updateOzdoba, ozdobaById } from './ozdoby.js';
import * as Ukoly from './ukoly.js';
import { S } from './stav.js';
import { buildFor, hideBubble, raycaster, removeCurrent, run, setPhase, setPointer, showBubble, speak, tile } from './main.js';
import { $, CARTOON, animate, disposeObj, ease, mergeAll, store } from './util.js';
import { toonMaterial } from './vzhled.js';
import { camera, canvas, room, scene, sparkles, spinner, texLoader } from './scena.js';
import { emojiSprite } from './pece.js';
import { schovkaTap } from './schovka.js';
import { messTargets, tapMess } from './neporadek.js';
import { fillVitrina, openVitrina, tapKouzlo } from './vitrina.js';
import { dayEvent, den } from './den.js';

// Things from the stage can be put on spots around the room (bed, pouf, shelf, floor), photos hang in frames,
// and trophies for reading and for the monster collection stand on their own shelf.
const POKOJ_FILES = new Set(['DiffuseTransmissionPlant', 'CarbonFibre', 'SpecularSilkPouf', 'IridescenceLamp', 'ToyCar']);
const DEFAULT_POKOJ = { spots: { polickaA: { type: 'item', id: 'auticko' }, polickaC: { type: 'item', id: 'duhova' }, zemA: { type: 'item', id: 'micek' } }, frames: {}, trofeje: 0, sbirka: 0 };
let pokoj = { ...DEFAULT_POKOJ, ...store.get('kk-pokoj', {}) };
const decor = {};          // spot id → a built thing (same shape as `current`)
let roomReady = false;     // don't save until the saved room is back
const spotById = id => room.userData.spots.find(s => s.id === id);
function srcOf(c) {
  if (!c) return null;
  if (c.type === 'item') return { type: 'item', id: c.item.id };
  if (c.type === 'monster') return { type: 'monster', monster: { seed: c.monster.seed, name: c.monster.name, tint: c.monster.tint ?? null, gen: c.monster.gen || 1 } };
  if (c.type === 'combo' || c.type === 'ozdoba') return { type: c.type, id: c.id };
  return null; // photos go into frames instead
}
function savePokoj() {
  if (!roomReady) return;
  const spots = {};
  for (const [id, c] of Object.entries(decor)) { const s = srcOf(c); if (s) spots[id] = s; }
  pokoj.spots = spots;
  return store.set('kk-pokoj', pokoj);
}
function settleInSpot(c, spot) {
  const h = c.holder;
  room.add(h);
  h.position.copy(spot.pos);
  h.rotation.set(0, spot.rot || 0, 0);
  h.scale.setScalar(Math.min(1, spot.size / c.maxDim));
  h.userData.pokoj = { kind: 'deco', id: spot.id };
  c.where = 'room'; c.spot = spot.id;
  decor[spot.id] = c;
}
async function restoreRoom() {
  await Promise.all(Object.entries(pokoj.spots || {}).map(async ([id, src]) => {
    const spot = spotById(id);
    if (!spot) return;
    try {
      let full;
      if (src.type === 'item') {
        const it = byId(src.id);
        if (!it) return;
        full = { type: 'item', item: { ...it, file: POKOJ_FILES.has(it.file) ? 'pokoj/' + it.file : it.file } };
      } else full = src;
      const c = await buildFor(full, { decor: true });
      c.dis.uDis.value = 0;
      if (!decor[id]) settleInSpot(c, spot); else disposeObj(c.holder);
    } catch (e) { /* a missing model just leaves the spot empty */ }
  }));
  for (const f of room.userData.frames) if (pokoj.frames[f.id]) setFrame(f, pokoj.frames[f.id]);
  roomReady = true;
}
// A monster can only be in one place: using it elsewhere takes it off its spot.
function takeFromRoom(seed) {
  for (const [id, c] of Object.entries(decor)) {
    if (c.type === 'monster' && c.monster.seed === seed) { delete decor[id]; c.holder.removeFromParent(); disposeObj(c.holder); savePokoj(); }
  }
}
function updateDecor(t, dt) {
  for (const c of Object.values(decor)) {
    const ud = c.obj.userData;
    if (ud.mixer) ud.mixer.update(dt);
    if (ud.mixer2) ud.mixer2.update(dt);
    if (ud.monster) { ud.monster.update(t, camera.position); if (ud.monster.doplnkyUpdate) ud.monster.doplnkyUpdate(t); }
    if (ud.float) c.obj.position.y = Math.sin(t * 1.7 + c.maxDim) * 0.04;
    if (ud.ozdoba) updateOzdoba(c.obj, t);
  }
  if (markers.visible) for (const m of markers.children) { const w = t * 4 + m.position.x * 3; m.scale.setScalar(m.userData.base * (1 + 0.15 * Math.sin(w))); m.position.y = m.userData.y + 0.05 * Math.abs(Math.sin(w * 0.5)); m.material.rotation = 0.15 * Math.sin(w * 0.7); }
}

// Flying a thing along a little arc.
async function fly(c, toPos, toScale, toRot = 0) {
  const h = c.holder;
  scene.attach(h);
  const from = h.position.clone(), s0 = h.scale.x, r0 = h.rotation.y;
  const lift = Math.max(0.5, from.distanceTo(toPos) * 0.3);
  play('whoosh');
  await animate(1.0, k => {
    const e = ease.inOut(k);
    h.position.lerpVectors(from, toPos, e);
    h.position.y += Math.sin(e * Math.PI) * lift;
    h.scale.setScalar(s0 + (toScale - s0) * e);
    h.rotation.set(0, r0 + (toRot - r0) * e + e * Math.PI * 2, 0);
    if (k > 0.1 && k < 0.9 && Math.random() < 0.35) sparkles.userData.emit(h.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.15, 0)), 2, 0.6, 0.2);
  });
}
async function bringToStage(d) {
  delete decor[d.spot];
  d.holder.userData.pokoj = null;
  await fly(d, spinner.getWorldPosition(new THREE.Vector3()), 1, 0);
  spinner.add(d.holder);
  d.holder.position.set(0, 0, 0); d.holder.rotation.set(0, 0, 0); d.holder.scale.setScalar(1);
  d.where = 'stage'; d.spot = null; d.raised = false;
  d.fromRoom = true; // the room then offers to put it in the box, tidy it away or set it free
  S.current = d;
  play('place');
}
// Put what is on the stage onto a spot (whatever was there comes to the stage instead).
async function placeInRoom(spot) {
  const c = S.current;
  if (!c || c.where !== 'stage' || !srcOf(c)) return;
  const old = decor[spot.id];
  S.current = null;
  if (old) delete decor[spot.id];
  const s = Math.min(1, spot.size / c.maxDim);
  await Promise.all([fly(c, spot.pos, s, spot.rot || 0), old ? (old.spot = spot.id, bringToStage(old)) : null]);
  settleInSpot(c, spot);
  play('place');
  sparkles.userData.emit(spot.pos.clone().add(new THREE.Vector3(0, 0.2, 0)), 16, 0.9, 0.3);
  if (!savePokoj()) showBubble('Pokojíček se nepodařilo uložit, v telefonu je málo místa.');
  speak(`${c.name} je teď v pokojíčku.`);
  dayEvent('pokoj');
}

// Sparkles that mark free spots (and frames) while there is something to put there.
const markers = new THREE.Group();
markers.visible = false;
scene.add(markers);
// A free spot: a big golden star with a dark outline and a glow, so it stands out on the pastel room.
let markerTex = null;
function markerTexture() {
  if (markerTex) return markerTex;
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  const glow = g.createRadialGradient(128, 128, 20, 128, 128, 128);
  glow.addColorStop(0, 'rgba(255,255,255,0.95)'); glow.addColorStop(0.45, 'rgba(255,236,150,0.6)'); glow.addColorStop(1, 'rgba(255,236,150,0)');
  g.fillStyle = glow; g.fillRect(0, 0, 256, 256);
  g.beginPath();
  for (let i = 0; i < 10; i++) { const r = i % 2 ? 34 : 78, a = -Math.PI / 2 + i * Math.PI / 5; g.lineTo(128 + Math.cos(a) * r, 132 + Math.sin(a) * r); }
  g.closePath();
  g.lineJoin = 'round'; g.lineWidth = 14; g.strokeStyle = '#3a1f63'; g.stroke();
  g.fillStyle = '#ffc928'; g.fill();
  g.beginPath(); g.arc(108, 112, 10, 0, 7); g.fillStyle = 'rgba(255,255,255,0.85)'; g.fill();
  markerTex = new THREE.CanvasTexture(c); markerTex.colorSpace = THREE.SRGBColorSpace;
  return markerTex;
}
function showMarkers(on) {
  markers.clear();
  markers.visible = on;
  if (!on) return;
  for (const s of room.userData.spots) {
    if (decor[s.id]) continue;
    // drawn on top of everything, so a star is never hidden behind furniture
    const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: markerTexture(), transparent: true, depthWrite: false, depthTest: false, fog: false }));
    m.renderOrder = 10;
    m.position.copy(s.pos).add(new THREE.Vector3(0, 0.2, 0.05));
    m.userData = { base: 0.42, y: m.position.y, pokoj: { kind: 'spot', id: s.id } };
    m.scale.setScalar(0.42);
    markers.add(m);
  }
}
function spotAtScreen(x, y) {
  let best = null, bd = 70;
  for (const s of room.userData.spots) {
    if (decor[s.id]) continue;
    const v = s.pos.clone().add(new THREE.Vector3(0, 0.15, 0)).project(camera);
    if (v.z > 1) continue;
    const d = Math.hypot((v.x + 1) / 2 * innerWidth - x, (1 - v.y) / 2 * innerHeight - y);
    if (d < bd) { bd = d; best = s; }
  }
  return best;
}

// Camera for the room: steps back and pans sideways with a finger.
let roomPtr = null;
function roomTarget() {
  const back = 4.4; // room half-width
  const portrait = camera.aspect < 1;
  const pos = new THREE.Vector3(0, portrait ? 2.3 : 2.1, portrait ? 6.0 : 4.9), look = new THREE.Vector3(0, 1.25, -2.6);
  const dist = pos.z + 1.5; // framed for the depth of the bed and the shelves
  const half = dist * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect;
  const maxX = Math.max(0, back - 0.2 - half);
  const x = S.roomPan * maxX;
  pos.x = x; look.x = x;
  return { pos, look };
}
async function openRoom() {
  hideBubble();
  buildTrophies(true);
  fillVitrina();
  S.roomPan = 0;
  setPhase('pokoj');
}
function roomPointerDown(e) {
  roomPtr = { x: e.clientX, y: e.clientY, id: e.pointerId, pan0: S.roomPan, moved: false };
  canvas.setPointerCapture(e.pointerId);
}
canvas.addEventListener('pointermove', e => {
  if (!roomPtr || e.pointerId !== roomPtr.id) return;
  const dx = e.clientX - roomPtr.x;
  if (!roomPtr.moved && Math.abs(dx) < 12) return;
  if (S.phase === 'vitrina') { roomPtr.moved = true; return; } // the close view of the cabinet does not pan
  roomPtr.moved = true;
  S.roomPan = THREE.MathUtils.clamp(roomPtr.pan0 - dx / (innerWidth * 0.45), -1, 1);
});
const roomUp = e => {
  if (!roomPtr || e.pointerId !== roomPtr.id) return;
  const p = roomPtr; roomPtr = null;
  if (!p.moved && (S.phase === 'pokoj' || S.phase === 'schovka' || S.phase === 'vitrina') && !S.busy) roomTap(e);
};
canvas.addEventListener('pointerup', roomUp);
canvas.addEventListener('pointercancel', e => { if (roomPtr && e.pointerId === roomPtr.id) roomPtr = null; });

function roomTap(e) {
  if (S.phase === 'schovka') { schovkaTap(e); return; }
  setPointer(e);
  const targets = [...messTargets(), ...(markers.visible ? markers.children : []), ...Object.values(decor).map(c => c.holder), ...room.userData.frames.map(f => f.group), trophies,
    room.userData.vitrina.group, ...room.children.filter(o => o.userData.pokoj && o.userData.pokoj.kind === 'kouzlo')];
  const hits = raycaster.intersectObjects(targets, true);
  for (const h of hits) {
    let o = h.object;
    while (o && !o.userData.pokoj) o = o.parent;
    if (!o) continue;
    const info = o.userData.pokoj;
    initAudio();
    if (info.kind === 'mess') { if (S.phase === 'pokoj') tapMess(info.id); return; }
    if (info.kind === 'spot') {
      const spot = spotById(info.id);
      if (S.current && S.current.where === 'stage' && srcOf(S.current)) run(async () => { await placeInRoom(spot); }).then(() => setPhase('pokoj'));
      else openOzdobaPicker(spot);
    } else if (info.kind === 'deco') {
      const d = decor[info.id];
      if (d.type === 'ozdoba') { putAwayOzdoba(d); return; }
      if (S.current && S.current.where === 'box') { showBubble('Krabice je zabraná. Nejdřív z ní vyndej, co je uvnitř.'); play('boing'); return; }
      run(async () => {
        if (S.current && srcOf(S.current)) await placeInRoom(spotById(info.id));
        else { if (S.current) await removeCurrent(); await bringToStage(d); savePokoj(); speak(`${d.name} je před krabicí.`); }
      }).then(() => setPhase('pokoj'));
    } else if (info.kind === 'frame') openFramePicker(room.userData.frames.find(f => f.id === info.id));
    else if (info.kind === 'kouzlo') tapKouzlo(info);
    else if (info.kind === 'vitrina') {
      if (S.phase === 'vitrina') return;
      const f = room.userData.vitrina.fochy;
      let best = 0; f.forEach((x, i) => { if (x.center.distanceTo(h.point) < f[best].center.distanceTo(h.point)) best = i; });
      play('tap'); openVitrina(best);
    } else if (info.kind === 'trophy') { play(info.got ? 'giggle' : 'tap'); showBubble(info.text); speak(info.text.replace(/[^\p{L}\p{N}\s!?.,]/gu, '')); if (info.got) sparkles.userData.emit(o.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.15, 0)), 14, 0.7, 0.2); }
    return;
  }
}

// Frames: a monster picture from the album or one of the child's photos.
for (const f of room.userData.frames) f.group.userData.pokoj = { kind: 'frame', id: f.id };
function setFrame(f, url) {
  const m = f.img.material;
  if (!url) { m.map = f.empty; m.needsUpdate = true; return; }
  texLoader.load(url, t => {
    t.colorSpace = THREE.SRGBColorSpace;
    const ia = t.image.width / t.image.height, pa = 0.4 / 0.5;
    if (ia > pa) { t.repeat.set(pa / ia, 1); t.offset.set((1 - pa / ia) / 2, 0); } else { t.repeat.set(1, ia / pa); t.offset.set(0, (1 - ia / pa) / 2); }
    if (m.map && m.map !== f.empty) m.map.dispose();
    m.map = t; m.needsUpdate = true;
  });
}
function shrinkImage(url, max = 256) {
  return new Promise(res => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      res(c.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => res(null);
    img.src = url;
  });
}
function openFramePicker(f) {
  play('tap');
  $('ramecek-nadpis').textContent = '🖼️ Co dáme do rámečku?';
  const grid = $('ramecek-mrizka');
  grid.innerHTML = '';
  const pickIt = async url => {
    $('ramecek').hidden = true;
    const small = url ? await shrinkImage(url) : null;
    if (url && !small) return;
    if (small) pokoj.frames[f.id] = small; else delete pokoj.frames[f.id];
    setFrame(f, small);
    if (!savePokoj()) showBubble('Fotku se nepodařilo uložit, v telefonu je málo místa.');
    play('place');
    sparkles.userData.emit(f.group.getWorldPosition(new THREE.Vector3()), 14, 0.7, 0.25);
  };
  for (const a of S.album) if (a.thumb) grid.append(tile({ label: a.name, img: a.thumb, onClick: () => pickIt(a.thumb) }));
  for (const p of S.photos) grid.append(tile({ label: 'Fotka', img: p.data, onClick: () => pickIt(p.data) }));
  if (!S.album.length && !S.photos.length) grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;opacity:.8">Zatím nemáš žádné obrázky. Vyrob příšerku nebo něco vyfoť!</p>';
  if (pokoj.frames[f.id]) grid.append(tile({ label: 'Sundat obrázek', icon: '🧹', onClick: () => pickIt(null) }));
  $('ramecek').hidden = false;
}
$('ramecek-zavrit').addEventListener('click', () => { $('ramecek').hidden = true; });

// Trophies: one cup for each reading rank, one medal for each size of the monster collection.
const trophies = new THREE.Group();
room.add(trophies);
const SBIRKA_MEDAILE = [1, 5, 10, 21];
function trophyList() {
  pokoj.sbirka = Math.max(pokoj.sbirka || 0, S.album.length);
  const cups = HODNOSTI.slice(1).map(h => {
    const name = hrac.kluk ? h.kluk : h.nazev, got = S.stars >= h.od;
    return { kind: 'cup', icon: h.ikona, got, text: got ? `${h.ikona} ${name}! Trofej za ${h.od} hvězdiček ze čtení.` : `Tuhle trofej dostaneš za ${h.od} hvězdiček ze čtení. Teď jich máš ${S.stars}.` };
  });
  const medals = SBIRKA_MEDAILE.map(n => {
    const got = pokoj.sbirka >= n;
    const word = n === 1 ? 'první příšerku' : `${n} příšerek`;
    return { kind: 'medal', label: String(n), got, text: got ? `🏅 Medaile za ${word} ve sbírce!` : `Tuhle medaili dostaneš, až budeš mít ${word} ve sbírce.` };
  });
  return [...cups, ...medals];
}
const look = m => CARTOON ? toonMaterial(m) : m; // shared, so the toon twins are made once here
const goldMat = look(new THREE.MeshPhysicalMaterial({ color: 0xf5c542, metalness: 1, roughness: 0.22, clearcoat: 0.5 }));
const ghostMat = look(new THREE.MeshStandardMaterial({ color: 0xbfb6d6, roughness: 0.6, transparent: true, opacity: 0.45 }));
const cupGeo = new THREE.LatheGeometry([[0.0, 0], [0.07, 0], [0.07, 0.02], [0.02, 0.035], [0.015, 0.09], [0.03, 0.1], [0.075, 0.13], [0.085, 0.2], [0.08, 0.205]].map(([x, y]) => new THREE.Vector2(x, y)), 24);
const fullCupGeo = mergeAll([cupGeo, ...[-1, 1].map(s => new THREE.TorusGeometry(0.035, 0.008, 8, 16, Math.PI).rotateZ(s > 0 ? -Math.PI / 2 : Math.PI / 2).translate(s * 0.085, 0.155, 0))]);
function medalTexture(label) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#f5c542'; g.beginPath(); g.arc(64, 64, 62, 0, 7); g.fill();
  g.strokeStyle = '#c9971c'; g.lineWidth = 8; g.beginPath(); g.arc(64, 64, 52, 0, 7); g.stroke();
  g.fillStyle = '#8a5a00'; g.font = '900 60px Nunito, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(label, 64, 68);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function buildTrophies(announce = false) {
  for (const o of [...trophies.children]) { o.removeFromParent(); o.traverse(m => { if (!m.isMesh && !m.isSprite) return; for (const mt of [m.material].flat()) if (mt !== goldMat && mt !== ghostMat) { if (mt.map && !m.isSprite) mt.map.dispose(); mt.dispose(); } }); }
  const list = trophyList(), slots = room.userData.trophySlots;
  list.forEach((tr, i) => {
    const g = new THREE.Group();
    g.position.copy(slots[i]);
    g.userData.pokoj = { kind: 'trophy', got: tr.got, text: tr.text };
    if (tr.kind === 'cup') {
      const cup = new THREE.Mesh(fullCupGeo, tr.got ? goldMat : ghostMat); cup.castShadow = tr.got; g.add(cup);
      if (tr.got) { const sp = emojiSprite(tr.icon, 0.1); sp.position.set(0, 0.29, 0.02); g.add(sp); }
    } else {
      const stand = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.1, 0.03), new THREE.MeshStandardMaterial({ color: tr.got ? 0xff5f9e : 0xbfb6d6, roughness: 0.6 }));
      stand.position.y = 0.05; g.add(stand);
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.015, 28), tr.got ? [goldMat, new THREE.MeshStandardMaterial({ map: medalTexture(tr.label), metalness: 0.6, roughness: 0.3 }), goldMat] : ghostMat);
      disc.rotation.x = Math.PI / 2; disc.position.set(0, 0.16, 0.02); disc.castShadow = true; g.add(disc);
    }
    trophies.add(g);
  });
  const got = list.filter(t => t.got).length;
  if (announce && got > (pokoj.trofeje || 0)) {
    setTimeout(() => { showBubble('🏆 Na poličce máš novou trofej! Klepni na ni.'); play('giggle'); }, 900);
    sparkles.userData.emit(new THREE.Vector3(3.3, 1.7, -2.4), 30, 1.2, 0.5);
  }
  pokoj.trofeje = got;
  savePokoj();
}
$('btn-pokoj').addEventListener('click', () => {
  if (S.phase === 'schovka') return;
  if (S.busy || $('panel').classList.contains('schovany') && S.phase !== 'pokoj') return;
  initAudio(); play('tap');
  if (S.phase === 'pokoj') { $('btn-hlavni').click(); return; }
  openRoom();
});

// ---------- Room decorations from the daily chest ----------
pokoj.ozdoby ||= [];
function unplacedOzdoby() {
  const left = [...pokoj.ozdoby];
  for (const c of Object.values(decor)) if (c.type === 'ozdoba') { const i = left.indexOf(c.id); if (i >= 0) left.splice(i, 1); }
  return [...new Set(left)];
}
async function placeOzdoba(spot, id) {
  S.busy = true;
  try {
    const c = await buildFor({ type: 'ozdoba', id }, { decor: true });
    settleInSpot(c, spot);
    play('place');
    await animate(0.6, k => { c.dis.uDis.value = 1 - k; });
    c.dis.uDis.value = 0;
    sparkles.userData.emit(spot.pos.clone().add(new THREE.Vector3(0, 0.2, 0)), 20, 0.9, 0.3);
    savePokoj();
    dayEvent('pokoj');
  } finally { S.busy = false; }
  setPhase('pokoj');
}
function openOzdobaPicker(spot) {
  const list = unplacedOzdoby();
  if (!list.length) {
    const t = Ukoly.allDone(den) && den.opened ? 'Tady je volné místo. Vrať se ke krabici a vyber, co sem dáš.' : 'Tady je volné místo. Ozdoby do pokoje dostaneš za úkoly dne v 📅.';
    showBubble(t); speak(t); return;
  }
  play('tap');
  $('ramecek-nadpis').textContent = '🎁 Co sem dáme?';
  const grid = $('ramecek-mrizka');
  grid.innerHTML = '';
  for (const id of list) { const o = ozdobaById(id); grid.append(tile({ label: o.nazev, icon: o.ikona, onClick: () => { $('ramecek').hidden = true; placeOzdoba(spot, id); } })); }
  $('ramecek').hidden = false;
}
async function putAwayOzdoba(c) {
  S.busy = true;
  try {
    delete decor[c.spot];
    play('poof');
    await animate(0.4, k => { c.dis.uDis.value = k; });
    c.holder.removeFromParent(); disposeObj(c.holder);
    savePokoj();
    const t = `${c.name} je uklizen${c.g === 'm' ? 'ý' : c.g === 'n' ? 'é' : 'á'}. Klepni na ⭐ a dej ji jinam.`;
    showBubble(t);
  } finally { S.busy = false; }
  setPhase('pokoj');
}

export { bringToStage, buildTrophies, decor, settleInSpot, openRoom, placeInRoom, pokoj, restoreRoom, roomPointerDown, roomTarget, savePokoj,
  showMarkers, spotAtScreen, spotById, srcOf, takeFromRoom, unplacedOzdoby, updateDecor };
