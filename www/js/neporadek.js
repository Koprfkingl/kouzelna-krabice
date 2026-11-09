// Monsters behave like children now and then: they make a real mess of the room. Toys, books, socks and crayons
// lie all over the floor, things are knocked off their places, the bed is unmade and a mug is spilled.
// The child, like a parent, makes the monster tidy up: a happy monster listens sooner, a grumpy one makes excuses.
// Or the child tidies up herself, thing by thing. Either way there is a star at the end.
// Not annoying: a new mess comes at most once in a few hours and only when the last one is tidied up.
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
import { a as rod } from './hrac.js';

const GAP_H = 5;          // hours between two messes at least
const MAX = 1;            // one big mess at a time
const CLUTTER = 6;        // things thrown on the floor in one mess
let state = { list: [], last: 0, ...store.get('kk-neporadek', {}) };
const save = () => store.set('kk-neporadek', state);
const shown = {};         // mess id → { obj (what is tapped), sign (the broom above it), undo() }
let uklid = null;         // the mess being tidied up: { m, c (culprit), tries }

const KINDS = ['shozeno', 'postel', 'louze', 'hracka'];
const groupOf = m => m.g || m.id;
const groups = () => [...new Set(state.list.map(groupOf))];
const EXCUSES = ['Ale já si chci hrát!', 'Nechce se mi…', 'Až potom!', 'To nebyla moje vina!', 'Jsem moc unavená…', 'Hmm… zítra?'];

