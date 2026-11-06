// Kouzelná krabice: the magic with the box, the camera, touch controls, the panel with buttons, the collection and the start.
// The other parts of the game live in their own modules (see README, section Struktura).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { byId, proměnil, monsterName, KINDS, ITEMS } from './catalog.js';
import { makeMonster, rng } from './monster.js';
import { VERZE } from './verze.js';
import { prepareDissolve } from './dissolve.js';
import { wear } from './doplnky.js';
import { play, initAudio, muted, setMuted } from './audio.js';
import { a as rod, vokativ, hrac, known, setHrac } from './hrac.js';
import { applyEffect, kouzloById, findKouzlo } from './kouzla.js';
import { ozdobaById, buildOzdoba, updateOzdoba } from './ozdoby.js';
import { S } from './stav.js';
import { toonify, tint, cartoonLights } from './vzhled.js';
import { $, CARTOON, FREEZE, animate, centerOf, disposeObj, ease, low1, params, store, tweens } from './util.js';
import { KEY, adaptQuality, box, boxSlot, camera, canvas, captureRoomReflections, gltfLoader, key, loadBar, manager, renderer,
  room, scene, sparkles, spinner, texLoader } from './scena.js';
import { ageCare, albumEntry, canvasTexture, emojiTexCache, floatUp, freshCare, moodOf, neediest, pet, renderCare,
  updateFloaters } from './pece.js';
import { openReading, openWardrobe, readRound, renderRank } from './citanka.js';
import { buildTrophies, decor, openRoom, placeInRoom, restoreRoom, roomPointerDown, roomTarget, showMarkers, spotAtScreen, srcOf,
  takeFromRoom, unplacedOzdoby, updateDecor } from './pokojicek.js';
import { addSecond, dropSecond, kniha, renderAlbumTabs } from './kniha.js';
import { endSchovka, readSchovka, renderSchovkaCard, startSchovka } from './schovka.js';
import { dayEvent, den, openDen, renderDenBtn } from './den.js';

// ---------- Building things ----------
const gltfCache = {};
function loadItemGltf(item) {
  if (!gltfCache[item.file]) {
    gltfCache[item.file] = new Promise((res, rej) => gltfLoader.load(`modely/${item.file}.glb`, res, undefined, rej));
  }
  return gltfCache[item.file];
}

// Big cartoon eyes on a bone of the model (the fox's own painted eyes are too small to see).
// oci: { bone, pos: [x, y, z] of the right eye in the bone's space (left is mirrored in z), r: radius, look: [x, y, z] }
const eyeWhite = new THREE.MeshBasicMaterial({ color: 0xffffff });
const eyeDark = new THREE.MeshBasicMaterial({ color: 0x1d1028 });
eyeDark.userData.noOutline = true;
function addEyes(model, oci) {
  const bone = model.getObjectByName(oci.bone);
  if (!bone) return;
  const look = new THREE.Vector3(...(oci.look || [1, 0, 0])).normalize();
  for (const side of [1, -1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(oci.r, 20, 14), eyeWhite);
    eye.position.set(oci.pos[0], oci.pos[1], oci.pos[2] * side);
    eye.scale.set(0.9, 1.15, 0.9);
    const dir = new THREE.Vector3(look.x, look.y, look.z * side).normalize();
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(oci.r * 0.62, 16, 12), eyeDark);
    pupil.position.copy(dir).multiplyScalar(oci.r * 0.55);
    pupil.userData.noOutline = true;
    const shine = new THREE.Mesh(new THREE.SphereGeometry(oci.r * 0.2, 10, 8), eyeWhite);
    shine.position.copy(dir).multiplyScalar(oci.r * 1.05).add(new THREE.Vector3(0, oci.r * 0.3, 0));
    shine.userData.noOutline = true;
    eye.add(pupil, shine);
    bone.add(eye);
  }
}

async function buildItem(item) {
  const gltf = await loadItemGltf(item);
  const model = SkeletonUtils.clone(gltf.scene);
  const drop = [];
  model.traverse(o => { if (o.isLight || o.isCamera || (item.hide && item.hide.includes(o.name.replace(/_/g, ' ')))) drop.push(o); });
  for (const o of drop) o.removeFromParent();
  model.traverse(o => {
    if (!o.isMesh) return;
    o.castShadow = o.receiveShadow = true;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      // Real glass (transmission) renders the scene a second time; plain see-through is much cheaper.
      if (m.transmission > 0) { m.transmission = 0; m.transparent = true; m.opacity = Math.min(m.opacity, 0.35); m.depthWrite = false; }
    }
  });
  model.updateMatrixWorld(true);
  const bb = new THREE.Box3().setFromObject(model, true);
  const size = bb.getSize(new THREE.Vector3());
  const s = item.size / Math.max(size.x, size.y, size.z);
  const center = bb.getCenter(new THREE.Vector3());
  model.position.set(-center.x * s, -bb.min.y * s + (item.float || 0), -center.z * s);
  model.scale.setScalar(s);
  if (item.oci) addEyes(model, item.oci);
  const g = new THREE.Group();
  const inner = new THREE.Group();
  inner.rotation.y = item.rot || 0;
  inner.add(model);
  g.add(inner);
  if (item.anim && gltf.animations.length) {
    const mixer = new THREE.AnimationMixer(model);
    const clip = THREE.AnimationClip.findByName(gltf.animations, item.anim) || gltf.animations[0];
    mixer.clipAction(clip).play();
    g.userData.mixer = mixer;
    g.userData.clips = gltf.animations;
  }
  if (item.float) g.userData.float = item.float;
  return g;
}

function photoTexture(dataUrl) {
  return new Promise(res => texLoader.load(dataUrl, t => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; res(t); }));
}
async function buildPhoto(photo) {
  const tex = await photoTexture(photo.data);
  const g = new THREE.Group();
  const card = new THREE.Group();
  const frame = new THREE.Mesh(new RoundedBoxGeometry(0.86, 1.0, 0.025, 4, 0.01), new THREE.MeshPhysicalMaterial({ color: 0xf7f5f0, roughness: 0.55, clearcoat: 0.3 }));
  frame.position.y = 0.5;
  const pic = new THREE.Mesh(new THREE.PlaneGeometry(0.74, 0.74), new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.08 }));
  pic.position.set(0, 0.56, 0.0135);
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.6, 0.02), new THREE.MeshStandardMaterial({ color: 0x777777, metalness: 0.8, roughness: 0.35 }));
  back.position.set(0, 0.28, -0.14); back.rotation.x = -0.45;
  card.add(frame, pic, back);
  card.rotation.x = -0.12;
  g.add(card);
  return g;
}

// A secret creation from the Book of Spells: the base model with changed materials and maybe a smaller model on it.
async function buildCombo(k) {
  const base = byId(k.base);
  const g = await buildItem({ ...base, size: k.size || base.size, anim: base.anim });
  applyEffect(g, k.effect);
  if (k.attach) {
    const it = byId(k.attach.id);
    const a = await buildItem({ ...it, size: k.attach.size, float: 0 });
    g.updateMatrixWorld(true);
    const bb = new THREE.Box3().setFromObject(g, true);
    a.position.set(k.attach.at[0], bb.max.y * k.attach.at[1], k.attach.at[2]);
    if (k.attach.float) a.userData.bob = true;
    g.add(a);
    if (a.userData.mixer) g.userData.mixer2 = a.userData.mixer;
  }
  if (k.effect === 'svetlo') { const l = new THREE.PointLight(0xffd36e, 1.5, 1.6, 2); l.position.y = 0.4; g.add(l); }
  return g;
}
function buildMonster(m) { return makeMonster(m.seed, { tint: m.tint, size: 0.82, gen: m.gen || 1 }); }
function describe(src) {
  if (src.type === 'combo') { const k = kouzloById(src.id); return { living: false, name: k.name, acc: k.acc, g: k.g }; }
  if (src.type === 'ozdoba') { const o = ozdobaById(src.id); return { living: false, name: o.nazev, acc: o.nazev.toLowerCase(), g: 'f' }; }
  if (src.type === 'item') return { living: src.item.kind === 'zive', name: src.item.name, acc: src.item.acc, g: src.item.g };
  if (src.type === 'photo') {
    const k = src.photo.kind;
    const name = k === 'zive' ? 'Živý tvor z fotky' : k === 'stroje' ? 'Stroj z fotky' : 'Věc z fotky';
    const acc = k === 'zive' ? 'živého tvora z fotky' : k === 'stroje' ? 'stroj z fotky' : 'věc z fotky';
    return { living: k === 'zive', name, acc, g: k === 'veci' ? 'f' : 'm' };
  }
  const n = src.monster.name;
  return { living: true, name: `Příšerka ${n}`, acc: `příšerku ${n}`, g: 'f' };
}

