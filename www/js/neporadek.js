// Monsters behave like children now and then: they mess up the room (knock a thing off its place onto the floor,
// unmake the bed, spill a mug) and the child, like a parent, makes them tidy up. A happy monster listens sooner;
// a grumpy one makes excuses. Or the child tidies up herself. A monster that tidied up earns her a star.
// Not annoying: a new mess comes at most once in a few hours, at most two at a time, less with happy monsters.
import * as THREE from 'three';
import { play, initAudio } from './audio.js';
import { S } from './stav.js';
import { buildFor, hideBubble, setPhase, showBubble, speak } from './main.js';
import { $, CARTOON, animate, disposeObj, ease, params, pickOne, store, wait } from './util.js';
import { room, sparkles } from './scena.js';
import { ageCare, moodOf } from './pece.js';
import { giveStar } from './citanka.js';
import { decor, savePokoj, settleInSpot, spotById } from './pokojicek.js';
import { dayEvent, den } from './den.js';
import { toonify } from './vzhled.js';

const GAP_H = 5;          // hours between two messes at least
const MAX = 2;            // messes at the same time at most
let state = { list: [], last: 0, ...store.get('kk-neporadek', {}) };
const save = () => store.set('kk-neporadek', state);
const shown = {};         // mess id → { obj (what is tapped), sign (the broom above it), undo() }
let uklid = null;         // the mess being tidied up: { m, c (culprit), tries }

const KINDS = ['shozeno', 'postel', 'louze'];
const EXCUSES = ['Ale já si chci hrát!', 'Nechce se mi…', 'Až potom!', 'To nebyla moje vina!', 'Jsem moc unavená…', 'Hmm… zítra?'];

// ---------- making a mess ----------
function freeFloorPoint(rand = Math.random) {
  for (let i = 0; i < 40; i++) {
    const x = -3.1 + rand() * 6.2, z = -1.0 + rand() * 1.9;
    if (Math.abs(x) < 1.4 && z < 0.5) continue; // the box and its stand
    if (x < -2.9 && z < -0.2) continue;          // the bed
    const near = [...room.userData.props.map(pr => pr.pos), ...Object.values(decor).map(c => c.holder.position), ...state.list.map(m => new THREE.Vector3(m.x, 0, m.z))]
      .some(p => Math.hypot(p.x - x, p.z - z) < 0.75);
    if (!near) return [x, z];
  }
  return [2.2, 0.6];
}
function culprit() {
  const home = S.album.filter(a => !a.vylet); // a monster on a trip cannot make a mess
  if (!home.length) return null;
  // grumpy monsters are the usual suspects
  const w = home.map(a => 1.3 - moodOf(a).avg / 100);
  let r = Math.random() * w.reduce((s, x) => s + x, 0);
  for (let i = 0; i < w.length; i++) if ((r -= w[i]) <= 0) return home[i];
  return home[0];
}
function makeMess(kind) {
  const a = culprit();
  if (!a) return null;
  const free = KINDS.filter(k => !state.list.some(m => m.kind === k) || k === 'shozeno');
  const things = Object.entries(decor).filter(([id, c]) => c.type !== 'ozdoba' && !state.list.some(m => m.spot === id) && !(c.type === 'monster'));
  let options = free.filter(k => k !== 'shozeno' || things.length);
  if (kind && options.includes(kind)) options = [kind];
  if (!options.length) return null;
  const k = pickOne(options);
  const [x, z] = freeFloorPoint();
  const m = { id: 'n' + Date.now().toString(36) + Math.floor(Math.random() * 1e4), kind: k, x, z, ry: Math.random() * 6.28, seed: a.seed, name: a.name };
  if (k === 'shozeno') m.spot = pickOne(things)[0];
  state.list.push(m);
  save();
  showMess(m);
  return m;
}
// A few times a day at most (and less often when the monsters are happy).
function maybeMakeMess({ force = false } = {}) {
  if (!S.album.length || (params.has('demo') && !force)) return 0;
  const now = Date.now();
  if (!state.last) { state.last = now; save(); return 0; } // a fresh start: the first mess comes in a few hours
  let made = 0;
  const due = (now - state.last) / 3.6e6 >= GAP_H;
  const happy = S.album.reduce((s, a) => s + moodOf(a).avg, 0) / S.album.length;
  const wantsTask = den.tasks.some(t => t.on === 'uklid' && t.n < t.goal) && !state.list.length;
  if (force || wantsTask || (due && state.list.length < MAX && Math.random() < 1.1 - happy / 120)) { if (makeMess()) made++; }
  if (due || made) { state.last = now; save(); }
  return made;
}