// ---------- making a mess ----------
// places on both sides of the box and the stand, so a mess is seen right away (a phone shows a narrow strip)
const VIEW_SPOTS = [[-1.25, -1.45], [1.3, -1.4], [-1.05, -0.3], [1.05, -0.25], [-1.2, 0.3], [1.2, 0.35]];
function viewPoint(gap) {
  const taken = [...Object.values(decor).map(c => c.holder.position), ...state.list.map(m => new THREE.Vector3(m.x, 0, m.z))];
  for (const [x, z] of VIEW_SPOTS) {
    const p = [x + (Math.random() - 0.5) * 0.15, z + (Math.random() - 0.5) * 0.15];
    if (!taken.some(t => Math.hypot(t.x - p[0], t.z - p[1]) < gap)) return p;
  }
  return null;
}
function freeFloorPoint(rand = Math.random, gap = 0.75) {
  for (let i = 0; i < 60; i++) {
    const x = -3.1 + rand() * 6.2, z = -1.0 + rand() * 1.9;
    if (Math.abs(x) < 1.4 && z < 0.5) continue; // the box and its stand
    if (Math.hypot(x, z - 0.55) < 0.95) continue;  // the turntable stand in front of the box
    if (x < -2.9 && z < -0.2) continue;          // the bed
    const near = [...room.userData.props.map(pr => pr.pos), ...Object.values(decor).map(c => c.holder.position), ...state.list.map(m => new THREE.Vector3(m.x, 0, m.z))]
      .some(p => Math.hypot(p.x - x, p.z - z) < gap);
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
// One big mess: the floor full of things, a thing or two knocked off, the bed and a spilled mug.
// Returns the first piece (with the culprit's name); kind makes just one piece of that kind (tests).
function makeMess(kind) {
  if (kind) return makePiece(kind);
  const a = culprit();
  if (!a || groups().length >= MAX) return null;
  const g = 'g' + Date.now().toString(36);
  const made = [];
  const add = k => { const m = makePiece(k, { a, g, quiet: true }); if (m) made.push(m); return m; };
  add('postel'); add('louze');
  for (let i = 0; i < 2; i++) add('shozeno');
  for (let i = 0; i < CLUTTER; i++) add('hracka');
  if (!made.length) return null;
  ensureSign(g);
  updateBadge();
  return made[0];
}
function makePiece(kind, { a = culprit(), g = null, quiet = false } = {}) {
  if (!a) return null;
  const free = KINDS.filter(k => !state.list.some(m => m.kind === k) || k === 'shozeno');
  const things = Object.entries(decor).filter(([id, c]) => c.type !== 'ozdoba' && !state.list.some(m => m.spot === id) && !(c.type === 'monster'));
  let options = free.filter(k => k !== 'shozeno' || things.length);
  options.push('hracka');
  if (kind) { if (!options.includes(kind)) return null; options = [kind]; }
  const k = pickOne(options);
  const [x, z] = (k === 'hracka' || k === 'louze' ? viewPoint(0.45) : null) || freeFloorPoint(Math.random, k === 'hracka' ? 0.42 : 0.75);
  const m = { id: 'n' + Date.now().toString(36) + Math.floor(Math.random() * 1e6), kind: k, x, z, ry: Math.random() * 6.28, seed: a.seed, name: a.name };
  if (g) m.g = g;
  if (k === 'shozeno') m.spot = pickOne(things)[0];
  if (k === 'hracka') { // a different kind of thing each time while there are some
    const unused = CLUTTER_KINDS.map((_, i) => i).filter(i => !state.list.some(x => x.kind === 'hracka' && x.co === i));
    m.co = unused.length ? pickOne(unused) : Math.floor(Math.random() * CLUTTER_KINDS.length);
  }
  state.list.push(m);
  save();
  showMess(m, { sign: !quiet });
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
  if (force || wantsTask || (due && groups().length < MAX && Math.random() < 1.1 - happy / 120)) { if (makeMess()) made++; }
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
// things thrown on the floor: made of simple shapes, light enough for many at once
const MAT = c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6 });
const part = (geo, mat, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.castShadow = true; return o; };
const CLUTTER_KINDS = [
  function kniha(c) { // an open book lying on its face
    const g = new THREE.Group(), cover = MAT(c), paper = MAT(0xfffaf0);
    for (const s of [-1, 1]) { const h = part(new THREE.BoxGeometry(0.17, 0.02, 0.24), cover, s * 0.085, 0.03, 0); h.rotation.z = s * 0.18; g.add(h); }
    g.add(part(new THREE.BoxGeometry(0.3, 0.025, 0.22), paper, 0, 0.012, 0));
    return g;
  },
  function ponozka(c) { // a sock
    const g = new THREE.Group(), m = MAT(c), w = MAT(0xffffff);
    const leg = part(new THREE.CapsuleGeometry(0.045, 0.16, 4, 10), m, 0, 0.045, 0); leg.rotation.z = Math.PI / 2; g.add(leg);
    const foot = part(new THREE.CapsuleGeometry(0.045, 0.08, 4, 10), m, 0.1, 0.045, 0.06); foot.rotation.x = Math.PI / 2; g.add(foot);
    const rim = part(new THREE.TorusGeometry(0.045, 0.014, 6, 14), w, -0.12, 0.045, 0); rim.rotation.y = Math.PI / 2; g.add(rim);
    return g;
  },
  function pastelky() { // crayons
    const g = new THREE.Group();
    [0xff4f5e, 0x5b8def, 0xffd84d, 0x5fd46a].forEach((c, i) => {
      const k = new THREE.Group(), m = MAT(c);
      k.add(part(new THREE.CylinderGeometry(0.018, 0.018, 0.16, 10), m));
      k.add(part(new THREE.ConeGeometry(0.018, 0.04, 10), m, 0, 0.1, 0));
      k.rotation.set(Math.PI / 2, 0, i * 0.7 - 1); k.position.set(i * 0.05 - 0.07, 0.02, (i % 2) * 0.05);
      g.add(k);
    });
    return g;
  },
  function kostky(c) { // building blocks, one on its edge
    const g = new THREE.Group();
    [[c, 0, 0, 0], [0xffd84d, 0.13, 0.02, 0.6], [0x5fd4a8, 0.05, 0.12, 0.25]].forEach(([col, x, z, r], i) => {
      const b = part(new THREE.BoxGeometry(0.1, 0.1, 0.1), MAT(col), x, 0.05, z); b.rotation.y = r; if (i === 1) { b.rotation.z = 0.6; b.position.y = 0.06; } g.add(b);
    });
    return g;
  },
  function papir() { // crumpled paper balls
    const g = new THREE.Group(), m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, flatShading: true });
    [[0, 0, 0.065], [0.13, 0.05, 0.05], [-0.06, 0.12, 0.045]].forEach(([x, z, r]) => g.add(part(new THREE.IcosahedronGeometry(r, 0), m, x, r, z)));
    return g;
  },
  function tricko(c) { // a T-shirt thrown on the floor
    const g = new THREE.Group(), sh = new THREE.Shape();
    sh.moveTo(-0.1, -0.14); sh.lineTo(0.1, -0.14); sh.lineTo(0.1, 0.06); sh.lineTo(0.18, 0.02); sh.lineTo(0.21, 0.09); sh.lineTo(0.09, 0.15);
    sh.lineTo(0.04, 0.12); sh.lineTo(-0.04, 0.12); sh.lineTo(-0.09, 0.15); sh.lineTo(-0.21, 0.09); sh.lineTo(-0.18, 0.02); sh.lineTo(-0.1, 0.06); sh.lineTo(-0.1, -0.14);
    const t = part(new THREE.ExtrudeGeometry(sh, { depth: 0.02, bevelEnabled: false }), MAT(c), 0, 0.022, 0); t.rotation.x = -Math.PI / 2; g.add(t);
    return g;
  },
  function autko(c) { // a small toy car upside down
    const g = new THREE.Group();
    g.add(part(new THREE.BoxGeometry(0.2, 0.06, 0.1), MAT(c), 0, 0.07, 0));
    g.add(part(new THREE.BoxGeometry(0.1, 0.05, 0.09), MAT(0xbfe6ff), -0.01, 0.025, 0));
    for (const x of [-0.06, 0.06]) for (const z of [-0.05, 0.05]) { const w = part(new THREE.CylinderGeometry(0.025, 0.025, 0.02, 12), MAT(0x333333), x, 0.11, z); w.rotation.x = Math.PI / 2; g.add(w); }
    return g;
  },
];
const CLUTTER_COLORS = [0xff6f9f, 0x5b8def, 0x7c4dff, 0x5fd46a, 0xffa94d, 0xff4f5e];
function clutter(m) {
  const g = CLUTTER_KINDS[m.co % CLUTTER_KINDS.length](CLUTTER_COLORS[Math.floor(m.ry * 10) % CLUTTER_COLORS.length]);
  g.scale.setScalar(1.7);
  g.position.set(m.x, 0, m.z); g.rotation.y = m.ry;
  if (CARTOON) toonify(g);
  return g;
}
// one broom sign per mess group, over the piece that is still there
function ensureSign(g) {
  const left = state.list.filter(x => groupOf(x) === g);
  if (!left.length || left.some(x => shown[x.id]?.sign)) return;
  // over a thing near the box (seen first), not over the bed at the side
  const near = m => Math.hypot(m.kind === 'postel' ? 3.7 : m.x, m.kind === 'postel' ? 0 : m.z);
  const best = [...left].sort((p, q) => near(p) - near(q))[0];
  const s = shown[best.id];
  if (!s) return;
  s.sign = sign(s.obj.getWorldPosition(new THREE.Vector3()));
  s.sign.userData.pokoj = { kind: 'mess', id: best.id };
}
function showMess(m, { sign: withSign = true } = {}) {
  if (shown[m.id]) return true;
  if (m.kind === 'hracka') {
    const o = clutter(m);
    o.userData.pokoj = { kind: 'mess', id: m.id };
    room.add(o);
    shown[m.id] = { obj: o, sign: null, undo: async () => {
      // it flies into the magic box (the toy box of the room)
      const from = o.position.clone(), to = new THREE.Vector3(0, 1.1, -1.05);
      await animate(0.6, k => { const e = ease.inOut(k); o.position.lerpVectors(from, to, e); o.position.y += Math.sin(e * Math.PI) * 0.7; o.scale.setScalar(1.7 * (1 - e * 0.9)); o.rotation.y += 0.2; });
      o.removeFromParent(); disposeObj(o);
    } };
    if (withSign) { shown[m.id].sign = sign(o.position); shown[m.id].sign.userData.pokoj = { kind: 'mess', id: m.id }; }
    updateBadge();
    return true;
  }
  if (m.kind === 'shozeno') {
    const c = decor[m.spot];
    if (!c) return false;
    const h = c.holder;
    h.position.set(m.x, 0, m.z);
    h.rotation.set(0, m.ry, Math.PI / 2 * (m.ry > 3 ? 1 : -1)); // lying on its side
    h.updateMatrixWorld(true);
    h.position.y -= new THREE.Box3().setFromObject(h, true).min.y;
    h.userData.pokoj = { kind: 'mess', id: m.id };
    shown[m.id] = { obj: h, sign: withSign ? sign(new THREE.Vector3(m.x, 0, m.z)) : null, undo: async () => {
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
    shown[m.id] = { obj: bed, sign: withSign ? sign(wp) : null, undo: async () => {
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
    shown[m.id] = { obj: g, sign: withSign ? sign(g.position) : null, undo: async () => {
      await animate(0.7, k => { g.scale.setScalar(1 - ease.inOut(k) * 0.98); });
      g.removeFromParent(); disposeObj(g);
    } };
  }
  if (shown[m.id].sign) shown[m.id].sign.userData.pokoj = { kind: 'mess', id: m.id };
  updateBadge();
  return true;
}
// After the room is back: put the saved messes where they were (a thing that is gone takes its mess with it).
function restoreMess() {
  state.list = state.list.filter(m => showMess(m, { sign: !m.g }));
  for (const g of groups()) ensureSign(g);
  save();
  maybeMakeMess();
  updateBadge();
}
function updateBadge() { $('btn-pokoj').classList.toggle('neporadek', state.list.length > 0); }
function messTargets() { return Object.values(shown).flatMap(s => (s.sign ? [s.obj, s.sign] : [s.obj])); }
function updateMess(t) {
  const on = S.phase === 'pokoj';
  for (const s of Object.values(shown)) if (s.sign) { s.sign.visible = on; s.sign.position.y = s.sign.userData.y + Math.abs(Math.sin(t * 3 + s.sign.position.x)) * 0.08; }
}

// ---------- tidying up ----------
// uklid = { g (the mess group), c (the culprit, built in the room), a (its album entry), tries, self (the child tidies) }
const piecesOf = g => state.list.filter(x => groupOf(x) === g);
async function tapMess(id) {
  const m = state.list.find(x => x.id === id);
  if (!m || S.busy) return;
  initAudio();
  if (uklid) { // already tidying: the child tidies this one herself
    if (groupOf(m) !== uklid.g || uklid.working) return;
    if (!uklid.self) { uklid.self = true; }
    await tidyPiece(m);
    if (!piecesOf(uklid.g).length) await finish(false); else setPhase('uklid');
    return;
  }
  S.busy = true;
  try {
    const a = S.album.find(x => x.seed === m.seed) || S.album[0];
    let c = null;
    if (a) {
      c = await buildFor({ type: 'monster', monster: { seed: a.seed, name: a.name, tint: a.tint ?? null, gen: a.gen || 1 } }, { decor: true });
      const at = shown[id].obj.getWorldPosition(new THREE.Vector3());
      c.holder.position.set(m.kind === 'postel' ? -2.75 : at.x + 0.55, 0, (m.kind === 'postel' ? -1.0 : at.z) + 0.35);
      c.holder.scale.setScalar(Math.min(1, 0.55 / c.maxDim));
      c.holder.rotation.y = -0.3;
      room.add(c.holder);
      play('giggle');
      await animate(0.5, k => { c.dis.uDis.value = 1 - k; });
      c.dis.uDis.value = 0;
    }
    uklid = { g: groupOf(m), c, a, tries: 0, self: false };
    const n = piecesOf(uklid.g).length;
    const t = n > 1 ? `Ups! To jsem byla já, ${a ? a.name : 'příšerka'}. Trochu jsem si tu hrála…` : `Ups! To jsem byla já, ${a ? a.name : 'příšerka'}.`;
    showBubble('🙈 ' + t); speak(t);
  } finally { S.busy = false; }
  setPhase('uklid');
}
// one piece back in its place
async function tidyPiece(m) {
  const sh = shown[m.id];
  if (!sh) return;
  const wasBusy = S.busy;
  S.busy = true;
  try {
    play('whoosh');
    const at = sh.obj.getWorldPosition(new THREE.Vector3());
    await sh.undo();
    if (sh.sign) sh.sign.removeFromParent();
    delete shown[m.id];
    state.list = state.list.filter(x => x !== m);
    save(); savePokoj();
    ensureSign(groupOf(m));
    updateBadge();
    play('place');
    sparkles.userData.emit(at.add(new THREE.Vector3(0, 0.3, 0)), 20, 1, 0.3);
  } finally { S.busy = wasBusy; }
}
async function finish(byMonster) {
  const u = uklid;
  const name = u.a ? u.a.name : 'Příšerka';
  const news = giveStar(u.c ? u.c.holder.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3(0, 1, 0));
  let t;
  if (byMonster) {
    if (u.a) { ageCare(u.a); u.a.pece.mazleni = Math.min(100, u.a.pece.mazleni + 10); }
    t = `Hotovo! ${name} uklidila celý pokojíček. Máš hvězdičku.`;
  } else t = `Uklizeno! Ty jsi ale ${rod('pracovitá', 'pracovitý')}. ${name}: Děkuju, příště to uklidím sama. Máš hvězdičku.`;
  if (news) t += ' ' + news;
  showBubble('🧹 ' + t + ' ⭐'); speak(t);
  dayEvent('uklid');
  await wait(0.8);
  await endUklid();
}
async function tidyUp(byMonster) {
  const u = uklid;
  if (!u) return;
  if (!byMonster) { // the child tidies thing by thing
    u.self = true;
    const t = 'Klepni na každou věc, která se má uklidit.';
    showBubble('🧹 ' + t); speak(t);
    setPhase('uklid');
    return;
  }
  // the monster hops from thing to thing and tidies everything
  u.working = true;
  for (const m of piecesOf(u.g)) {
    const sh = shown[m.id];
    if (!sh) continue;
    if (u.c) {
      const h = u.c.holder, p0 = h.position.clone(), to = sh.obj.getWorldPosition(new THREE.Vector3());
      const end = m.kind === 'postel' ? new THREE.Vector3(-2.75, 0, -1.0) : new THREE.Vector3(to.x + 0.3, 0, to.z + 0.25);
      await animate(0.45, k => { h.position.lerpVectors(p0, end, k); h.position.y = Math.sin(k * Math.PI) * 0.25; });
    }
    await tidyPiece(m);
  }
  await finish(true);
}
async function persuade() {
  const u = uklid;
  if (!u) return;
  u.tries++;
  const avg = u.a ? moodOf(u.a).avg : 50;
  if (Math.random() < 0.3 + avg / 200 + u.tries * 0.2) {
    const t = 'No jo, už jdu…';
    showBubble(`🙂 ${u.a ? u.a.name : 'Příšerka'}: ${t}`); speak(t);
    await tidyUp(true);
    return;
  }
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
  const n = uklid ? piecesOf(uklid.g).length : 0;
  const zbyva = n === 1 ? 'Zbývá 1 věc.' : n < 5 ? `Zbývají ${n} věci.` : `Zbývá ${n} věcí.`;
  if (uklid?.self) return {
    title: `🧹 Uklízíš! ${zbyva}`,
    tip: 'Klepni na každou věc, která se má uklidit. Pokoj posouvej prstem.',
    main: action(`📣 ${name}, pomoz mi!`, persuade),
    extra: [action('⬅️ Teď ne', async () => { hideBubble(); await endUklid(); })],
  };
  return {
    title: `🧹 Nepořádek! ${zbyva}`,
    tip: uklid?.tries ? `${name} se jí nechce. Zkus to znovu, nebo to ukliď sama.` : `Řekni jí, ať po sobě uklidí. Nebo to ukliď sama.`,
    main: action(`📣 ${name}, ukliď to!`, persuade),
    extra: [action('🧹 Uklidím to sama', async () => tidyUp(false)), action('⬅️ Teď ne', async () => { hideBubble(); await endUklid(); })],
  };
}
const messCount = () => state.list.length;

document.addEventListener('visibilitychange', () => { if (!document.hidden && maybeMakeMess()) setTimeout(() => { if (S.phase !== 'schovka') showBubble('🧹 Někdo ti v pokojíčku udělal nepořádek!'); }, 600); });

export { makeMess, maybeMakeMess, messCount, messTargets, restoreMess, tapMess, uklidPanel, updateMess };