// A built thing: holder (moved between stage and box) > bounce (hops when tapped) > obj > model.
async function buildFor(src, { decor: forRoom = false } = {}) {
  if (src.type === 'monster' && !forRoom) takeFromRoom(src.monster.seed);
  const obj = src.type === 'item' ? await buildItem(src.item) : src.type === 'photo' ? await buildPhoto(src.photo)
    : src.type === 'combo' ? await buildCombo(kouzloById(src.id)) : src.type === 'ozdoba' ? buildOzdoba(src.id) : buildMonster(src.monster);
  if (src.type === 'monster') { const e = S.album.find(a => a.seed === src.monster.seed); if (e && e.doplnky && e.doplnky.length) wear(obj, e.doplnky); }
  if (CARTOON) { toonify(obj); if (src.type === 'item' && src.item.ton) tint(obj, src.item.ton); }
  const dis = prepareDissolve(obj);
  dis.uDis.value = 1;
  const holder = new THREE.Group(), bounce = new THREE.Group();
  bounce.add(obj);
  holder.add(bounce);
  const size = new THREE.Box3().setFromObject(obj, true).getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z, 0.01);
  const fit = Math.min(1, box.userData.insideFit / maxDim);   // small enough to fit under the lid
  const show = Math.min(1, 0.95 / maxDim);                     // size when it climbs out to be admired
  try { await renderer.compileAsync(holder, camera, scene); } catch (e) { /* older GPUs compile on first draw */ }
  return { ...src, ...describe(src), obj, bounce, holder, dis, fit, show, maxDim, where: 'stage' };
}

// ---------- The thing, the box and its lid ----------
let lidOpen = false;
let mistTarget = 0, mist = 0;

let zapping = false;

async function removeCurrent(fast = false) {
  dropSecond();
  if (!S.current) return;
  const c = S.current;
  S.current = null;
  if (!fast) await animate(0.45, k => { c.dis.uDis.value = k; });
  c.holder.removeFromParent();
  disposeObj(c.holder);
}

async function putOnStage(src, { appear = true } = {}) {
  const next = await buildFor(src);
  await removeCurrent(!appear);
  S.current = next;
  spinner.add(next.holder);
  if (appear) {
    play('place');
    await animate(0.7, k => { next.dis.uDis.value = 1 - ease.out(k); });
  }
  next.dis.uDis.value = 0;
  return next;
}

let lidK = 0; // 0 shut, 1 open; follows the finger while the lid is dragged
function setLidK(k) { lidK = k; box.userData.setLid(k); }
async function setLid(open) {
  const to = open ? 1 : 0;
  if (lidOpen === open && lidK === to) return;
  lidOpen = open;
  play('lid');
  const from = lidK, light0 = from;
  await animate((open ? 0.9 : 0.7) * Math.max(0.3, Math.abs(to - from)), k => {
    const e = open ? ease.out(k) : ease.inOut(k);
    setLidK(from + (to - from) * e);
    box.userData.setInnerLight(light0 + (to - light0) * e);
  });
  setLidK(to);
  if (!open) play('thump');
}

// Moves the current thing from the stage into the box (or back) along a little arc.
async function moveCurrent(to) {
  const c = S.current;
  const fromWorld = c.holder.getWorldPosition(new THREE.Vector3());
  const target = to === 'box' ? boxSlot : spinner;
  const toWorld = target.getWorldPosition(new THREE.Vector3());
  const s0 = c.holder.getWorldScale(new THREE.Vector3()).x, s1 = to === 'box' ? c.fit : 1;
  scene.attach(c.holder);
  play('whoosh');
  await animate(1.1, k => {
    const e = ease.inOut(k);
    c.holder.position.lerpVectors(fromWorld, toWorld, e);
    c.holder.position.y += Math.sin(e * Math.PI) * 0.9;
    c.holder.scale.setScalar(s0 + (s1 - s0) * e);
    c.holder.rotation.y = e * Math.PI * 2;
    if (k > 0.2 && k < 0.9 && Math.random() < 0.4) sparkles.userData.emit(c.holder.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.2, 0)), 2, 0.6, 0.2);
  });
  target.add(c.holder);
  c.holder.position.set(0, 0, 0);
  c.holder.rotation.set(0, 0, 0);
  c.holder.scale.setScalar(s1);
  c.where = to;
  c.raised = false;
  play('place');
}

// Lid shut, laser inside: only beams leak out through the seam. The thing is swapped while hidden.
async function zap(targetSrc) {
  const before = S.current;
  const nextPromise = buildFor(targetSrc);
  zapping = false;
  play('charge');
  await animate(1.0, k => {
    box.userData.setCharge(k * k);
    box.userData.setSeam(k * 0.6);
    key.intensity = KEY - k * 0.8;
    box.position.x = (Math.random() - 0.5) * 0.012 * k;
  });
  zapping = true;
  play('laser', 2.2);
  const zapTimer = setInterval(() => play('zap'), 140);
  let swapped = false;
  await animate(2.2, k => {
    box.userData.setCharge(1);
    box.userData.setSeam(0.6 + Math.random() * 0.4);
    box.position.x = (Math.random() - 0.5) * 0.02;
    box.position.z = -1.05 + (Math.random() - 0.5) * 0.01;
    if (Math.random() < 0.5) {
      const p = box.localToWorld(new THREE.Vector3((Math.random() - 0.5) * 1.6, box.userData.top + 0.02, (Math.random() - 0.5) * 1.0));
      sparkles.userData.emit(p, 3, 1.2, 0.05);
    }
    if (!swapped && k > 0.5) swapped = true;
  });
  clearInterval(zapTimer);
  zapping = false;
  const next = await nextPromise;
  before.holder.removeFromParent();
  disposeObj(before.holder);
  if (S.second) { S.second.holder.removeFromParent(); disposeObj(S.second.holder); S.second = null; }
  S.current = next;
  next.where = 'box';
  next.dis.uDis.value = 1; // stays invisible until the lid opens
  next.holder.scale.setScalar(next.fit);
  next.holder.position.set(0, -0.2, 0);
  boxSlot.add(next.holder);
  mist = mistTarget = 1;
  await animate(0.6, k => {
    box.userData.setCharge(1 - k);
    box.userData.setSeam((1 - k) * 0.6);
    key.intensity = KEY - 0.8 + k * 0.8;
    box.position.x *= 0.8;
  });
  box.position.set(0, 0, -1.05);
  play('thump');
  return { before, next };
}

// Height above the box floor at which a thing stands on the rim of the open box.
const RISE = box.userData.top - box.userData.inside.position.y + 0.02;

// Before the lid shuts, a thing that climbed out has to sink back in (or its head would stick out).
async function sinkIntoBox() {
  const c = S.current;
  if (!c || c.where !== 'box' || !c.raised) return;
  const y0 = c.holder.position.y, s0 = c.holder.scale.x;
  play('whoosh');
  await animate(0.8, k => {
    const e = ease.inOut(k);
    c.holder.position.y = y0 * (1 - e);
    c.holder.scale.setScalar(s0 + (c.fit - s0) * e);
  });
  c.holder.position.y = 0;
  c.holder.scale.setScalar(c.fit);
  c.raised = false;
}

// The lid opens; the new thing rises out of the mist.
async function reveal(before) {
  const c = S.current;
  await setLid(true);
  play('poof');
  sparkles.userData.emit(boxSlot.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.4, 0)), 120, 1.8, 0.5);
  // first it appears deep in the mist, then it climbs all the way out and stands on top of the open box
  await animate(1.0, k => {
    c.dis.uDis.value = 1 - ease.out(k);
    c.holder.position.y = -0.2 + 0.25 * ease.out(k);
    box.userData.setInnerLight(1 + Math.sin(k * Math.PI) * 0.8);
  });
  c.dis.uDis.value = 0;
  play('whoosh');
  S.shot = 'hero'; startHero(c);
  await animate(1.1, k => {
    const e = ease.out(k);
    c.holder.position.y = 0.05 + (RISE - 0.05) * e + Math.sin(k * Math.PI) * 0.15;
    c.holder.scale.setScalar(c.fit + (c.show - c.fit) * e);
  });
  c.raised = true;
  play('place');
  // a little celebration around the new creation
  { const { c: ctr, s: sz } = centerOf(c.obj); for (const ch of ['⭐', '✨', '🎉', '💫']) floatUp(ch, ctr.clone().add(new THREE.Vector3(0, sz.y * 0.3, 0)), { n: 3, spread: sz.x * 1.6, rise: 0.7, life: 2.2, size: 0.16 }); sparkles.userData.emit(ctr, 80, 1.4, 0.4); }
  let sentence = `${before.name} ${before.g === 'pm' ? 'se proměnili' : proměnil(before.g)} na ${c.acc}!`;
  if (before.kouzlo && before.kouzlo !== 'mix') {
    const k = before.kouzlo, isNew = !kniha[k.id];
    sentence = `${isNew ? 'Tajné kouzlo! ' : ''}${before.name} = ${c.name}!${isNew ? ' Zapisuju ho do Knihy kouzel.' : ''}`;
    setTimeout(async () => { if (S.current !== c) return; const img = await snapshot(c.obj); if (!kniha[k.id] || isNew) { kniha[k.id] = img; store.set('kk-kniha', kniha); } }, 3600);
    if (isNew) { kniha[k.id] = kniha[k.id] || ''; store.set('kk-kniha', kniha); for (const ch of ['📕', '✨', '🌟']) floatUp(ch, centerOf(c.obj).c, { n: 3, spread: 1, rise: 1, life: 2.6 }); }
  } else if (before.kouzlo === 'mix') sentence = `${before.name} se smíchal${before.g === 'pm' ? 'i' : 'y'} a vznikla ${low1(c.name)}! Tahle dvojice v Knize kouzel není, zkus jinou.`;
  showBubble('✨ ' + sentence + ' ✨');
  speak(sentence.replace(/=/g, 'je'));
  dayEvent('promena', { type: c.type, item: c.item?.id, dvojice: !!before.dvojice });
  // the album picture needs a read-back of the screen, which stalls a frame: do it once the camera swoop has settled
  if (c.type === 'monster') { play('giggle'); setTimeout(() => { if (S.current === c) saveToAlbum(c); }, 3600); setTimeout(() => { mistTarget = 0.35; }, 1500); }
  return sentence;
}