// ---------- showing it in the room ----------
// A round white sign with a broom above every mess: easy to spot and to tap.
let signTex = null;
function signTexture() {
  if (signTex) return signTex;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  g.beginPath(); g.arc(64, 64, 54, 0, 7); g.fillStyle = '#fff6d6'; g.fill(); g.lineWidth = 9; g.strokeStyle = '#3a1f63'; g.stroke();
  g.font = '68px "Noto Color Emoji", "Segoe UI Emoji", "Apple Color Emoji", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('🧹', 64, 70);
  signTex = new THREE.CanvasTexture(c); signTex.colorSpace = THREE.SRGBColorSpace;
  return signTex;
}
function sign(pos) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: signTexture(), transparent: true, depthWrite: false, depthTest: false, fog: false }));
  s.renderOrder = 10;
  s.scale.setScalar(0.36);
  s.position.copy(pos).add(new THREE.Vector3(0, 0.7, 0.3));
  s.userData.y = s.position.y;
  room.add(s);
  return s;
}
function puddle(m) {
  const g = new THREE.Group();
  const shape = new THREE.Shape();
  for (let i = 0; i <= 24; i++) {
    const a = i / 24 * Math.PI * 2, r = 0.32 * (1 + 0.18 * Math.sin(a * 3 + m.ry) + 0.1 * Math.sin(a * 5));
    if (i === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r); else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  const water = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshStandardMaterial({ color: 0x5fbfff, roughness: 0.1, metalness: 0.1 }));
  water.rotation.x = -Math.PI / 2; water.position.y = 0.012; water.receiveShadow = true;
  water.userData.noOutline = true;
  const mugMat = new THREE.MeshStandardMaterial({ color: 0xff7fb6, roughness: 0.5 });
  const mug = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.065, 0.16, 20, 1, true), mugMat);
  body.material.side = THREE.DoubleSide;
  const bottom = new THREE.Mesh(new THREE.CircleGeometry(0.065, 20), mugMat); bottom.rotation.x = Math.PI / 2; bottom.position.y = -0.08;
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.014, 8, 16), mugMat); handle.position.x = 0.085;
  mug.add(body, bottom, handle);
  mug.rotation.z = Math.PI / 2; mug.position.set(-0.3, 0.075, 0.05);
  g.add(water, mug);
  g.position.set(m.x, 0, m.z); g.rotation.y = m.ry;
  if (CARTOON) toonify(mug);
  return g;
}
function showMess(m) {
  if (shown[m.id]) return true;
  if (m.kind === 'shozeno') {
    const c = decor[m.spot];
    if (!c) return false;
    const h = c.holder;
    h.position.set(m.x, 0, m.z);
    h.rotation.set(0, m.ry, Math.PI / 2 * (m.ry > 3 ? 1 : -1)); // lying on its side
    h.updateMatrixWorld(true);
    h.position.y -= new THREE.Box3().setFromObject(h, true).min.y;
    h.userData.pokoj = { kind: 'mess', id: m.id };
    shown[m.id] = { obj: h, sign: sign(new THREE.Vector3(m.x, 0, m.z)), undo: async () => {
      const spot = spotById(m.spot), from = h.position.clone(), r0 = h.rotation.clone(), to = spot.pos.clone();
      await animate(0.8, k => {
        const e = ease.inOut(k);
        h.position.lerpVectors(from, to, e); h.position.y += Math.sin(e * Math.PI) * 0.6;
        h.rotation.set(r0.x * (1 - e), r0.y + ((spot.rot || 0) - r0.y) * e, r0.z * (1 - e));
      });
      settleInSpot(c, spot);
    } };
  } else if (m.kind === 'postel') {
    const bed = room.userData.bed, d = bed.userData.duvet, p = bed.userData.pillow;
    const d0 = { pos: d.position.clone(), rot: d.rotation.clone() }, p0 = { pos: p.position.clone(), rot: p.rotation.clone() };
    d.position.x += 0.42; d.position.y -= 0.05; d.rotation.set(0.05, 0.45, -0.35);
    p.position.set(0.95, 0.08, -0.35); p.rotation.set(0.1, 0.8, 0.25);
    bed.userData.pokoj = { kind: 'mess', id: m.id };
    const wp = bed.localToWorld(new THREE.Vector3(0, 0.3, 0.2));
    shown[m.id] = { obj: bed, sign: sign(wp), undo: async () => {
      const dp = d.position.clone(), dr = d.rotation.clone(), pp = p.position.clone(), pr = p.rotation.clone();
      await animate(0.8, k => {
        const e = ease.inOut(k);
        d.position.lerpVectors(dp, d0.pos, e); d.rotation.set(dr.x + (d0.rot.x - dr.x) * e, dr.y + (d0.rot.y - dr.y) * e, dr.z + (d0.rot.z - dr.z) * e);
        p.position.lerpVectors(pp, p0.pos, e); p.position.y += Math.sin(e * Math.PI) * 0.4;
        p.rotation.set(pr.x + (p0.rot.x - pr.x) * e, pr.y + (p0.rot.y - pr.y) * e, pr.z + (p0.rot.z - pr.z) * e);
      });
      bed.userData.pokoj = null;
    } };
  } else if (m.kind === 'louze') {
    const g = puddle(m);
    g.userData.pokoj = { kind: 'mess', id: m.id };
    room.add(g);
    shown[m.id] = { obj: g, sign: sign(g.position), undo: async () => {
      await animate(0.7, k => { g.scale.setScalar(1 - ease.inOut(k) * 0.98); });
      g.removeFromParent(); disposeObj(g);
    } };
  }
  shown[m.id].sign.userData.pokoj = { kind: 'mess', id: m.id };
  updateBadge();
  return true;
}
// After the room is back: put the saved messes where they were (a thing that is gone takes its mess with it).
function restoreMess() {
  state.list = state.list.filter(m => showMess(m));
  save();
  maybeMakeMess();
  updateBadge();
}
function updateBadge() { $('btn-pokoj').classList.toggle('neporadek', state.list.length > 0); }
function messTargets() { return Object.values(shown).flatMap(s => [s.obj, s.sign]); }
function updateMess(t) {
  const on = S.phase === 'pokoj';
  for (const s of Object.values(shown)) { s.sign.visible = on; s.sign.position.y = s.sign.userData.y + Math.abs(Math.sin(t * 3 + s.sign.position.x)) * 0.08; }
}