function flash() {
  const el = $('blesk');
  el.style.transition = 'none'; el.style.opacity = '0.6';
  requestAnimationFrame(() => { el.style.transition = 'opacity .7s'; el.style.opacity = '0'; });
}

// ---------- Camera ----------
// Views: the stage in front of the box, a look into the box, care close-up, and the "hero" shot that
// swings around a freshly made thing. Everything is framed into the free area above the button panel.
const SHOTS = {
  stage: { pos: new THREE.Vector3(0, 1.5, 3.35), look: new THREE.Vector3(0, 0.55, -0.15) },
  care: { pos: new THREE.Vector3(0, 1.15, 2.75), look: new THREE.Vector3(0, 0.45, 0.55) },
  box: { pos: new THREE.Vector3(0, 3.4, 1.75), look: new THREE.Vector3(0, 0.45, -1.0) },
};

const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
const hero = { start: 0 };
function heroTarget(now) {
  const c = S.current;
  if (!c) return shotTarget('box');
  if (hero.c !== c) startHero(c, hero.start);
  // measured once, so hops and silly reactions don't shake the camera
  const ctr = c.holder.localToWorld(hero.local.clone());
  const size = Math.max(hero.size * c.holder.getWorldScale(new THREE.Vector3()).x, 0.35);
  const t = (now - hero.start) / 1000;
  const k = ease.inOut(Math.min(1, t / 3.4));
  // swings in from the side and from above, ends a little below eye level (looks up at the creation),
  // then keeps slowly swaying so the picture stays alive
  const ang = -0.95 * (1 - k) + 0.25 * Math.sin(t * 0.4) * k;
  const fit = Math.max(1, 0.75 / camera.aspect);
  const R = (3.9 - 1.15 * k) * size * fit;
  const h = (1.5 - 1.62 * k) * size;
  return { pos: ctr.clone().add(new THREE.Vector3(Math.sin(ang) * R, h, Math.cos(ang) * R)), look: ctr.clone().add(new THREE.Vector3(0, 0.08 * size, 0)), fast: true };
}
function startHero(c, start = performance.now()) {
  hero.c = c; hero.start = start;
  c.holder.updateMatrixWorld(true);
  const { c: ctr, s } = centerOf(c.obj);
  const sc = c.holder.getWorldScale(new THREE.Vector3()).x;
  hero.local = c.holder.worldToLocal(ctr.clone());
  hero.size = Math.max(s.y, s.x * 0.8) / sc;
}
function shotTarget(name, now = performance.now()) {
  if (name === 'hero') return heroTarget(now);
  if (name === 'pokoj') return roomTarget();
  const s = SHOTS[name];
  const fit = Math.min(1.9, Math.max(1, 0.8 / camera.aspect)); // narrow screens: step back
  const pos = s.pos.clone().sub(s.look).multiplyScalar(fit).add(s.look);
  return { pos, look: s.look.clone() };
}
// The panel covers the bottom of the screen; the picture is centred in the space above it.
let panelPx = 0, viewW = 1, viewH = 1;
function measurePanel() {
  const el = $('panel');
  if (el.classList.contains('schovany')) return; // keep the last size while it is hidden for a moment
  const hpx = Math.min(el.offsetHeight * 0.88, viewH * 0.6);
  if (Math.abs(hpx - panelPx) > 2) { panelPx = hpx; applyView(); }
}
function applyView() {
  const free = Math.max(120, viewH - panelPx);
  camera.aspect = viewW / free;
  camera.setViewOffset(viewW, free, 0, 0, viewW, viewH);
  camera.updateProjectionMatrix();
}
function resize() {
  viewW = window.innerWidth; viewH = window.innerHeight;
  renderer.setSize(viewW, viewH, false);
  applyView();
}
window.addEventListener('resize', resize);
function snapCamera() { const t = shotTarget(S.shot); camPos.copy(t.pos); camLook.copy(t.look); }

// ---------- Tapping things ----------
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let reaction = null;
// One shared light for the lamp and the camera flash (every point light costs on every pixel, even when off).
const lampLight = new THREE.PointLight(0xffd59a, 0, 4, 2);
scene.add(lampLight);

// Tap = the thing reacts. Drag = carry it with a finger: from the stage into the box, or out of the open box.
let drag = null;
const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.0); // y = 1.0, just above the box
const setPointer = e => { pointer.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1); raycaster.setFromCamera(pointer, camera); };
const overBox = p => Math.abs(p.x - box.position.x) < 0.95 && Math.abs(p.z - box.position.z) < 0.75;

// The lid follows a finger: pull it up to open, push it down to close.
let lidDrag = null;
const LID_OPENING = ['stage', 'closed', 'done'], LID_CLOSING = ['stageOpen', 'inside', 'result'];
function startLidDrag(e) {
  const opening = LID_OPENING.includes(S.phase);
  if (!opening && !LID_CLOSING.includes(S.phase)) return false;
  lidDrag = { y0: e.clientY, k0: lidK, opening, moved: false, id: e.pointerId, phase: S.phase };
  canvas.setPointerCapture(e.pointerId);
  return true;
}
canvas.addEventListener('pointermove', e => {
  if (!lidDrag || e.pointerId !== lidDrag.id) return;
  const dy = lidDrag.y0 - e.clientY;
  if (!lidDrag.moved) {
    if (Math.abs(dy) < 10) return;
    lidDrag.moved = true;
    S.busy = true;
    hidePanel(true);
    hideBubble();
    if (lidDrag.phase === 'result') lidDrag.sink = sinkIntoBox();
    play('lid');
  }
  const k = THREE.MathUtils.clamp(lidDrag.k0 + dy / (window.innerHeight * 0.22), 0, 1);
  setLidK(k);
  box.userData.setInnerLight(k);
});
const endLidDrag = e => {
  if (!lidDrag || e.pointerId !== lidDrag.id) return;
  const d = lidDrag;
  lidDrag = null;
  const open = d.moved ? (d.opening ? lidK > 0.3 : lidK > 0.7) : d.opening; // a plain tap opens or closes too
  S.busy = false;
  if (open === lidOpen) { // changed its mind: the lid swings back
    run(async () => { await d.sink; await setLid(open); }, { silent: true }).then(() => setPhase(S.phase));
    return;
  }
  run(async () => { await d.sink; await LID_STEPS[d.phase](); });
};
canvas.addEventListener('pointerup', endLidDrag);
canvas.addEventListener('pointercancel', endLidDrag);
canvas.addEventListener('lostpointercapture', endLidDrag);

canvas.addEventListener('pointerdown', e => {
  initAudio();
  if (S.phase === 'pokoj' || S.phase === 'schovka') { if (!S.busy) roomPointerDown(e); return; }
  if (S.busy || !S.current || drag || lidDrag) return;
  setPointer(e);
  if (!raycaster.intersectObject(S.current.holder, true).length) {
    if (raycaster.intersectObject(box, true).length) startLidDrag(e);
    return;
  }
  const fromStage = S.current.where === 'stage' && (S.phase === 'stage' || S.phase === 'stageOpen');
  const fromBox = S.current.where === 'box' && lidOpen && (S.phase === 'inside' || S.phase === 'result');
  drag = { x: e.clientX, y: e.clientY, moved: false, canDrag: fromStage || fromBox, origin: fromBox ? 'box' : 'stage', id: e.pointerId, strokes: 0 };
  canvas.setPointerCapture(e.pointerId);
});

canvas.addEventListener('pointermove', e => {
  if (!drag || e.pointerId !== drag.id) return;
  if (!drag.canDrag) {
    // not draggable now: moving a finger over it counts as stroking (care mode)
    if (S.tapHook && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 25) { drag.x = e.clientX; drag.y = e.clientY; drag.moved = true; S.tapHook('stroke'); }
    return;
  }
  if (!drag.moved) {
    if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 12) return;
    drag.moved = true;
    S.busy = true;
    hidePanel(true);
    hideBubble();
    if (S.shot === 'hero') S.shot = 'box'; // don't let the camera chase the finger
    if (drag.origin === 'box') dropSecond();
    scene.attach(S.current.holder);
    if (drag.origin === 'stage' && srcOf(S.current)) showMarkers(true);
    drag.pos = S.current.holder.position.clone();
    drag.scale = S.current.holder.scale.x;
    play('whoosh');
  }
  setPointer(e);
  const p = new THREE.Vector3();
  if (!raycaster.ray.intersectPlane(dragPlane, p)) return;
  p.x = THREE.MathUtils.clamp(p.x, -2.2, 2.2); p.z = THREE.MathUtils.clamp(p.z, -1.6, 1.4);
  const near = overBox(p);
  drag.over = near;
  if (near) {
    // Over the box the lid swings open and the thing hovers right above the opening, already box-sized.
    if (!lidOpen) { drag.openedLid = true; setLid(true); }
    drag.pos.set(THREE.MathUtils.clamp(p.x, -0.45, 0.45), box.userData.top + 0.06, box.position.z + THREE.MathUtils.clamp(p.z - box.position.z, -0.2, 0.3));
    drag.scale = S.current.fit;
  } else {
    drag.pos.set(p.x, p.y - 0.35, p.z);
    drag.scale = 1;
  }
  box.userData.setInnerLight(near || lidOpen ? 1 : 0);
  if (Math.random() < 0.3) sparkles.userData.emit(S.current.holder.getWorldPosition(new THREE.Vector3()), 1, 0.4, 0.15);
});

// Called every frame: the carried thing glides after the finger (smooth even when touch events are sparse).
function updateDrag(dt) {
  if (!drag || !drag.moved || !drag.pos || !S.current) return;
  const h = S.current.holder, f = 1 - Math.exp(-dt * 14);
  h.position.lerp(drag.pos, f);
  h.scale.setScalar(THREE.MathUtils.lerp(h.scale.x, drag.scale, f));
}

const endDrag = e => {
  if (!drag || e.pointerId !== drag.id) return;
  const d = drag;
  drag = null;
  if (!d.moved) { if (S.tapHook) S.tapHook('tap'); else tapThing(S.current); return; }
  if (!d.canDrag) return;
  const c = S.current;
  showMarkers(false);
  const spot = !d.over && d.origin === 'stage' && srcOf(c) ? spotAtScreen(e.clientX, e.clientY) : null;
  if (spot) { S.busy = true; (async () => { try { if (d.openedLid) setLid(false); await placeInRoom(spot); } finally { S.busy = false; } if (S.current) setPhase('stage'); else showPicker(); })(); return; }
  (async () => {
    try {
      if (d.over) {
        // Dropped over the box: it settles inside.
        const to = boxSlot.getWorldPosition(new THREE.Vector3()), from = c.holder.position.clone(), s0 = c.holder.scale.x;
        await animate(0.5, k => { c.holder.position.lerpVectors(from, to, ease.inOut(k)); c.holder.scale.setScalar(s0 + (c.fit - s0) * k); });
        boxSlot.add(c.holder);
        c.holder.position.set(0, 0, 0); c.holder.rotation.set(0, 0, 0); c.holder.scale.setScalar(c.fit);
        c.where = 'box'; c.raised = false;
        play('place');
        S.busy = false;
        setPhase(d.origin === 'box' ? S.phase : 'inside');
      } else {
        // Dropped elsewhere: it lands on the stage (taken out of the box, or back where it was).
        const to = spinner.getWorldPosition(new THREE.Vector3()), from = c.holder.position.clone(), s0 = c.holder.scale.x;
        await animate(0.45, k => { c.holder.position.lerpVectors(from, to, ease.inOut(k)); c.holder.position.y += Math.sin(k * Math.PI) * 0.2; c.holder.scale.setScalar(s0 + (1 - s0) * k); });
        spinner.add(c.holder);
        c.holder.position.set(0, 0, 0); c.holder.rotation.set(0, 0, 0); c.holder.scale.setScalar(1);
        c.where = 'stage'; c.raised = false;
        play('boing');
        if (d.origin === 'box') { mistTarget = 0; await setLid(false); S.busy = false; setPhase('stage'); }
        else {
          if (d.openedLid && S.phase === 'stage') await setLid(false);
          else if (!lidOpen) box.userData.setInnerLight(0);
          S.busy = false;
          setPhase(S.phase);
        }
      }
    } finally { S.busy = false; }
  })();
};
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);
canvas.addEventListener('lostpointercapture', endDrag); // released outside the window: never leave it hanging

function react(c) {
  const kind = c.type === 'item' ? c.item.sound : c.type === 'monster' ? 'monster' : null;
  if (kind === 'monster') play('giggle'); else if (kind) play(kind); else play('boing');
  if (kind === 'lampa') { lampLight.intensity = lampLight.intensity > 0 ? 0 : 4; lampLight.position.copy(centerOf(c.obj).c).add(new THREE.Vector3(0, 0.2, 0.3)); }
  if (kind === 'fotak') { const i0 = lampLight.intensity, c0 = lampLight.color.getHex(); lampLight.color.set(0xffffff); lampLight.position.copy(centerOf(c.obj).c).add(new THREE.Vector3(0, 0.3, 0.6)); lampLight.intensity = 30; setTimeout(() => { lampLight.intensity = i0; lampLight.color.setHex(c0); }, 120); flash(); }
  const mixer = c.obj.userData.mixer, clips = c.obj.userData.clips;
  const special = { liska: 'Run', robot: 'Wave' }[c.item?.id];
  if (mixer && special) {
    const clip = THREE.AnimationClip.findByName(clips, c.item.id === 'robot' ? ['Wave', 'Dance', 'Jump', 'ThumbsUp'][Math.floor(Math.random() * 4)] : special);
    if (clip) {
      mixer.stopAllAction(); mixer.clipAction(clip).reset().play();
      setTimeout(() => { if (S.current === c) { mixer.stopAllAction(); mixer.clipAction(THREE.AnimationClip.findByName(clips, c.item.anim) || clips[0]).play(); } }, 2200);
    }
  }
  if (kind === 'radio') for (let i = 0; i < 6; i++) setTimeout(() => sparkles.userData.emit(centerOf(c.obj).c, 14, 1.2, 0.3), i * 170);
  reaction = { obj: c.bounce, start: performance.now(), spin: kind === 'auto' };
}

// Frantic tapping: after a few quick taps the thing stops playing along and does something silly.
const tapTimes = [];
const SPECIALS = ['stare', 'dizzy', 'puff', 'faint', 'hide', 'sneeze', 'run'];
let specialBag = [];
const SPECIAL_INFO = {
  stare: { dur: 3.4, sound: 'hmm', say: 'Hmmm… 🤨' },
  dizzy: { dur: 2.8, sound: 'dizzy', say: 'Točí se mi hlava! 😵‍💫' },
  puff: { dur: 2.6, sound: 'puff', say: 'Já se zlobím! 😤' },
  faint: { dur: 3.2, sound: 'faint', say: 'Uf… to už je moc! 😵' },
  hide: { dur: 3.0, sound: 'hide', say: 'Já tu nejsem! 🙈' },
  sneeze: { dur: 2.4, sound: 'sneeze', say: 'Haaa… pčík! 🤧' },
  run: { dur: 3.2, sound: 'run', say: 'Chyť si mě! 😜' },
};
function tapThing(c) {
  if (!c) return;
  const now = performance.now();
  tapTimes.push(now);
  while (tapTimes.length && now - tapTimes[0] > 2200) tapTimes.shift();
  if (reaction && reaction.kind) return;               // busy being silly: ignore taps
  if (tapTimes.length >= 5) { tapTimes.length = 0; startSpecial(c); return; }
  if (reaction) return;                                  // let the hop finish instead of restarting it
  react(c);
}
function startSpecial(c, kind) {
  if (!kind) {
    if (!specialBag.length) specialBag = SPECIALS.slice().sort(() => Math.random() - 0.5);
    kind = specialBag.pop();
  }
  const info = SPECIAL_INFO[kind];
  play(info.sound);
  showBubble(info.say);
  speak(info.say.replace(/[^\p{L}\p{N}\s!?.,…]/gu, ''));
  const o = c.bounce;
  o.position.set(0, 0, 0); o.rotation.set(0, 0, 0); o.scale.setScalar(1);
  reaction = { kind, start: performance.now(), obj: o, dur: info.dur, c, mon: c.obj.userData.monster, fired: {} };
}
const once = (r, key, fn) => { if (!r.fired[key]) { r.fired[key] = true; fn(); } };