// ---------- tidying up ----------
async function tapMess(id) {
  const m = state.list.find(x => x.id === id);
  if (!m || S.busy) return;
  initAudio();
  S.busy = true;
  try {
    const a = S.album.find(x => x.seed === m.seed) || S.album[0];
    let c = null;
    if (a) {
      c = await buildFor({ type: 'monster', monster: { seed: a.seed, name: a.name, tint: a.tint ?? null, gen: a.gen || 1 } }, { decor: true });
      const at = shown[id].obj.getWorldPosition(new THREE.Vector3());
      const toCam = new THREE.Vector3(0, 0, 1);
      c.holder.position.set(m.kind === 'postel' ? -2.75 : at.x + 0.55, 0, (m.kind === 'postel' ? -1.0 : at.z) + toCam.z * 0.35);
      c.holder.scale.setScalar(Math.min(1, 0.55 / c.maxDim));
      c.holder.rotation.y = -0.3;
      room.add(c.holder);
      play('giggle');
      await animate(0.5, k => { c.dis.uDis.value = 1 - k; });
      c.dis.uDis.value = 0;
    }
    uklid = { m, c, a, tries: 0 };
    const t = `Ups! To jsem byla já, ${a ? a.name : 'příšerka'}.`;
    showBubble('🙈 ' + t); speak(t);
  } finally { S.busy = false; }
  setPhase('uklid');
}
async function tidyUp(byMonster) {
  const u = uklid;
  if (!u) return;
  const s = shown[u.m.id];
  if (u.c && byMonster) {
    // the monster hops over and does it
    const h = u.c.holder, p0 = h.position.clone(), to = s.obj.getWorldPosition(new THREE.Vector3());
    await animate(0.45, k => { h.position.lerpVectors(p0, new THREE.Vector3((p0.x + to.x) / 2, 0, (p0.z + to.z) / 2), k); h.position.y = Math.sin(k * Math.PI) * 0.25; });
  }
  play('whoosh');
  await s.undo();
  s.sign.removeFromParent();
  delete shown[u.m.id];
  state.list = state.list.filter(m => m !== u.m);
  save(); savePokoj();
  updateBadge();
  play('place');
  sparkles.userData.emit(s.obj.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.3, 0)), 30, 1, 0.4);
  const name = u.a ? u.a.name : 'Příšerka';
  let t;
  if (byMonster) {
    const news = giveStar(u.c ? u.c.holder.getWorldPosition(new THREE.Vector3()) : s.obj.position);
    if (u.a) { ageCare(u.a); u.a.pece.mazleni = Math.min(100, u.a.pece.mazleni + 10); }
    t = `Hotovo! ${name} uklidila. Máš hvězdičku.` + (news ? ' ' + news : '');
    showBubble('🧹 ' + t + ' ⭐');
  } else {
    t = `Uklizeno! ${name}: Děkuju, příště to uklidím sama.`;
    showBubble('🧹 ' + t);
  }
  speak(t);
  dayEvent('uklid');
  await wait(0.8);
  await endUklid();
}
async function persuade() {
  const u = uklid;
  if (!u) return;
  u.tries++;
  const avg = u.a ? moodOf(u.a).avg : 50;
  if (Math.random() < 0.3 + avg / 200 + u.tries * 0.2) { await tidyUp(true); return; }
  // a no, with a shake of the head
  const t = pickOne(EXCUSES);
  showBubble(`😤 ${u.a ? u.a.name : 'Příšerka'}: ${t}`); speak(t);
  play('boing');
  if (u.c) { const h = u.c.holder, r0 = h.rotation.y; await animate(0.6, k => { h.rotation.y = r0 + Math.sin(k * Math.PI * 4) * 0.35 * (1 - k); }); h.rotation.y = r0; }
  setPhase('uklid');
}
async function endUklid() {
  const u = uklid;
  uklid = null;
  if (u && u.c) {
    await animate(0.4, k => { u.c.dis.uDis.value = k; });
    u.c.holder.removeFromParent(); disposeObj(u.c.holder);
  }
  setPhase('pokoj');
}
// the panel while tidying up (setPhase in main.js)
function uklidPanel(action) {
  const name = uklid?.a ? uklid.a.name : 'Příšerka';
  return {
    title: '🧹 Nepořádek!',
    tip: uklid?.tries ? `${name} se jí nechce. Zkus to znovu, nebo to ukliď sama.` : `Řekni jí, ať po sobě uklidí. Nebo to ukliď sama.`,
    main: action(`📣 ${name}, ukliď to!`, persuade),
    extra: [action('🧹 Uklidím to sama', async () => tidyUp(false)), action('⬅️ Teď ne', async () => { hideBubble(); await endUklid(); })],
  };
}
const messCount = () => state.list.length;

document.addEventListener('visibilitychange', () => { if (!document.hidden && maybeMakeMess()) setTimeout(() => { if (S.phase !== 'schovka') showBubble('🧹 Někdo ti v pokojíčku udělal nepořádek!'); }, 600); });

export { makeMess, maybeMakeMess, messCount, messTargets, restoreMess, tapMess, uklidPanel, updateMess };