function updateReaction(now) {
  if (!reaction) return;
  const r = reaction, t = (now - r.start) / 1000, o = r.obj;
  const end = () => { o.scale.setScalar(1); o.position.set(0, 0, 0); o.rotation.set(0, 0, 0); if (r.mon) r.mon.expr = {}; reaction = null; };
  if (!r.kind) {
    if (t > 1.0) { end(); return; }
    const jump = Math.sin(Math.min(1, t * 1.6) * Math.PI);
    o.position.y = jump * 0.22;
    const squash = 1 + Math.sin(t * Math.PI * 4) * 0.08 * (1 - t);
    o.scale.set(1 / Math.sqrt(squash), squash, 1 / Math.sqrt(squash));
    if (r.spin) o.rotation.y = ease.out(t) * Math.PI * 2;
    return;
  }
  if (t > r.dur || S.current !== r.c) { end(); return; }
  const k = t / r.dur, mon = r.mon, expr = mon ? (mon.expr ||= {}) : {};
  const facing = r.c.where === 'stage' ? -spinner.rotation.y : 0; // turn to face the screen
  const head = () => centerOf(r.c.obj).c;
  switch (r.kind) {
    case 'stare': { // stops, turns to the screen, comes closer and stares for a long while
      const inK = ease.out(Math.min(1, t / 0.6)), outK = t > r.dur - 0.5 ? ease.inOut((t - r.dur + 0.5) / 0.5) : 0;
      const a = inK * (1 - outK);
      o.rotation.y = facing * a;
      o.rotation.x = 0.18 * a;
      o.scale.setScalar(1 + 0.12 * a);
      expr.eyeScale = 1 + 0.4 * a;
      expr.closed = t > 1.9 && t < 2.35; // one slow blink
      break;
    }
    case 'dizzy': {
      const d = 1 - k;
      o.rotation.y = t * 9 * d;
      o.rotation.z = Math.sin(t * 7) * 0.3 * d;
      o.rotation.x = Math.cos(t * 7) * 0.2 * d;
      expr.eyeScale = 1 + 0.2 * Math.sin(t * 12);
      if (Math.random() < 0.35) { const h = head(); h.y += 0.45; sparkles.userData.emit(h, 1, 0.4, 0.1); }
      if (t > r.dur - 0.4) o.scale.set(1.1, 0.85, 1.1);
      break;
    }
    case 'puff': {
      if (t < 1.4) { const g = ease.out(t / 1.4); o.scale.setScalar(1 + 0.5 * g + Math.sin(t * 40) * 0.015 * g); expr.eyeScale = 1 - 0.3 * g; }
      else {
        once(r, 'prrr', () => play('prrr'));
        const q = (t - 1.4) / (r.dur - 1.4);
        o.scale.setScalar(1 + 0.5 * Math.max(0, 1 - q * 4));
        o.position.y = Math.sin(Math.min(1, q * 1.5) * Math.PI) * 0.35;
        o.rotation.y = q * Math.PI * 6 * Math.max(0, 1 - q);
        expr.eyeScale = 1;
      }
      break;
    }
    case 'faint': { // falls over backwards, lies there, then springs back up
      let fall;
      if (t < 0.5) fall = ease.inOut(t / 0.5);
      else if (t < 2.3) fall = 1;
      else fall = 1 - ease.elastic(Math.min(1, (t - 2.3) / 0.9));
      o.rotation.x = -1.35 * fall;
      o.rotation.y = facing * 0.5;
      expr.closed = t > 0.4 && t < 2.3;
      break;
    }
    case 'hide': { // squashes flat, trembles, then peeks out
      let h;
      if (t < 0.25) h = 1 - 0.7 * ease.out(t / 0.25);
      else if (t < 1.9) h = 0.3 + Math.sin(t * 50) * 0.01;
      else h = 0.3 + 0.7 * ease.elastic(Math.min(1, (t - 1.9) / 1.0));
      o.scale.set(1 + (1 - h) * 0.4, h, 1 + (1 - h) * 0.4);
      expr.closed = t > 0.2 && t < 1.6;
      break;
    }
    case 'sneeze': {
      if (t < 1.05) { const a = ease.inOut(t / 1.05); o.rotation.x = -0.35 * a; o.scale.set(1, 1 + 0.12 * a, 1); expr.closed = a > 0.6; }
      else {
        const q = Math.min(1, (t - 1.05) / 0.25);
        once(r, 'burst', () => { const h = head(); h.z += 0.3; sparkles.userData.emit(h, 60, 1.6, 0.25); });
        const back = t > 1.6 ? ease.out(Math.min(1, (t - 1.6) / 0.6)) : 0;
        o.rotation.x = (-0.35 + 0.8 * ease.out(q)) * (1 - back);
        o.scale.set(1, 1 - 0.1 * (1 - back), 1);
        o.position.z = -0.1 * ease.out(q) * (1 - back);
        expr.closed = t < 1.4;
      }
      break;
    }
    case 'run': { // hops away out of reach, waits, sneaks back
      let x;
      if (t < 0.7) x = ease.out(t / 0.7);
      else if (t < 1.9) x = 1;
      else x = 1 - ease.inOut(Math.min(1, (t - 1.9) / 1.2));
      o.position.x = x * 0.9;
      const hopping = t < 0.7 || t > 1.9;
      o.position.y = hopping ? Math.abs(Math.sin(t * 14)) * 0.12 : 0;
      o.rotation.y = facing + (t < 0.7 ? 1.2 : t > 1.9 ? -1.2 : 0) * (hopping ? 1 : 0);
      if (t > 1.9) once(r, 'back', () => play('run'));
      break;
    }
  }
}

// ---------- Main loop ----------
const clock = new THREE.Clock();
let pendingSnapshot = null;
let toonT = 0;
function loop() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const now = performance.now();
  const t = now / 1000;
  for (let i = tweens.length - 1; i >= 0; i--) if (!tweens[i](now)) tweens.splice(i, 1);
  spinner.rotation.y = FREEZE ? 0 : Math.sin(t * 0.45) * 0.55;
  if (S.current) {
    const ud = S.current.obj.userData;
    if (ud.mixer) ud.mixer.update(dt);
    if (ud.mixer2) ud.mixer2.update(dt);
    if (ud.monster) { ud.monster.update(t, camera.position); if (ud.monster.doplnkyUpdate) ud.monster.doplnkyUpdate(t); }
    if (ud.float && !reaction) S.current.obj.position.y = Math.sin(t * 1.7) * 0.04;
    if (ud.ozdoba) updateOzdoba(S.current.obj, t);
  }
  if (S.second) { const ud = S.second.obj.userData; if (ud.mixer) ud.mixer.update(dt); if (ud.monster) ud.monster.update(t, camera.position); }
  updateDecor(t, dt);
  if (!FREEZE) room.userData.update(t);
  updateReaction(now);
  updateDrag(dt);
  updateFloaters(dt);
  sparkles.userData.update(dt);
  mist += (mistTarget - mist) * Math.min(1, dt * 2);
  box.userData.setMist(lidOpen ? mist : mist * 0.0);
  box.userData.update(t, dt, zapping);
  if (!S.busy) box.userData.setCharge(0.08 + 0.06 * Math.sin(t * 1.5));
  // glide the camera towards the current view
  measurePanel();
  const target = shotTarget(S.shot, now);
  const f = FREEZE || params.has('okamzite') ? 1 : 1 - Math.exp(-dt * (target.fast ? 4 : 2.5));
  camPos.lerp(target.pos, f); camLook.lerp(target.look, f);
  if (!window.__camLock) { camera.position.copy(camPos); camera.lookAt(camLook); }
  if (CARTOON && (toonT += dt) > 1) { toonT = 0; toonify(scene); } // anything added later without the cartoon look
  renderer.render(scene, camera);
  if (adaptQuality(dt)) resize();
  if (pendingSnapshot) { pendingSnapshot(); pendingSnapshot = null; }
  requestAnimationFrame(loop);
}

// Crops the monster out of the frame for the album thumbnail.
function snapshot(obj) {
  return new Promise(res => {
    pendingSnapshot = () => {
      const bb = new THREE.Box3().setFromObject(obj, false);
      const pts = [];
      for (const x of [bb.min.x, bb.max.x]) for (const y of [bb.min.y, bb.max.y]) for (const z of [bb.min.z, bb.max.z]) pts.push(new THREE.Vector3(x, y, z).project(camera));
      const W = canvas.width, H = canvas.height;
      const xs = pts.map(p => (p.x + 1) / 2 * W), ys = pts.map(p => (1 - p.y) / 2 * H);
      const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
      const side = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) * 1.2;
      const c = document.createElement('canvas'); c.width = c.height = 180;
      c.getContext('2d').drawImage(canvas, cx - side / 2, cy - side / 2, side, side, 0, 0, 180, 180);
      res(c.toDataURL('image/jpeg', 0.82));
    };
  });
}

for (const a of S.album) a.name = monsterName(rng(a.seed)); // names from the current list

const MAX_MONSTERS = 21;
async function saveToAlbum(c) {
  if (S.album.some(a => a.seed === c.monster.seed)) return true;
  if (S.album.length >= MAX_MONSTERS) {
    c.unsaved = true;
    setTimeout(() => {
      if (S.current !== c) return;
      const t = `Sbírka je plná, máš už ${MAX_MONSTERS} příšerek! Pusť jednu na svobodu a ${c.monster.name} se k nim přidá.`;
      showBubble(t); speak(t);
    }, 4500);
    return false;
  }
  const thumb = await snapshot(c.obj);
  S.album.unshift({ seed: c.monster.seed, name: c.monster.name, tint: c.monster.tint || null, gen: c.monster.gen || 1, thumb, pece: freshCare() });
  c.unsaved = false;
  while (!store.set('kk-album', S.album) && S.album.length > 1) S.album.pop();
  updateAlbumCount();
  return true;
}
function saveAlbum() { store.set('kk-album', S.album); updateAlbumCount(); }
function updateAlbumCount() { $('album-pocet').textContent = S.album.length; $('album-stav').textContent = `${S.album.length} / ${MAX_MONSTERS}`; }

// ---------- Speech ----------
function speak(text) {
  if (muted || !window.speechSynthesis) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'cs-CZ'; u.rate = 0.95; u.pitch = 1.15;
    const v = speechSynthesis.getVoices().find(v => v.lang && v.lang.startsWith('cs'));
    if (v) u.voice = v;
    speechSynthesis.speak(u);
  } catch (e) { /* no voice, no problem */ }
}

// ---------- UI ----------
const ICONS = { liska: '🦊', ryba: '🐟', kytka: '🪴', kun: '🐴', papousek: '🦜', plamenak: '🦩', cap: '🕊️', avokado: '🥑', mandarinka: '🍊', micek: '⚽',
  olivy: '🫒', jantar: '🦟', taburet: '🪑', pohovka: '🛋️', lahev: '🧴', lucerna: '🏮', kuzel: '🚧', vaza: '💐', hrnek: '☕', zidle: '🪑', bota: '👟',
  robot: '🤖', vitraz: '🪔', duhova: '💡', radio: '📻', fotak: '📷', auticko: '🚗', lednice: '🧊', lampa: '💡' };

function tile({ label, icon, img, onClick, cls = '' }) {
  const b = document.createElement('button');
  b.className = 'dlazdice ' + cls;
  if (img) {
    const i = document.createElement('img');
    i.src = img; i.alt = '';
    i.onerror = () => { i.remove(); const s = document.createElement('span'); s.className = 'ikona'; s.textContent = icon || '✨'; b.prepend(s); };
    b.append(i);
  } else if (icon) {
    const s = document.createElement('span'); s.className = 'ikona'; s.textContent = icon; b.append(s);
  }
  const n = document.createElement('span'); n.className = 'jmeno'; n.textContent = label; b.append(n);
  b.addEventListener('click', () => { initAudio(); play('tap'); onClick(b); });
  return b;
}

function tabs(navEl, active, onPick, kinds = KINDS) {
  navEl.innerHTML = '';
  for (const k of kinds) {
    const b = document.createElement('button');
    b.innerHTML = `<span class="ikona">${k.icon}</span>${k.label}`;
    if (k.id === active) b.classList.add('aktivni');
    b.addEventListener('click', () => { initAudio(); play('tap'); onPick(k.id); });
    navEl.append(b);
  }
}

const TARGET_KINDS = [...KINDS.slice(0, 3), { id: 'priserky', label: 'Příšerky', icon: '👾' }, KINDS[3]];
let srcTab = 'zive', dstTab = 'veci', chosenTarget = { surprise: true };

function renderSource() {
  tabs($('zalozky-zdroj'), srcTab, id => { srcTab = id; renderSource(); });
  const grid = $('mrizka-zdroj');
  grid.innerHTML = '';
  if (srcTab === 'fotky') {
    grid.append(tile({ label: 'Vyfotit', icon: '📸', cls: 'foto-nova', onClick: () => $('foto-vstup').click() }));
    for (const p of S.photos) grid.append(tile({ label: p.kind === 'zive' ? 'Živé' : p.kind === 'stroje' ? 'Stroj' : 'Věc', img: p.data, onClick: () => choose({ type: 'photo', photo: p }) }));
    return;
  }
  for (const it of ITEMS.filter(i => i.kind === srcTab)) {
    grid.append(tile({ label: it.name, icon: ICONS[it.id], img: `nahledy/${it.id}.webp`, onClick: () => choose({ type: 'item', item: it }) }));
  }
}

function renderTargets() {
  tabs($('zalozky-cil'), dstTab, id => { dstTab = id; renderTargets(); }, TARGET_KINDS);
  const grid = $('mrizka-cil');
  grid.innerHTML = '';
  // every target picture can be dragged onto the box: pick it and fire in one move
  grid._append ||= grid.append.bind(grid);
  grid.append = (...els) => { for (const el of els) draggableToBox(el, () => S.phase === 'closed' ? () => { delete el.dataset.pretazeno; el.click(); run(fireLaser); } : null); grid._append(...els); };
  const pickT = (src, el) => {
    chosenTarget = src;
    grid.querySelectorAll('.vybrano').forEach(x => x.classList.remove('vybrano'));
    el.classList.add('vybrano');
  };
  const sur = tile({ label: 'Překvapení', icon: '🎲', cls: 'foto-nova', onClick: el => pickT({ surprise: true }, el) });
  if (chosenTarget.surprise) sur.classList.add('vybrano');
  grid.append(sur);
  const mark = (t, same) => { if (same) t.classList.add('vybrano'); return t; };
  if (dstTab === 'priserky') {
    grid.append(tile({ label: 'Nová příšerka', icon: '👾', onClick: el => pickT({ type: 'monster', monster: newMonsterSpec() }, el) }));
    for (const a of S.album) grid.append(mark(tile({ label: a.name, img: a.thumb, onClick: el => pickT({ type: 'monster', monster: { seed: a.seed, name: a.name, tint: a.tint, gen: a.gen } }, el) }), chosenTarget.monster?.seed === a.seed));
  } else if (dstTab === 'fotky') {
    for (const p of S.photos) grid.append(mark(tile({ label: 'Fotka', img: p.data, onClick: el => pickT({ type: 'photo', photo: p }, el) }), chosenTarget.photo?.id === p.id));
  } else {
    for (const it of ITEMS.filter(i => i.kind === dstTab)) {
      if (S.current && S.current.type === 'item' && S.current.item.id === it.id) continue;
      grid.append(mark(tile({ label: it.name, icon: ICONS[it.id], img: `nahledy/${it.id}.webp`, onClick: el => pickT({ type: 'item', item: it }, el) }), chosenTarget.item?.id === it.id));
    }
  }
}

function newMonsterSpec(tint) {
  const seed = (Math.random() * 2 ** 31) >>> 0 || 7;
  return { seed, name: monsterName(rng(seed)), tint: tint || null, gen: 2 };
}
function randomTarget() {
  const pool = ITEMS.filter(i => !(S.current.type === 'item' && S.current.item.id === i.id));
  if (Math.random() < 0.25) return { type: 'monster', monster: newMonsterSpec() };
  return { type: 'item', item: pool[Math.floor(Math.random() * pool.length)] };
}
function pickTarget() {
  if (S.current.living) return { type: 'monster', monster: newMonsterSpec(S.current.type === 'photo' ? S.current.photo.color : null) };
  if (!chosenTarget || chosenTarget.surprise) return randomTarget();
  if (chosenTarget.type === 'monster' && S.current.type === 'monster' && chosenTarget.monster.seed === S.current.monster.seed) return { type: 'monster', monster: newMonsterSpec() };
  return chosenTarget;
}

// Each step of the magic: one button press, or the same step done by hand (lid gesture, dragging).
const LID_STEPS = {
  stage: async () => { await setLid(true); setPhase('stageOpen'); },
  stageOpen: async () => { await setLid(false); setPhase('stage'); },
  inside: async () => { mistTarget = 0; await setLid(false); setPhase('closed'); },
  closed: async () => { await setLid(true); setPhase('inside'); },
  done: async () => { await reveal(lastBefore); setPhase('result'); },
  result: async () => { await sinkIntoBox(); mistTarget = 0; await setLid(false); setPhase('closed'); },
};
const fireLaser = async () => {
  if (S.second) {
    const a = S.current, b = S.second;
    const k = a.type === 'item' && b.type === 'item' ? findKouzlo(a.item.id, b.item.id) : null;
    const masc = x => x.g === 'm' && (x.living || x.type === 'monster' || x.item?.id === 'robot');
    await zap(k ? { type: 'combo', id: k.id } : { type: 'monster', monster: newMonsterSpec() });
    lastBefore = { name: `${a.name} a ${low1(b.name)}`, g: masc(a) || masc(b) ? 'pm' : 'p', kouzlo: k || 'mix', dvojice: true };
    setPhase('done');
    return;
  }
  const r = await zap(pickTarget()); lastBefore = r.before; setPhase('done');
};
// Each step of the magic is one button press.
// phase: stage → stageOpen → inside → closed → (laser) → done → (open) → result

let lastBefore = null;
function action(label, fn, cls = '') { return { label, fn, cls }; }

function setPhase(p) {
  S.phase = p;
  const c = S.current;
  let title = '', main = null, extra = [], tip = '';
  $('zive-info').hidden = true;
  $('cil-volba').hidden = true;
  $('pece').hidden = p !== 'care';
  S.tapHook = p === 'care' ? (k => k === 'stroke' ? pet() : tapThing(S.current)) : null;
  $('schovka-karta').hidden = !(p === 'schovka' && S.schovka && !S.schovka.found);
  S.shot = p === 'pokoj' || p === 'schovka' ? 'pokoj' : p === 'result' ? 'hero' : ['inside', 'closed', 'done'].includes(p) ? 'box' : p === 'care' ? 'care' : 'stage';
  const entry = albumEntry(c);
  if (entry) { ageCare(entry); const mon = c.obj.userData.monster; if (mon) mon.expr = { ...(mon.expr || {}), sad: !!entry.pece.bebi || moodOf(entry).avg < 25 }; }
  const readBtn = entry && c.where === 'stage' ? action('🔤 Čtení s příšerkou', async () => openReading()) : null;
  const careBtn = entry && c.where === 'stage' ? action(`💗 Starat se o příšerku ${moodOf(entry).emoji}`, async () => setPhase('care')) : null;
  const other = action('🔄 Vybrat něco jiného', () => showPicker());
  const toRoom = c && c.where === 'stage' && srcOf(c) ? action('🏠 Dát do pokojíčku', async () => openRoom()) : null;
  const hideBtn = entry && c.where === 'stage' ? action('🙈 Schovávaná', async () => startSchovka()) : null;
  if (p === 'schovka') {
    const s = S.schovka;
    if (s.found) {
      title = `Hurá, ${rod('našla', 'našel')} jsi ji!`;
      tip = 'Má se schovat znovu?';
      main = action('🙈 Schovej se znovu', async () => startSchovka());
      extra = [action('⬅️ Zpět ke krabici', async () => endSchovka())];
    } else {
      title = `🙈 Kde je ${c.monster.name}?`;
      tip = 'Přečti vzkaz a klepni na místo, kde se schovala. Pokoj posouvej prstem.';
      renderSchovkaCard();
      main = action('🔊 Přečti mi to', async () => { readSchovka(); setPhase('schovka'); });
      extra = [action('⬅️ Konec schovávané', async () => endSchovka())];
    }
  } else if (p === 'pokoj') {
    title = '🏠 Můj pokojíček';
    const can = c && c.where === 'stage' && srcOf(c);
    const ozd = unplacedOzdoby().length;
    tip = can ? `Klepni na ✨ tam, kam to chceš postavit. Na rámeček dej fotku. Posouvej prstem do stran.`
      : ozd ? 'Klepni na ✨ a postav tam ozdobu z dárku. Klepnutím na věc v pokoji ji vrátíš před krabici.'
      : 'Klepni na věc v pokoji a postavíš ji před krabici. Na rámeček dej fotku, na poličce jsou trofeje.';
    main = action('⬅️ Zpět ke krabici', async () => { if (S.current) setPhase(S.current.where === 'box' ? (lidOpen ? 'inside' : 'closed') : 'stage'); else showPicker(); });
    showMarkers(!!can || ozd > 0);
  } else if (p === 'stage') {
    title = `${c.name} čeká před krabicí`;
    tip = 'Zatáhni víko prstem nahoru, nebo to rovnou přetáhni do krabice.';
    main = action('📦 Otevřít krabici', LID_STEPS.stage);
    extra = careBtn ? [careBtn, readBtn, hideBtn, other] : [toRoom, other].filter(Boolean);
  } else if (p === 'care') {
    const m = moodOf(entry), want = neediest(entry.pece);
    title = `${c.monster.name} ${m.text} ${m.emoji}`;
    tip = want ? `${want.want} Klepni na ${want.icon}. Můžeš ji i hladit prstem.` : 'Je spokojená! Můžeš ji hladit prstem.';
    renderCare();
    main = action('⬅️ Hotovo', async () => setPhase('stage'));
    extra = [readBtn, hideBtn, action('👗 Šatník', async () => { openWardrobe(); setPhase('care'); })];
  } else if (p === 'stageOpen') {
    title = 'Krabice je otevřená!';
    tip = 'Přetáhni to prstem do krabice.';
    main = action('⬆️ Dát do krabice', async () => { await moveCurrent('box'); setPhase('inside'); });
    extra = [other];
  } else if (p === 'inside') {
    title = S.second ? `${c.name} a ${low1(S.second.name)} jsou v krabici` : `${c.name} je v krabici`;
    tip = S.second ? 'Zavři víko a vystřel laser. Co z nich vznikne?' : 'Stáhni víko prstem dolů. Nebo přidej druhou věc a zkus tajné kouzlo!';
    main = action('🔒 Zavřít víko', LID_STEPS.inside);
    extra = [action('⬇️ Vyndat ven', async () => { dropSecond(); await moveCurrent('stage'); await setLid(false); setPhase('stage'); }),
      !S.second && ['item', 'monster', 'combo'].includes(c.type) ? action('➕ Přidat druhou věc', async () => showPicker('druha')) : null];
  } else if (p === 'closed') {
    title = S.second ? 'Co z nich vznikne?' : c.living ? `${c.name} je v krabici` : 'Na co to proměníme?';
    tip = S.second ? `${c.name} a ${low1(S.second.name)} se smíchají. Přetáhni blesk na krabici!` : c.living ? 'Přetáhni blesk na krabici!' : 'Přetáhni obrázek nebo blesk na krabici!';
    if (S.second) { /* the pair decides */ }
    else if (c.living) $('zive-info').hidden = false;
    else { $('cil-volba').hidden = false; renderTargets(); }
    main = action('⚡ LASER! ⚡', fireLaser, 'laser');
    extra = [action('📦 Otevřít', LID_STEPS.closed)];
  } else if (p === 'done') {
    title = 'Hotovo! Co je uvnitř?';
    tip = 'Zatáhni víko nahoru!';
    main = action('📦 Otevřít krabici', LID_STEPS.done, 'laser');
  } else if (p === 'result') {
    title = `Tadá! ${c.name}`;
    tip = 'Můžeš to vytáhnout ven, nebo stáhnout víko a kouzlit znovu.';
    main = action('✨ Zavřít a proměnit znovu', LID_STEPS.result);
    extra = [action('⬇️ Vyndat ven', async () => { mistTarget = 0; await moveCurrent('stage'); await setLid(false); setPhase('stage'); }), other];
    if (c.type === 'monster' && S.album.length >= MAX_MONSTERS && !albumEntry(c)) extra.push(action('🕊️ Udělat místo ve sbírce', async () => { releasing = true; renderAlbum(); $('album').hidden = false; setPhase('result'); }));
  }
  $('akce-nadpis').textContent = title;
  $('akce-tip').textContent = tip;
  $('akce-tip').hidden = !tip;
  const mb = $('btn-hlavni');
  mb.textContent = main.label;
  mb.className = 'velke hlavni ' + main.cls;
  mb.onclick = () => run(main.fn);
  mbDrop = p === 'closed' ? () => run(fireLaser) : null;
  const row = $('akce-dalsi');
  row.innerHTML = '';
  if (p !== 'pokoj') showMarkers(false);
  for (const a of extra.filter(Boolean)) {
    const b = document.createElement('button');
    b.className = 'druhe-tl';
    b.textContent = a.label;
    b.onclick = () => run(a.fn);
    row.append(b);
  }
  showStep('akce');
}

async function run(fn, { silent = false } = {}) {
  if (S.busy) return;
  initAudio();
  if (!silent) play('tap');
  S.busy = true;
  hidePanel(true);
  hideBubble();
  try { await fn(); } finally { S.busy = false; }
}

// Dragging a button or picture from the panel onto the box (fires the laser).
let mbDrop = null;
function overBoxOnScreen(x, y) {
  pointer.set((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  return raycaster.intersectObject(box, true).length > 0;
}
function draggableToBox(el, getDrop) {
  let st = null;
  el.addEventListener('pointerdown', e => {
    if (S.busy || !getDrop()) return;
    st = { x: e.clientX, y: e.clientY, ghost: null, id: e.pointerId };
    try { el.setPointerCapture(e.pointerId); } catch (_) { /* fine */ }
  });
  el.addEventListener('pointermove', e => {
    if (!st || e.pointerId !== st.id) return;
    if (!st.ghost) {
      if (Math.hypot(e.clientX - st.x, e.clientY - st.y) < 14) return;
      initAudio();
      play('whoosh');
      const r = el.getBoundingClientRect();
      const g = el.cloneNode(true);
      g.className = el.className + ' duch';
      g.removeAttribute('id');
      if (el.id === 'btn-hlavni') { g.textContent = '⚡'; g.style.fontSize = '54px'; g.style.padding = '0'; }
      g.style.width = Math.min(r.width, 110) + 'px';
      g.style.height = Math.min(r.height, 110) + 'px';
      document.body.append(g);
      st.ghost = g;
    }
    st.ghost.style.left = e.clientX + 'px';
    st.ghost.style.top = e.clientY + 'px';
    const over = overBoxOnScreen(e.clientX, e.clientY);
    st.ghost.classList.toggle('nad', over);
    box.userData.setCharge(over ? 0.6 : 0.1);
  });
  const end = e => {
    if (!st || e.pointerId !== st.id) return;
    const s = st; st = null;
    if (!s.ghost) return;
    s.ghost.remove();
    el.dataset.pretazeno = '1'; // swallow the click that follows the drag
    setTimeout(() => delete el.dataset.pretazeno, 50);
    const drop = getDrop();
    if (drop && overBoxOnScreen(e.clientX, e.clientY)) drop(); else play('boing');
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
  el.addEventListener('click', e => { if (el.dataset.pretazeno) { e.stopImmediatePropagation(); e.preventDefault(); } }, true);
}
draggableToBox($('btn-hlavni'), () => mbDrop);

// The picker leaves the scene as it is, so the child can change their mind and go back.
let pickerBack = null, pickerMode = null;
async function showPicker(mode = null) {
  pickerMode = mode;
  $('vyber-nadpis').textContent = mode === 'druha' ? 'Co přidáme do krabice?' : 'Co dáme před krabici?';
  $('vyber-nadpis').classList.toggle('druha', mode === 'druha');
  pickerBack = S.current ? S.phase : null;
  $('vyber-zpet').hidden = !pickerBack;
  if (S.shot === 'pokoj' || S.shot === 'care') S.shot = 'stage';
  showStep('vyber');
}
$('vyber-zpet').addEventListener('click', () => { pickerMode = null; if (pickerBack && S.current) setPhase(pickerBack); pickerBack = null; });

async function choose(src) {
  if (S.busy) return;
  if (pickerMode === 'druha' && S.current && S.current.where === 'box') { pickerMode = null; return addSecond(src); }
  pickerMode = null;
  S.schovka = null;
  S.busy = true;
  hidePanel(true);
  try {
    if (S.current && S.current.where === 'box') { mistTarget = 0; await removeCurrent(); }
    if (lidOpen) await setLid(false);
    S.shot = 'stage';
    await putOnStage(src);
  } finally { S.busy = false; }
  chosenTarget = { surprise: true };
  setPhase('stage');
  const entry = albumEntry(S.current), want = entry && neediest(entry.pece);
  if (want) { const t = `${S.current.monster.name}: ${want.want}`; showBubble(t + ' ' + want.icon); speak(t); }
  else speak(S.current.name);
}

function showStep(which) {
  for (const s of ['vyber', 'akce', 'cteni']) $('krok-' + s).hidden = s !== which;
  if (which === 'vyber') renderSource();
  hidePanel(false);
}
function hidePanel(h) { $('panel').classList.toggle('schovany', h); }
let bubbleTimer = 0;
function showBubble(text) {
  const b = $('bublina');
  b.textContent = text; b.hidden = false;
  b.style.animation = 'none'; void b.offsetWidth; b.style.animation = '';
  clearTimeout(bubbleTimer);
  bubbleTimer = setTimeout(hideBubble, 5000);
}
function hideBubble() { $('bublina').hidden = true; }

$('btn-zvuk').addEventListener('click', () => {
  initAudio();
  setMuted(!muted);
  $('btn-zvuk').textContent = muted ? '🔇' : '🔊';
  store.set('kk-ticho', muted);
  if (muted && window.speechSynthesis) speechSynthesis.cancel();
});
if (store.get('kk-ticho', false)) { setMuted(true); $('btn-zvuk').textContent = '🔇'; }

$('btn-album').addEventListener('click', () => { initAudio(); play('tap'); renderAlbumTabs(); $('album').hidden = false; });
$('album-zavrit').addEventListener('click', () => { $('album').hidden = true; });
$('album').addEventListener('click', e => { if (e.target.id === 'album') $('album').hidden = true; });
let releasing = false;
$('album-pustit').addEventListener('click', () => { play('tap'); releasing = !releasing; renderAlbum(); });
function renderAlbum() {
  const grid = $('album-mrizka');
  grid.innerHTML = '';
  $('album').classList.toggle('pousteni', releasing);
  $('album-pustit').textContent = releasing ? '✅ Hotovo' : '🕊️ Pustit příšerku na svobodu';
  $('album-napoveda').textContent = releasing ? 'Klepni na příšerku, kterou chceš pustit na svobodu.' : 'Klepni na příšerku a postav ji před krabici. Můžeš se o ni starat!';
  $('album-pustit').hidden = !S.album.length;
  if (!S.album.length) { grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;opacity:.8">Zatím tu nic není. Dej do krabice něco živého!</p>'; return; }
  for (const a of S.album) {
    ageCare(a);
    grid.append(tile({ label: `${a.name} ${moodOf(a).emoji}`, img: a.thumb, onClick: () => {
      if (releasing) {
        if (!confirm(`Opravdu pustit příšerku ${a.name} na svobodu? Už se nevrátí.`)) return;
        S.album = S.album.filter(x => x !== a);
        saveAlbum();
        takeFromRoom(a.seed);
        play('poof');
        speak(`Ahoj, ${a.name}! Ať se ti daří!`);
        if (S.current && S.current.type === 'monster' && S.current.monster.seed === a.seed) S.current.unsaved = true;
        // a monster waiting for a free place joins now
        if (S.current && S.current.type === 'monster' && S.current.unsaved && S.current.monster.seed !== a.seed) saveToAlbum(S.current).then(ok => ok && showBubble(`${S.current.monster.name} je teď ve sbírce! 💜`));
        if (!S.album.length) releasing = false;
        renderAlbum();
        return;
      }
      $('album').hidden = true;
      choose({ type: 'monster', monster: { seed: a.seed, name: a.name, tint: a.tint, gen: a.gen } });
    } }));
  }
  saveAlbum();
}

// ---------- Updates ----------
// The app asks GitHub for the newest release; if it is newer, a button offers to download it.
const REPO = 'Koprfkingl/kouzelna-krabice';
const newer = (a, b) => { const pa = a.split('.').map(Number), pb = b.split('.').map(Number); for (let i = 0; i < 3; i++) { if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0); } return false; };
async function checkForUpdate() {
  const native = window.Capacitor?.isNativePlatform?.();
  if (!native && !params.has('aktualizace')) return;
  try {
    const r = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers: { Accept: 'application/vnd.github+json' } });
    if (!r.ok) return;
    const rel = await r.json();
    const v = (rel.tag_name || '').replace(/^v/, '');
    const apk = (rel.assets || []).find(a => a.name.endsWith('.apk'));
    if (!apk || !newer(v, VERZE)) return;
    const b = $('btn-aktualizace');
    b.textContent = `🎁 Nová verze ${v}`;
    b.hidden = false;
    b.onclick = () => { $('aktualizace-text').textContent = `Je tu nová verze ${v} (teď máš ${VERZE}). Stáhne se a pak ji v telefonu potvrď k instalaci.`; $('aktualizace').hidden = false; };
    $('aktualizace-ano').onclick = () => { $('aktualizace').hidden = true; window.location.href = apk.browser_download_url; };
  } catch (e) { /* offline: try next time */ }
}
$('aktualizace-ne').addEventListener('click', () => { $('aktualizace').hidden = true; });

// ---------- Start ----------
manager.onProgress = (url, done, total) => { loadBar.style.width = Math.round(done / total * 60) + '%'; };

async function placeProps() {
  // Real furniture and toys from the catalog decorate the room.
  await Promise.all(room.userData.props.map(async p => {
    try {
      const it = byId(p.id);
      // background furniture uses simplified models (a fraction of the triangles)
      const g = await buildItem({ ...it, file: 'pokoj/' + it.file, size: p.size, rot: p.rot, float: 0, anim: null });
      g.position.copy(p.pos);
      room.add(g);
      if (p.id === 'kytka') room.userData.swaying.push(g);
      if (p.spot) {
        g.updateMatrixWorld(true);
        const bb = new THREE.Box3().setFromObject(g, true);
        room.userData.spots.push({ id: p.spot.id, pos: new THREE.Vector3(p.pos.x, bb.max.y - 0.03, p.pos.z), size: p.spot.size, rot: 0.3 });
      }
    } catch (e) { /* a missing prop is not a problem */ }
  }));
}

async function start() {
  resize();
  snapCamera();
  updateAlbumCount();
  hidePanel(true);
  $('verze').textContent = 'v' + VERZE;
  const first = byId('liska');
  await Promise.all([placeProps(), loadItemGltf(first), new Promise(r => { manager.onLoad = r; setTimeout(r, 8000); })]);
  loadBar.style.width = '80%';
  if (CARTOON) { cartoonLights(scene, renderer); toonify(scene); } else await captureRoomReflections();
  buildTrophies();
  restoreRoom();
  renderDenBtn();
  requestAnimationFrame(loop);
  await putOnStage({ type: 'item', item: first }, { appear: false });
  loadBar.style.width = '100%';
  for (const it of ITEMS) loadItemGltf(it).catch(() => {});
  // celebration emoji: draw and upload their textures now, not in the middle of the big moment
  for (const ch of ['⭐', '✨', '🎉', '💫', '💖', 'Z', '🏅']) { emojiTexCache[ch] ||= canvasTexture(ch); renderer.initTexture(emojiTexCache[ch]); }
  checkForUpdate();

  if (params.has('nahledy')) { window.__kk = { ITEMS, putOnStage, spinner, camera, renderer, resize }; $('nacitani').classList.add('pryc'); return; }
  if (params.has('demo')) { window.__kk = { readRound, choose, putOnStage, current: () => S.current, ITEMS, newMonsterSpec, setPhase, phase: () => S.phase, startSpecial, album: () => S.album, openRoom, startSchovka, schovka: () => S.schovka, dayEvent, den: () => den, openDen, kniha: () => kniha, second: () => S.second, LID_STEPS, fireLaser, showPicker, setStars: n => { S.stars = n; }, room, decor: () => decor, placeInRoom, spots: () => room.userData.spots, setAlbum: a => { S.album = a; saveAlbum(); }, renderer, scene, camera, box,
    screen: which => { const v = (which === 'box' ? box.localToWorld(new THREE.Vector3(0, 0.9, 0)) : centerOf(S.current.obj).c).project(camera); return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]; } }; }

  $('start').hidden = false;
  $('start').addEventListener('click', () => {
    initAudio();
    play('poof');
    $('nacitani').classList.add('pryc');
    const go = () => { speak(`Ahoj ${vokativ(hrac.jmeno)}! Tohle je kouzelná krabice. Otevři ji, dej dovnitř, co chceš, a laser to promění!`); setPhase('stage'); };
    if (known()) go(); else askName(go);
  }, { once: true });
}
// Player name: asked once at the start (skipping keeps Maruška), changeable from the parents' overview.
function askName(done) {
  const w = $('jmeno'), inp = $('jmeno-vstup');
  let kluk = hrac.kluk;
  inp.value = known() ? hrac.jmeno : '';
  const mark = () => w.querySelectorAll('[data-kluk]').forEach(b => b.classList.toggle('vybrano', (b.dataset.kluk === '1') === kluk));
  w.querySelectorAll('[data-kluk]').forEach(b => { b.onclick = () => { kluk = b.dataset.kluk === '1'; mark(); play('place'); }; });
  mark();
  const close = jmeno => { setHrac({ jmeno, kluk }); w.hidden = true; inp.blur(); done && done(); };
  $('jmeno-ok').onclick = () => close(inp.value);
  $('jmeno-preskocit').onclick = () => close(known() ? hrac.jmeno : '');
  inp.onkeydown = e => { if (e.key === 'Enter') close(inp.value); };
  w.hidden = false;
}
$('prehled-jmeno').addEventListener('click', () => { $('prehled').hidden = true; askName(() => { if (S.phase === 'cteni') renderRank(); }); });

start();

export { ICONS, buildFor, choose, hideBubble, hidePanel, raycaster, removeCurrent, renderAlbum, resize, run, saveAlbum, setPhase,
  setPointer, showBubble, showStep, speak, start, tabs, tapThing, tile };
