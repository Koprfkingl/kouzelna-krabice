import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

import { ITEMS, KINDS, byId, proměnil, monsterName } from './catalog.js';
import { makeMonster, rng } from './monster.js';
import { makeBox, makeSparkles } from './box.js';
import { makeRoom } from './room.js';
import { VERZE } from './verze.js';
import { prepareDissolve } from './dissolve.js';
import { newRound, afterResult, syllableHTML, statKey, hodnost, dalsiHodnost } from './cteni.js';
import { DOPLNKY, wear, byIdD } from './doplnky.js';
import { initAudio, play, setMuted, muted } from './audio.js';

const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const FREEZE = params.has('nahledy');
const SLOW = Number(params.get('pomalu')) || 1; // for testing on slow machines

// ---------- Renderer & scene ----------
const canvas = $('scena');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: params.has('nahledy') });
// Phones have very dense screens; drawing every physical pixel makes the game stutter.
// Start at a moderate resolution and lower it further if frames take too long (see adaptQuality).
const MOBILE = /Android|iPhone|iPad/i.test(navigator.userAgent);
const DPR_STEPS = [Math.min(window.devicePixelRatio, 1.5), 1.25, 1.0, 0.8].filter((v, i, a) => i === 0 || v < a[0]);
let dprStep = 0;
renderer.setPixelRatio(DPR_STEPS[0]);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 40);
// Lights: a warm key light with shadows; the room itself gives soft light and reflections.
const KEY = 2.0;
const key = new THREE.DirectionalLight(0xfff1dc, KEY);
key.position.set(2.2, 4, 2.4);
key.castShadow = true;
key.shadow.mapSize.set(1024, 1024);
key.shadow.camera.left = -3.4; key.shadow.camera.right = 3.4; key.shadow.camera.top = 3.4; key.shadow.camera.bottom = -3.4;
key.shadow.camera.near = 1; key.shadow.camera.far = 10;
key.shadow.bias = -0.0006; key.shadow.normalBias = 0.02;
scene.add(key);
const rim = new THREE.DirectionalLight(0xb48cff, 0.5);
rim.position.set(-3, 2.5, -2);
scene.add(rim);

// ---------- Loading ----------
const manager = new THREE.LoadingManager();
const ENV_INTENSITY = 0.85;
const loadBar = $('nacitani-bar');
const texLoader = new THREE.TextureLoader(manager);
const gltfLoader = new GLTFLoader();

function loadTex(url, srgb) {
  const t = texLoader.load(url);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return t;
}
const wood = { wood: loadTex('textury/hardwood2_diffuse.jpg', true), woodRough: loadTex('textury/hardwood2_roughness.jpg'), woodBump: loadTex('textury/hardwood2_bump.jpg') };

// The child's room. Its own reflections come from a snapshot of the room (see captureRoomReflections),
// stored in 8-bit textures because float textures overflowed on phone GPUs.
scene.background = new THREE.Color(0xf3e9f2);
const fill = new THREE.HemisphereLight(0xfff6ee, 0x8a6a55, 0.5);
scene.add(fill);
const room = makeRoom(wood);
scene.add(room);

const box = makeBox(wood);
box.position.set(0, 0, -1.05);
scene.add(box);
const boxSlot = new THREE.Group(); // where things sit inside the box
box.userData.inside.add(boxSlot);

// Turntable stage in front of the box
const stage = new THREE.Group();
stage.position.set(0, 0, 0.55);
scene.add(stage);
const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.62, 0.06, 96),
  new THREE.MeshPhysicalMaterial({ color: 0x2a1442, roughness: 0.9, sheen: 0.8, sheenColor: 0x8a5cc8, sheenRoughness: 0.5 }));
plate.position.y = 0.03; plate.receiveShadow = true; plate.castShadow = true;
const plateRing = new THREE.Mesh(new THREE.TorusGeometry(0.605, 0.022, 16, 128), new THREE.MeshPhysicalMaterial({ color: 0xd9a84e, metalness: 1, roughness: 0.25 }));
plateRing.rotation.x = Math.PI / 2; plateRing.position.y = 0.06; plateRing.castShadow = true;
stage.add(plate, plateRing);
const spinner = new THREE.Group();
spinner.position.y = 0.06;
stage.add(spinner);

const sparkles = makeSparkles(500);
scene.add(sparkles);

async function captureRoomReflections() {
  const rt = new THREE.WebGLCubeRenderTarget(256, { type: THREE.UnsignedByteType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
  const cam = new THREE.CubeCamera(0.05, 30, rt);
  cam.position.set(0, 1.1, -0.2);
  const hidden = [box, stage, sparkles];
  for (const o of hidden) o.visible = false;
  cam.update(renderer, scene);
  for (const o of hidden) o.visible = true;
  scene.environment = rt.texture;
  scene.environmentIntensity = ENV_INTENSITY;
}

// ---------- Building things ----------
const gltfCache = {};
function loadItemGltf(item) {
  if (!gltfCache[item.file]) {
    gltfCache[item.file] = new Promise((res, rej) => gltfLoader.load(`modely/${item.file}.glb`, res, undefined, rej));
  }
  return gltfCache[item.file];
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

function buildMonster(m) { return makeMonster(m.seed, { tint: m.tint, size: 0.82, gen: m.gen || 1 }); }

function describe(src) {
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
async function buildFor(src) {
  const obj = src.type === 'item' ? await buildItem(src.item) : src.type === 'photo' ? await buildPhoto(src.photo) : buildMonster(src.monster);
  if (src.type === 'monster') { const e = album.find(a => a.seed === src.monster.seed); if (e && e.doplnky && e.doplnky.length) wear(obj, e.doplnky); }
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
  return { ...src, ...describe(src), obj, bounce, holder, dis, fit, show, where: 'stage' };
}

// ---------- Small animation helpers ----------
const tweens = [];
function animate(duration, fn) {
  return new Promise(res => {
    const start = performance.now();
    tweens.push(now => {
      const k = Math.min(1, (now - start) / (duration * 1000 * SLOW));
      fn(k);
      if (k >= 1) { res(); return false; }
      return true;
    });
  });
}
const ease = { out: k => 1 - Math.pow(1 - k, 3), inOut: k => k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2,
  elastic: k => k === 0 || k === 1 ? k : Math.pow(2, -10 * k) * Math.sin((k * 10 - 0.75) * (2 * Math.PI) / 3) + 1 };
const wait = s => new Promise(r => setTimeout(r, s * 1000 * SLOW));

function disposeObj(o) {
  o.traverse(c => {
    if (c.isMesh) for (const m of Array.isArray(c.material) ? c.material : [c.material]) m.dispose();
  });
}
function centerOf(obj) {
  const bb = new THREE.Box3().setFromObject(obj, false);
  if (bb.isEmpty()) return { c: obj.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.3, 0)), s: new THREE.Vector3(0.6, 0.6, 0.6) };
  return { c: bb.getCenter(new THREE.Vector3()), s: bb.getSize(new THREE.Vector3()) };
}

// ---------- The thing, the box and its lid ----------
let current = null;   // what is on stage or in the box
let lidOpen = false;
let mistTarget = 0, mist = 0;
let busy = false;
let zapping = false;

async function removeCurrent(fast = false) {
  if (!current) return;
  const c = current;
  current = null;
  if (!fast) await animate(0.45, k => { c.dis.uDis.value = k; });
  c.holder.removeFromParent();
  disposeObj(c.holder);
}

async function putOnStage(src, { appear = true } = {}) {
  const next = await buildFor(src);
  await removeCurrent(!appear);
  current = next;
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
  const c = current;
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
  const before = current;
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
  current = next;
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
  const c = current;
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
  const c = current;
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
  shot = 'hero'; startHero(c);
  await animate(1.1, k => {
    const e = ease.out(k);
    c.holder.position.y = 0.05 + (RISE - 0.05) * e + Math.sin(k * Math.PI) * 0.15;
    c.holder.scale.setScalar(c.fit + (c.show - c.fit) * e);
  });
  c.raised = true;
  play('place');
  // a little celebration around the new creation
  { const { c: ctr, s: sz } = centerOf(c.obj); for (const ch of ['⭐', '✨', '🎉', '💫']) floatUp(ch, ctr.clone().add(new THREE.Vector3(0, sz.y * 0.3, 0)), { n: 3, spread: sz.x * 1.6, rise: 0.7, life: 2.2, size: 0.16 }); sparkles.userData.emit(ctr, 80, 1.4, 0.4); }
  const sentence = `${before.name} ${proměnil(before.g)} na ${c.acc}!`;
  showBubble('✨ ' + sentence + ' ✨');
  speak(sentence);
  // the album picture needs a read-back of the screen, which stalls a frame: do it once the camera swoop has settled
  if (c.type === 'monster') { play('giggle'); setTimeout(() => { if (current === c) saveToAlbum(c); }, 3600); setTimeout(() => { mistTarget = 0.35; }, 1500); }
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
let shot = 'stage';
const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
const hero = { start: 0 };
function heroTarget(now) {
  const c = current;
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
function snapCamera() { const t = shotTarget(shot); camPos.copy(t.pos); camLook.copy(t.look); }

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
let tapHook = null; // care mode listens to taps and strokes on the monster

// The lid follows a finger: pull it up to open, push it down to close.
let lidDrag = null;
const LID_OPENING = ['stage', 'closed', 'done'], LID_CLOSING = ['stageOpen', 'inside', 'result'];
function startLidDrag(e) {
  const opening = LID_OPENING.includes(phase);
  if (!opening && !LID_CLOSING.includes(phase)) return false;
  lidDrag = { y0: e.clientY, k0: lidK, opening, moved: false, id: e.pointerId, phase };
  canvas.setPointerCapture(e.pointerId);
  return true;
}
canvas.addEventListener('pointermove', e => {
  if (!lidDrag || e.pointerId !== lidDrag.id) return;
  const dy = lidDrag.y0 - e.clientY;
  if (!lidDrag.moved) {
    if (Math.abs(dy) < 10) return;
    lidDrag.moved = true;
    busy = true;
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
  busy = false;
  if (open === lidOpen) { // changed its mind: the lid swings back
    run(async () => { await d.sink; await setLid(open); }, { silent: true }).then(() => setPhase(phase));
    return;
  }
  run(async () => { await d.sink; await LID_STEPS[d.phase](); });
};
canvas.addEventListener('pointerup', endLidDrag);
canvas.addEventListener('pointercancel', endLidDrag);
canvas.addEventListener('lostpointercapture', endLidDrag);

canvas.addEventListener('pointerdown', e => {
  initAudio();
  if (busy || !current || drag || lidDrag) return;
  setPointer(e);
  if (!raycaster.intersectObject(current.holder, true).length) {
    if (raycaster.intersectObject(box, true).length) startLidDrag(e);
    return;
  }
  const fromStage = current.where === 'stage' && (phase === 'stage' || phase === 'stageOpen');
  const fromBox = current.where === 'box' && lidOpen && (phase === 'inside' || phase === 'result');
  drag = { x: e.clientX, y: e.clientY, moved: false, canDrag: fromStage || fromBox, origin: fromBox ? 'box' : 'stage', id: e.pointerId, strokes: 0 };
  canvas.setPointerCapture(e.pointerId);
});

canvas.addEventListener('pointermove', e => {
  if (!drag || e.pointerId !== drag.id) return;
  if (!drag.canDrag) {
    // not draggable now: moving a finger over it counts as stroking (care mode)
    if (tapHook && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 25) { drag.x = e.clientX; drag.y = e.clientY; drag.moved = true; tapHook('stroke'); }
    return;
  }
  if (!drag.moved) {
    if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 12) return;
    drag.moved = true;
    busy = true;
    hidePanel(true);
    hideBubble();
    if (shot === 'hero') shot = 'box'; // don't let the camera chase the finger
    scene.attach(current.holder);
    drag.pos = current.holder.position.clone();
    drag.scale = current.holder.scale.x;
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
    drag.scale = current.fit;
  } else {
    drag.pos.set(p.x, p.y - 0.35, p.z);
    drag.scale = 1;
  }
  box.userData.setInnerLight(near || lidOpen ? 1 : 0);
  if (Math.random() < 0.3) sparkles.userData.emit(current.holder.getWorldPosition(new THREE.Vector3()), 1, 0.4, 0.15);
});

// Called every frame: the carried thing glides after the finger (smooth even when touch events are sparse).
function updateDrag(dt) {
  if (!drag || !drag.moved || !drag.pos || !current) return;
  const h = current.holder, f = 1 - Math.exp(-dt * 14);
  h.position.lerp(drag.pos, f);
  h.scale.setScalar(THREE.MathUtils.lerp(h.scale.x, drag.scale, f));
}

const endDrag = e => {
  if (!drag || e.pointerId !== drag.id) return;
  const d = drag;
  drag = null;
  if (!d.moved) { if (tapHook) tapHook('tap'); else tapThing(current); return; }
  if (!d.canDrag) return;
  const c = current;
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
        busy = false;
        setPhase(d.origin === 'box' ? phase : 'inside');
      } else {
        // Dropped elsewhere: it lands on the stage (taken out of the box, or back where it was).
        const to = spinner.getWorldPosition(new THREE.Vector3()), from = c.holder.position.clone(), s0 = c.holder.scale.x;
        await animate(0.45, k => { c.holder.position.lerpVectors(from, to, ease.inOut(k)); c.holder.position.y += Math.sin(k * Math.PI) * 0.2; c.holder.scale.setScalar(s0 + (1 - s0) * k); });
        spinner.add(c.holder);
        c.holder.position.set(0, 0, 0); c.holder.rotation.set(0, 0, 0); c.holder.scale.setScalar(1);
        c.where = 'stage'; c.raised = false;
        play('boing');
        if (d.origin === 'box') { mistTarget = 0; await setLid(false); busy = false; setPhase('stage'); }
        else {
          if (d.openedLid && phase === 'stage') await setLid(false);
          else if (!lidOpen) box.userData.setInnerLight(0);
          busy = false;
          setPhase(phase);
        }
      }
    } finally { busy = false; }
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
      setTimeout(() => { if (current === c) { mixer.stopAllAction(); mixer.clipAction(THREE.AnimationClip.findByName(clips, c.item.anim) || clips[0]).play(); } }, 2200);
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
  if (t > r.dur || current !== r.c) { end(); return; }
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
function loop() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const now = performance.now();
  const t = now / 1000;
  for (let i = tweens.length - 1; i >= 0; i--) if (!tweens[i](now)) tweens.splice(i, 1);
  spinner.rotation.y = FREEZE ? 0 : Math.sin(t * 0.45) * 0.55;
  if (current) {
    const ud = current.obj.userData;
    if (ud.mixer) ud.mixer.update(dt);
    if (ud.monster) { ud.monster.update(t, camera.position); if (ud.monster.doplnkyUpdate) ud.monster.doplnkyUpdate(t); }
    if (ud.float && !reaction) current.obj.position.y = Math.sin(t * 1.7) * 0.04;
  }
  updateReaction(now);
  updateDrag(dt);
  updateFloaters(dt);
  sparkles.userData.update(dt);
  mist += (mistTarget - mist) * Math.min(1, dt * 2);
  box.userData.setMist(lidOpen ? mist : mist * 0.0);
  box.userData.update(t, dt, zapping);
  if (!busy) box.userData.setCharge(0.08 + 0.06 * Math.sin(t * 1.5));
  // glide the camera towards the current view
  measurePanel();
  const target = shotTarget(shot, now);
  const f = FREEZE || params.has('okamzite') ? 1 : 1 - Math.exp(-dt * (target.fast ? 4 : 2.5));
  camPos.lerp(target.pos, f); camLook.lerp(target.look, f);
  if (!window.__camLock) { camera.position.copy(camPos); camera.lookAt(camLook); }
  renderer.render(scene, camera);
  adaptQuality(dt);
  if (pendingSnapshot) { pendingSnapshot(); pendingSnapshot = null; }
  requestAnimationFrame(loop);
}

// If the phone can't keep up, draw fewer pixels (checked every 2 seconds, only ever goes down).
let qT = 0, qFrames = 0, qSlow = 0;
function adaptQuality(dt) {
  if (FREEZE || document.hidden) return;
  qT += dt; qFrames++;
  if (qT < 1.2) return;
  const fps = qFrames / qT;
  qT = 0; qFrames = 0;
  qSlow = fps < 50 ? qSlow + 1 : 0;
  if (qSlow >= 1 && dprStep < DPR_STEPS.length - 1) {
    dprStep++;
    renderer.setPixelRatio(DPR_STEPS[dprStep]);
    resize();
    qSlow = 0;
  } else if (qSlow >= 2 && dprStep === DPR_STEPS.length - 1 && key.shadow.mapSize.x > 512) {
    key.shadow.mapSize.set(512, 512);
    key.shadow.map?.dispose(); key.shadow.map = null;
  }
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

// ---------- Saved data ----------
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
};
let album = store.get('kk-album', []);
for (const a of album) a.name = monsterName(rng(a.seed)); // names from the current list
let photos = store.get('kk-fotky', []);

const MAX_MONSTERS = 21;
async function saveToAlbum(c) {
  if (album.some(a => a.seed === c.monster.seed)) return true;
  if (album.length >= MAX_MONSTERS) {
    c.unsaved = true;
    setTimeout(() => {
      if (current !== c) return;
      const t = `Sbírka je plná, máš už ${MAX_MONSTERS} příšerek! Pusť jednu na svobodu a ${c.monster.name} se k nim přidá.`;
      showBubble(t); speak(t);
    }, 4500);
    return false;
  }
  const thumb = await snapshot(c.obj);
  album.unshift({ seed: c.monster.seed, name: c.monster.name, tint: c.monster.tint || null, gen: c.monster.gen || 1, thumb, pece: freshCare() });
  c.unsaved = false;
  while (!store.set('kk-album', album) && album.length > 1) album.pop();
  updateAlbumCount();
  return true;
}
function saveAlbum() { store.set('kk-album', album); updateAlbumCount(); }
function updateAlbumCount() { $('album-pocet').textContent = album.length; $('album-stav').textContent = `${album.length} / ${MAX_MONSTERS}`; }

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
    for (const p of photos) grid.append(tile({ label: p.kind === 'zive' ? 'Živé' : p.kind === 'stroje' ? 'Stroj' : 'Věc', img: p.data, onClick: () => choose({ type: 'photo', photo: p }) }));
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
  grid.append = (...els) => { for (const el of els) draggableToBox(el, () => phase === 'closed' ? () => { delete el.dataset.pretazeno; el.click(); run(fireLaser); } : null); grid._append(...els); };
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
    for (const a of album) grid.append(mark(tile({ label: a.name, img: a.thumb, onClick: el => pickT({ type: 'monster', monster: { seed: a.seed, name: a.name, tint: a.tint, gen: a.gen } }, el) }), chosenTarget.monster?.seed === a.seed));
  } else if (dstTab === 'fotky') {
    for (const p of photos) grid.append(mark(tile({ label: 'Fotka', img: p.data, onClick: el => pickT({ type: 'photo', photo: p }, el) }), chosenTarget.photo?.id === p.id));
  } else {
    for (const it of ITEMS.filter(i => i.kind === dstTab)) {
      if (current && current.type === 'item' && current.item.id === it.id) continue;
      grid.append(mark(tile({ label: it.name, icon: ICONS[it.id], img: `nahledy/${it.id}.webp`, onClick: el => pickT({ type: 'item', item: it }, el) }), chosenTarget.item?.id === it.id));
    }
  }
}

function newMonsterSpec(tint) {
  const seed = (Math.random() * 2 ** 31) >>> 0 || 7;
  return { seed, name: monsterName(rng(seed)), tint: tint || null, gen: 2 };
}
function randomTarget() {
  const pool = ITEMS.filter(i => !(current.type === 'item' && current.item.id === i.id));
  if (Math.random() < 0.25) return { type: 'monster', monster: newMonsterSpec() };
  return { type: 'item', item: pool[Math.floor(Math.random() * pool.length)] };
}
function pickTarget() {
  if (current.living) return { type: 'monster', monster: newMonsterSpec(current.type === 'photo' ? current.photo.color : null) };
  if (!chosenTarget || chosenTarget.surprise) return randomTarget();
  if (chosenTarget.type === 'monster' && current.type === 'monster' && chosenTarget.monster.seed === current.monster.seed) return { type: 'monster', monster: newMonsterSpec() };
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
const fireLaser = async () => { const r = await zap(pickTarget()); lastBefore = r.before; setPhase('done'); };
// Each step of the magic is one button press.
// phase: stage → stageOpen → inside → closed → (laser) → done → (open) → result
let phase = 'stage';
let lastBefore = null;
function action(label, fn, cls = '') { return { label, fn, cls }; }

function setPhase(p) {
  phase = p;
  const c = current;
  let title = '', main = null, extra = [], tip = '';
  $('zive-info').hidden = true;
  $('cil-volba').hidden = true;
  $('pece').hidden = p !== 'care';
  tapHook = p === 'care' ? (k => k === 'stroke' ? pet() : tapThing(current)) : null;
  shot = p === 'result' ? 'hero' : ['inside', 'closed', 'done'].includes(p) ? 'box' : p === 'care' ? 'care' : 'stage';
  const entry = albumEntry(c);
  if (entry) { ageCare(entry); const mon = c.obj.userData.monster; if (mon) mon.expr = { ...(mon.expr || {}), sad: !!entry.pece.bebi || moodOf(entry).avg < 25 }; }
  const readBtn = entry && c.where === 'stage' ? action('🔤 Čtení s příšerkou', async () => openReading()) : null;
  const careBtn = entry && c.where === 'stage' ? action(`💗 Starat se o příšerku ${moodOf(entry).emoji}`, async () => setPhase('care')) : null;
  const other = action('🔄 Vybrat něco jiného', () => showPicker());
  if (p === 'stage') {
    title = `${c.name} čeká před krabicí`;
    tip = 'Zatáhni víko prstem nahoru, nebo to rovnou přetáhni do krabice.';
    main = action('📦 Otevřít krabici', LID_STEPS.stage);
    extra = careBtn ? [careBtn, readBtn, other] : [other];
  } else if (p === 'care') {
    const m = moodOf(entry), want = neediest(entry.pece);
    title = `${c.monster.name} ${m.text} ${m.emoji}`;
    tip = want ? `${want.want} Klepni na ${want.icon}. Můžeš ji i hladit prstem.` : 'Je spokojená! Můžeš ji hladit prstem.';
    renderCare();
    main = action('⬅️ Hotovo', async () => setPhase('stage'));
    extra = [readBtn, action('👗 Šatník', async () => { openWardrobe(); setPhase('care'); })];
  } else if (p === 'stageOpen') {
    title = 'Krabice je otevřená!';
    tip = 'Přetáhni to prstem do krabice.';
    main = action('⬆️ Dát do krabice', async () => { await moveCurrent('box'); setPhase('inside'); });
    extra = [other];
  } else if (p === 'inside') {
    title = `${c.name} je v krabici`;
    tip = 'Stáhni víko prstem dolů. Nebo to vytáhni ven.';
    main = action('🔒 Zavřít víko', LID_STEPS.inside);
    extra = [action('⬇️ Vyndat ven', async () => { await moveCurrent('stage'); await setLid(false); setPhase('stage'); })];
  } else if (p === 'closed') {
    title = c.living ? `${c.name} je v krabici` : 'Na co to proměníme?';
    tip = c.living ? 'Přetáhni blesk na krabici!' : 'Přetáhni obrázek nebo blesk na krabici!';
    if (c.living) $('zive-info').hidden = false;
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
    if (c.type === 'monster' && album.length >= MAX_MONSTERS && !albumEntry(c)) extra.push(action('🕊️ Udělat místo ve sbírce', async () => { releasing = true; renderAlbum(); $('album').hidden = false; setPhase('result'); }));
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
  for (const a of extra) {
    const b = document.createElement('button');
    b.className = 'druhe-tl';
    b.textContent = a.label;
    b.onclick = () => run(a.fn);
    row.append(b);
  }
  showStep('akce');
}

async function run(fn, { silent = false } = {}) {
  if (busy) return;
  initAudio();
  if (!silent) play('tap');
  busy = true;
  hidePanel(true);
  hideBubble();
  try { await fn(); } finally { busy = false; }
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
    if (busy || !getDrop()) return;
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

async function showPicker() {
  // Clear the box first if something is inside.
  if (current && current.where === 'box') { mistTarget = 0; await removeCurrent(); }
  if (lidOpen) await setLid(false);
  shot = 'stage';
  showStep('vyber');
}

async function choose(src) {
  if (busy) return;
  busy = true;
  hidePanel(true);
  try {
    if (current && current.where === 'box') { mistTarget = 0; await removeCurrent(); }
    if (lidOpen) await setLid(false);
    shot = 'stage';
    await putOnStage(src);
  } finally { busy = false; }
  chosenTarget = { surprise: true };
  setPhase('stage');
  const entry = albumEntry(current), want = entry && neediest(entry.pece);
  if (want) { const t = `${current.monster.name}: ${want.want}`; showBubble(t + ' ' + want.icon); speak(t); }
  else speak(current.name);
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

$('btn-album').addEventListener('click', () => { initAudio(); play('tap'); renderAlbum(); $('album').hidden = false; });
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
  $('album-pustit').hidden = !album.length;
  if (!album.length) { grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;opacity:.8">Zatím tu nic není. Dej do krabice něco živého!</p>'; return; }
  for (const a of album) {
    ageCare(a);
    grid.append(tile({ label: `${a.name} ${moodOf(a).emoji}`, img: a.thumb, onClick: () => {
      if (releasing) {
        if (!confirm(`Opravdu pustit příšerku ${a.name} na svobodu? Už se nevrátí.`)) return;
        album = album.filter(x => x !== a);
        saveAlbum();
        play('poof');
        speak(`Ahoj, ${a.name}! Ať se ti daří!`);
        if (current && current.type === 'monster' && current.monster.seed === a.seed) current.unsaved = true;
        // a monster waiting for a free place joins now
        if (current && current.type === 'monster' && current.unsaved && current.monster.seed !== a.seed) saveToAlbum(current).then(ok => ok && showBubble(`${current.monster.name} je teď ve sbírce! 💜`));
        if (!album.length) releasing = false;
        renderAlbum();
        return;
      }
      $('album').hidden = true;
      choose({ type: 'monster', monster: { seed: a.seed, name: a.name, tint: a.tint, gen: a.gen } });
    } }));
  }
  saveAlbum();
}

// ---------- Caring for monsters ----------
const NEEDS = [
  { id: 'jidlo', icon: '🍎', label: 'Nakrmit', rate: 9, want: 'Mám hlad!' },
  { id: 'piti', icon: '🥤', label: 'Napojit', rate: 11, want: 'Mám žízeň!' },
  { id: 'spanek', icon: '😴', label: 'Uspat', rate: 6, want: 'Jsem ospalá…' },
  { id: 'mazleni', icon: '🤗', label: 'Pomazlit', rate: 8, want: 'Pomazlíš se se mnou?' },
  { id: 'hra', icon: '⚽', label: 'Hrát si', rate: 9, want: 'Nudím se! Pohraj si se mnou!' },
  { id: 'zdravi', icon: '🩹', label: 'Utěšit', rate: 0, want: 'Něco mě bolí…' },
];
const BEBI = ['bříško', 'nožička', 'ručička', 'hlavička', 'ouško', 'zoubek'];
function freshCare() { return { jidlo: 80, piti: 80, spanek: 80, mazleni: 70, hra: 70, zdravi: 100, bebi: null, cas: Date.now() }; }
// Needs go down slowly in real time; now and then a monster bumps itself and needs comforting.
function ageCare(a) {
  a.pece ||= freshCare();
  const p = a.pece, now = Date.now();
  const hours = Math.max(0, (now - (p.cas || now)) / 3.6e6);
  for (const n of NEEDS) if (n.rate) p[n.id] = Math.max(0, (p[n.id] ?? 80) - n.rate * hours);
  if (!p.bebi && Math.random() < 1 - Math.pow(0.94, hours)) { p.bebi = BEBI[Math.floor(Math.random() * BEBI.length)]; p.zdravi = 25; }
  p.cas = now;
  return p;
}
function moodOf(a) {
  const p = a.pece || freshCare();
  const avg = NEEDS.reduce((s, n) => s + (p[n.id] ?? 80), 0) / NEEDS.length;
  if (p.bebi) return { emoji: '🤕', avg, text: `má bebí, bolí ji ${p.bebi}` };
  if (avg >= 75) return { emoji: '😄', avg, text: 'má skvělou náladu' };
  if (avg >= 50) return { emoji: '🙂', avg, text: 'má dobrou náladu' };
  if (avg >= 25) return { emoji: '😕', avg, text: 'nemá moc dobrou náladu' };
  return { emoji: '😢', avg, text: 'je smutná' };
}
const albumEntry = c => c && c.type === 'monster' ? album.find(a => a.seed === c.monster.seed) : null;
function neediest(p) {
  if (p.bebi) return NEEDS[5];
  let best = null;
  for (const n of NEEDS.slice(0, 5)) if (p[n.id] < 50 && (!best || p[n.id] < p[best.id])) best = n;
  return best;
}

// little 3D props and floating emoji for the care actions
const emojiTexCache = {};
function emojiSprite(ch, size = 0.18) {
  if (!emojiTexCache[ch]) emojiTexCache[ch] = canvasTexture(ch);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: emojiTexCache[ch], transparent: true, depthWrite: false }));
  sp.scale.setScalar(size);
  return sp;
}
function canvasTexture(ch) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  g.font = '100px "Noto Color Emoji", "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  if (ch === 'Z') { g.font = '900 100px Nunito, sans-serif'; g.fillStyle = '#c9b6ff'; g.strokeStyle = '#3a1f63'; g.lineWidth = 8; g.strokeText('Z', 64, 70); }
  g.fillText(ch, 64, 70);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const floaters = [];
function floatUp(ch, from, { n = 1, spread = 0.25, rise = 0.8, life = 1.6, size = 0.18 } = {}) {
  for (let i = 0; i < n; i++) {
    const sp = emojiSprite(ch, size);
    sp.position.copy(from).add(new THREE.Vector3((Math.random() - 0.5) * spread, Math.random() * 0.1, (Math.random() - 0.5) * spread * 0.5));
    scene.add(sp);
    floaters.push({ sp, t: -i * 0.18, life, rise, x0: sp.position.x, y0: sp.position.y, ph: Math.random() * 6 });
  }
}
function updateFloaters(dt) {
  for (let i = floaters.length - 1; i >= 0; i--) {
    const f = floaters[i];
    f.t += dt;
    const k = f.t / f.life;
    f.sp.visible = f.t > 0;
    if (k >= 1) { scene.remove(f.sp); f.sp.material.dispose(); floaters.splice(i, 1); continue; }
    if (f.t <= 0) continue;
    f.sp.position.y = f.y0 + f.rise * k;
    f.sp.position.x = f.x0 + Math.sin(f.t * 3 + f.ph) * 0.06;
    f.sp.material.opacity = k < 0.15 ? k / 0.15 : 1 - Math.max(0, (k - 0.6) / 0.4);
  }
}
function mouthPoint(c) {
  const { c: ctr, s } = centerOf(c.obj);
  return ctr.clone().add(new THREE.Vector3(0, s.y * 0.02, s.z * 0.5 + 0.05));
}
function makeFood() {
  const g = new THREE.Group();
  const apple = new THREE.Mesh(new THREE.SphereGeometry(0.08, 24, 16), new THREE.MeshPhysicalMaterial({ color: 0xe8332e, roughness: 0.35, clearcoat: 0.8 }));
  apple.scale.set(1, 0.9, 1);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.008, 0.05, 6), new THREE.MeshStandardMaterial({ color: 0x5a3a1a })); stem.position.y = 0.085;
  const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.025, 10, 6), new THREE.MeshStandardMaterial({ color: 0x4caf50 })); leaf.scale.set(1, 0.3, 0.6); leaf.position.set(0.025, 0.1, 0);
  g.add(apple, stem, leaf);
  return g;
}
function makeGlass() {
  const g = new THREE.Group();
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.16, 24, 1, true), new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.05, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }));
  const water = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.047, 0.12, 24), new THREE.MeshPhysicalMaterial({ color: 0x5ec8ff, roughness: 0.1, transparent: true, opacity: 0.8 }));
  water.position.y = -0.015;
  const straw = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.22, 8), new THREE.MeshStandardMaterial({ color: 0xff5fc8 })); straw.position.set(0.02, 0.06, 0); straw.rotation.z = -0.25;
  g.add(glass, water, straw);
  g.userData.water = water;
  return g;
}
function makeBall() {
  const tex = (() => { const c = document.createElement('canvas'); c.width = 256; c.height = 128; const x = c.getContext('2d');
    ['#ff5f6d', '#ffd36e', '#5fd4a8', '#5f8dff', '#e57bff', '#ff9f7a'].forEach((col, i) => { x.fillStyle = col; x.fillRect(i * 256 / 6, 0, 256 / 6 + 1, 128); });
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const b = new THREE.Mesh(new THREE.SphereGeometry(0.11, 32, 20), new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.3, clearcoat: 0.8 }));
  b.castShadow = true;
  return b;
}
function makePlaster() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 96;
  const g = c.getContext('2d');
  g.fillStyle = '#f2c9a0'; g.beginPath(); g.roundRect(0, 0, 256, 96, 46); g.fill();
  g.fillStyle = '#fbe3cc'; g.fillRect(88, 12, 80, 72);
  g.fillStyle = '#e8b48a'; for (let x = 20; x < 80; x += 14) for (let y = 30; y < 70; y += 14) { g.beginPath(); g.arc(x, y, 3, 0, 7); g.arc(x + 160, y, 3, 0, 7); g.fill(); }
  g.fillStyle = '#ff6b8b'; g.font = '50px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('♥', 128, 50);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.083), new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 0.8, side: THREE.DoubleSide }));
}
function startPos() { return camera.position.clone().add(new THREE.Vector3(0, -0.9, -0.6)); }
async function flyTo(obj, from, to, dur = 0.8, arc = 0.4) {
  scene.add(obj);
  await animate(dur, k => { const e = ease.inOut(k); obj.position.lerpVectors(from, to, e); obj.position.y += Math.sin(e * Math.PI) * arc; obj.rotation.y = e * 4; });
}
const hop = (o, h = 0.15, d = 0.4) => animate(d, k => { o.position.y = Math.sin(k * Math.PI) * h; const q = 1 + Math.sin(k * Math.PI * 2) * 0.06; o.scale.set(1 / Math.sqrt(q), q, 1 / Math.sqrt(q)); }).then(() => { o.position.y = 0; o.scale.setScalar(1); });

const CARE = {
  async jidlo(c) {
    const food = makeFood(), to = mouthPoint(c);
    await flyTo(food, startPos(), to);
    play('mnam');
    await animate(0.66, k => { food.scale.setScalar(1 - k); if (Math.random() < 0.3) sparkles.userData.emit(to, 2, 0.5, 0.05); });
    scene.remove(food); disposeObj(food);
    await hop(c.bounce, 0.1);
    return 'Mňam, to bylo dobré!';
  },
  async piti(c) {
    const gl = makeGlass(), to = mouthPoint(c).add(new THREE.Vector3(0.05, -0.05, 0.05));
    await flyTo(gl, startPos(), to, 0.8, 0.3);
    play('glo');
    await animate(1.0, k => { gl.userData.water.scale.y = 1 - k * 0.9; gl.userData.water.position.y = -0.015 - k * 0.054; gl.rotation.z = Math.sin(k * Math.PI) * 0.3; });
    await animate(0.4, k => { gl.scale.setScalar(1 - k); });
    scene.remove(gl); disposeObj(gl);
    return 'Ááá, to osvěží!';
  },
  async spanek(c) {
    const mon = c.obj.userData.monster;
    const k0 = key.intensity, f0 = fill.intensity, e0 = scene.environmentIntensity;
    await animate(0.8, k => { key.intensity = k0 * (1 - 0.75 * k); fill.intensity = f0 * (1 - 0.6 * k); scene.environmentIntensity = e0 * (1 - 0.6 * k); });
    if (mon) mon.expr = { ...(mon.expr || {}), sleep: true };
    const head = () => centerOf(c.obj).c.add(new THREE.Vector3(0.15, 0.3, 0));
    for (let i = 0; i < 3; i++) { play('zzz'); floatUp('Z', head(), { n: 2, size: 0.14 + i * 0.03, life: 1.6 }); await animate(1.3, k => { c.bounce.scale.set(1 + Math.sin(k * Math.PI) * 0.03, 1 - Math.sin(k * Math.PI) * 0.03, 1); }); }
    if (mon) mon.expr = { ...(mon.expr || {}), sleep: false };
    await animate(0.8, k => { key.intensity = k0 * (0.25 + 0.75 * k); fill.intensity = f0 * (0.4 + 0.6 * k); scene.environmentIntensity = e0 * (0.4 + 0.6 * k); });
    key.intensity = k0; fill.intensity = f0; scene.environmentIntensity = e0;
    await animate(0.7, k => { const s = Math.sin(k * Math.PI); c.bounce.scale.set(1 - s * 0.05, 1 + s * 0.15, 1 - s * 0.05); });
    return 'Dobré ráno! Krásně jsem se vyspala.';
  },
  async mazleni(c) {
    play('love');
    floatUp('💖', centerOf(c.obj).c.add(new THREE.Vector3(0, 0.25, 0.2)), { n: 6, spread: 0.5 });
    await animate(1.8, k => { c.bounce.rotation.z = Math.sin(k * Math.PI * 6) * 0.12 * (1 - k); });
    c.bounce.rotation.z = 0;
    return 'Mám tě moc ráda!';
  },
  async hra(c) {
    const ball = makeBall();
    const ground = c.holder.getWorldPosition(new THREE.Vector3());
    const side = ground.clone().add(new THREE.Vector3(0.75, 0.11, 0.25)), other = ground.clone().add(new THREE.Vector3(-0.75, 0.11, 0.25));
    await flyTo(ball, startPos(), side, 0.7, 0.5);
    for (let i = 0; i < 3; i++) {
      const [a, b] = i % 2 ? [other, side] : [side, other];
      play('boing');
      await Promise.all([
        animate(0.7, k => { ball.position.lerpVectors(a, b, k); ball.position.y += Math.sin(k * Math.PI) * 0.7; ball.rotation.z -= 0.2; }),
        hop(c.bounce, 0.3, 0.7),
      ]);
    }
    await animate(0.4, k => { ball.scale.setScalar(1 - k); });
    scene.remove(ball); disposeObj(ball);
    return 'Juchů, to byla zábava!';
  },
  async zdravi(c, a) {
    const p = a.pece;
    if (!p.bebi) {
      play('love');
      floatUp('💖', centerOf(c.obj).c.add(new THREE.Vector3(0, 0.25, 0.2)), { n: 3 });
      p.mazleni = Math.min(100, p.mazleni + 15);
      return 'Nic mě nebolí, ale pofoukání je stejně fajn!';
    }
    const where = p.bebi;
    const pl = makePlaster();
    const { c: ctr, s } = centerOf(c.obj);
    const to = ctr.clone().add(new THREE.Vector3(s.x * 0.18, -s.y * 0.12, s.z * 0.5 + 0.02));
    await flyTo(pl, startPos(), to, 0.7, 0.2);
    pl.rotation.set(0, 0, 0.4);
    play('bandage');
    floatUp('💖', to.clone().add(new THREE.Vector3(0, 0.1, 0)), { n: 4 });
    c.bounce.attach(pl);
    setTimeout(() => { const pm = pl.material; animate(1, k => { pm.opacity = 1 - k; }).then(() => { pl.removeFromParent(); }); }, 6000);
    p.bebi = null;
    return `Děkuju! Moje ${where} už nebolí.`;
  },
};

let careBusy = false;
async function doCare(need) {
  const c = current, a = albumEntry(c);
  if (!a || careBusy) return;
  careBusy = true;
  busy = true;
  hideBubble();
  try {
    ageCare(a);
    const say = await CARE[need.id](c, a);
    a.pece[need.id] = need.id === 'zdravi' ? 100 : Math.min(100, a.pece[need.id] + 45);
    saveAlbum();
    showBubble(say); speak(say);
  } finally { careBusy = false; busy = false; }
  if (phase === 'care') setPhase('care');
}
let lastStroke = 0;
function pet() {
  const c = current, a = albumEntry(c);
  if (!a || careBusy) return;
  const now = performance.now();
  if (now - lastStroke < 180) return;
  lastStroke = now;
  ageCare(a);
  a.pece.mazleni = Math.min(100, a.pece.mazleni + 3);
  floatUp('💖', centerOf(c.obj).c.add(new THREE.Vector3((Math.random() - 0.5) * 0.3, 0.2, 0.2)), { n: 1, size: 0.12 });
  if (Math.random() < 0.25) play('love');
  c.bounce.rotation.z = (Math.random() - 0.5) * 0.12;
  clearTimeout(pet.t); pet.t = setTimeout(() => { c.bounce.rotation.z = 0; saveAlbum(); if (phase === 'care') renderCare(); }, 600);
}
function renderCare() {
  const a = albumEntry(current), box_ = $('pece');
  box_.innerHTML = '';
  if (!a) return;
  const want = neediest(a.pece);
  for (const n of NEEDS) {
    const v = Math.round(a.pece[n.id] ?? 80);
    const t = tile({ label: n.label, icon: n.icon, onClick: () => doCare(n) });
    const bar = document.createElement('div'); bar.className = 'lista';
    bar.innerHTML = `<i style="width:${Math.max(4, v)}%;background-position:${v}% 0"></i>`;
    t.append(bar);
    if (want === n) t.classList.add('chce');
    box_.append(t);
  }
}

// Photos: shrink to a 512px square, remember the average colour for tinting monsters.
$('foto-vstup').addEventListener('change', async e => {
  const f = e.target.files && e.target.files[0];
  e.target.value = '';
  if (!f) return;
  const url = URL.createObjectURL(f);
  const img = new Image();
  img.onload = () => {
    const S = 512, c = document.createElement('canvas'); c.width = c.height = S;
    const g = c.getContext('2d');
    const side = Math.min(img.width, img.height);
    g.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, S, S);
    const data = c.toDataURL('image/jpeg', 0.8);
    const tiny = document.createElement('canvas'); tiny.width = tiny.height = 1;
    tiny.getContext('2d').drawImage(c, 0, 0, 1, 1);
    const p = tiny.getContext('2d').getImageData(0, 0, 1, 1).data;
    const color = (p[0] << 16) | (p[1] << 8) | p[2];
    URL.revokeObjectURL(url);
    askPhotoKind({ id: Date.now(), data, color });
  };
  img.src = url;
});
function askPhotoKind(photo) {
  $('foto-nahled').src = photo.data;
  $('foto-dotaz').hidden = false;
  speak('Co jsi vyfotila?');
  $('foto-dotaz').querySelectorAll('[data-druh]').forEach(b => {
    b.onclick = () => {
      play('tap');
      photo.kind = b.dataset.druh;
      photos.unshift(photo);
      photos = photos.slice(0, 16);
      while (!store.set('kk-fotky', photos) && photos.length > 1) photos.pop();
      $('foto-dotaz').hidden = true;
      choose({ type: 'photo', photo });
    };
  });
}
$('foto-zrusit').addEventListener('click', () => { $('foto-dotaz').hidden = true; });

// ---------- Reading with the monster ----------
// Systematic phonics in small steps: letter → syllable → word → a short message. Syllables are coloured
// like in a Czech first-grade reader and can be tapped to hear them. A star for every task solved on the first try.
const READ_LEVELS = [{ id: 1, label: 'Písmenka', icon: 'A' }, { id: 2, label: 'Slabiky', icon: 'MA' }, { id: 3, label: 'Slova', icon: 'PES' }, { id: 4, label: 'Vzkazy', icon: '💌' }];
let readLevel = store.get('kk-cteni-uroven', 1), readLower = store.get('kk-cteni-mala', false), stars = store.get('kk-hvezdy', 0);
let round = null, roundHelp = false, roundMiss = false, roundDone = false, spokenTask = 0;
let readStats = store.get('kk-cteni-stat', {}), readHist = store.get('kk-cteni-hist', { 1: [], 2: [], 3: [], 4: [] });
const suggested = {};
const PRAISE = ['Výborně!', 'Super!', 'Paráda!', 'Bravo!', 'Skvělé čtení!', 'Jsi šikulka!'];
const AGAIN = ['Ještě jednou!', 'Zkus to znovu.', 'Skoro! Zkus jiný.'];
const pickOne = a => a[Math.floor(Math.random() * a.length)];

function openReading() {
  phase = 'cteni';
  shot = 'care';
  tapHook = k => k === 'stroke' ? pet() : tapThing(current);
  hideBubble();
  $('pece').hidden = true;
  showStep('cteni');
  tabs($('zalozky-cteni'), readLevel, id => { readLevel = id; store.set('kk-cteni-uroven', id); spokenTask = 0; openReading(); }, READ_LEVELS);
  $('cteni-velikost').textContent = readLower ? 'ABC' : 'abc';
  renderRank();
  nextRound();
}
function renderCard() {
  const k = $('cteni-karta');
  k.classList.toggle('velke-pismeno', round.level <= 2);
  k.innerHTML = syllableHTML(round.text, readLower, round.level === 4) + (round.level === 4 ? `<span class="podpis">${current.monster.name}</span>` : '');
  k.querySelectorAll('.slabika').forEach(el => el.addEventListener('click', () => {
    initAudio();
    if (round.level <= 2) roundHelp = true; // hearing the letter itself gives the answer away
    flashSyl(el);
    speak(el.dataset.s.toLowerCase());
  }));
}
function flashSyl(el) { el.classList.add('cte'); setTimeout(() => el.classList.remove('cte'), 700); }
function nextRound() {
  if (phase !== 'cteni' || !current) return;
  round = newRound(readLevel, readStats);
  roundHelp = roundMiss = roundDone = false;
  renderCard();
  $('cteni-ukol').textContent = round.task;
  if (spokenTask !== readLevel) { spokenTask = readLevel; speak(round.task); }
  const grid = $('cteni-volby');
  grid.innerHTML = '';
  if (round.need) {
    const others = NEEDS.filter(n => n.id !== round.need).sort(() => Math.random() - 0.5).slice(0, 2);
    for (const n of [NEEDS.find(n => n.id === round.need), ...others].sort(() => Math.random() - 0.5)) {
      grid.append(tile({ label: n.label, icon: n.icon, onClick: el => answer(n.id === round.need, el, n) }));
    }
  } else {
    for (const ch of round.choices) grid.append(tile({ label: '', icon: ch.e, onClick: el => answer(ch === round.answer, el) }));
    grid.querySelectorAll('.jmeno').forEach(j => j.remove());
  }
}
async function answer(ok, el, need) {
  if (roundDone || busy) return;
  const c = current;
  if (!ok) {
    roundMiss = true;
    el.classList.add('spatne');
    play('boing');
    speak(pickOne(AGAIN));
    animate(0.5, k => { c.bounce.rotation.y = Math.sin(k * Math.PI * 4) * 0.25 * (1 - k); }).then(() => { c.bounce.rotation.y = 0; });
    return;
  }
  roundDone = true;
  el.classList.add('dobre');
  const star = !roundHelp && !roundMiss;
  recordResult(round, star);
  afterResult(round, star, readStats);
  let news = null;
  if (star) {
    const before = hodnost(stars);
    stars++;
    store.set('kk-hvezdy', stars);
    floatUp('⭐', centerOf(c.obj).c.add(new THREE.Vector3(0, 0.3, 0.2)), { n: 3, spread: 0.5, size: 0.2 });
    const after = hodnost(stars), unlocked = DOPLNKY.find(d => d.hvezdy === stars);
    if (after !== before) news = `Nová hodnost: ${after.ikona} ${after.nazev}!`;
    if (unlocked) news = (news ? news + ' ' : '') + `Nová odměna: ${unlocked.ikona} ${unlocked.nazev}! Najdeš ji v šatníku.`;
    renderRank();
  }
  if (news) {
    showBubble('🎉 ' + news);
    for (const ch of ['🎉', '⭐', '✨', '🏅']) floatUp(ch, centerOf(c.obj).c, { n: 3, spread: 0.9, rise: 0.9, life: 2.4 });
    play('poof');
  }
  play('giggle');
  sparkles.userData.emit(centerOf(c.obj).c, 40, 1.2, 0.3);
  const word = round.answer ? ' ' + round.answer.plain.toLowerCase() : '';
  speak(pickOne(PRAISE) + word + (news ? '. ' + news.replace(/[^\p{L}\p{N}\s!?.,]/gu, '') : ''));
  suggestLevel();
  const a = albumEntry(c);
  if (need) {
    await wait(1.2);
    if (phase !== 'cteni') return;
    await doCare(need);
  } else {
    if (a) { ageCare(a); a.pece.hra = Math.min(100, a.pece.hra + 6); saveAlbum(); }
    await hop(c.bounce, 0.22, 0.5);
    await wait(1.4);
  }
  nextRound();
}
function recordResult(r, firstTry) {
  const k = statKey(r.level, r.key);
  const st = readStats[k] || (readStats[k] = { ok: 0, miss: 0, streak: 0 });
  if (firstTry) { st.ok++; st.streak++; } else { st.miss++; st.streak = 0; }
  const h = readHist[r.level] || (readHist[r.level] = []);
  h.push(firstTry ? 1 : 0);
  if (h.length > 30) h.shift();
  store.set('kk-cteni-stat', readStats);
  store.set('kk-cteni-hist', readHist);
}
// When the last ten tasks of a level went well, the next level's tab starts to wiggle.
function suggestLevel() {
  const h = readHist[readLevel] || [];
  const recent = h.slice(-10);
  if (readLevel >= 4 || recent.length < 10 || recent.reduce((a, b) => a + b, 0) < 9 || suggested[readLevel]) return;
  suggested[readLevel] = true;
  const next = READ_LEVELS[readLevel];
  setTimeout(() => { showBubble(`Jde ti to skvěle! Zkusíš ${next.label.toLowerCase()}? ${next.icon}`); speak(`Jde ti to skvěle! Zkusíš ${next.label.toLowerCase()}?`); }, 2600);
  const tab = $('zalozky-cteni').children[readLevel];
  if (tab) tab.classList.add('chce');
}
function renderRank() {
  const h = hodnost(stars), n = dalsiHodnost(stars);
  $('cteni-hvezdy').textContent = '⭐ ' + stars;
  $('cteni-hodnost').innerHTML = `${h.ikona} ${h.nazev}` + (n ? ` <small>· do hodnosti ${n.ikona} zbývá ${n.od - stars} ⭐</small>` : '');
}

// Wardrobe: accessories unlocked by reading stars.
function openWardrobe() {
  const e = albumEntry(current);
  if (!e) return;
  $('satnik-hvezdy').textContent = `⭐ ${stars}`;
  const grid = $('satnik-mrizka');
  grid.innerHTML = '';
  e.doplnky ||= [];
  for (const d of DOPLNKY) {
    const open = stars >= d.hvezdy;
    const t = tile({ label: open ? d.nazev : `${d.hvezdy} ⭐`, icon: open ? d.ikona : '🔒', cls: open ? '' : 'zamceno', onClick: () => {
      if (!open) { speak(`Na ${d.nazev.toLowerCase()} potřebuješ ${d.hvezdy} hvězdiček. Čti s příšerkou!`); return; }
      const on = e.doplnky.includes(d.id);
      e.doplnky = e.doplnky.filter(id => byIdD(id).slot !== d.slot); // one per slot
      if (!on) e.doplnky.push(d.id);
      saveAlbum();
      wear(current.obj, e.doplnky);
      play(on ? 'hide' : 'poof');
      if (!on) sparkles.userData.emit(centerOf(current.obj).c.add(new THREE.Vector3(0, 0.3, 0)), 50, 1.2, 0.3);
      openWardrobe();
    } });
    if (e.doplnky.includes(d.id)) t.classList.add('vybrano');
    grid.append(t);
  }
  $('satnik').hidden = false;
}
$('satnik-zavrit').addEventListener('click', () => { $('satnik').hidden = true; });
$('satnik').addEventListener('click', ev => { if (ev.target.id === 'satnik') $('satnik').hidden = true; });

// A short overview for parents: how each level goes, what is still hard, what is mastered.
function openOverview() {
  const names = { 1: 'Písmenka', 2: 'Slabiky', 3: 'Slova', 4: 'Vzkazy' };
  let html = `<p>Hvězdiček: <b>${stars}</b>, hodnost: <b>${hodnost(stars).ikona} ${hodnost(stars).nazev}</b>.<br>Když něco nejde, hra hned přidá schůdky: nejdřív písmenko nebo slabiku z toho slova, pak lehčí slovo se stejným začátkem a nakonec to původní. Těžké úkoly se míchají s tím, co už jde, a po dvou chybách přijde něco, co Maruška umí. Co přečte třikrát po sobě napoprvé, chodí už jen občas.</p>`;
  html += '<table><tr><th>Úroveň</th><th class="c">Úkolů</th><th class="c">Napoprvé</th><th class="c">Posledních 10</th></tr>';
  for (const l of [1, 2, 3, 4]) {
    const entries = Object.entries(readStats).filter(([k]) => k.startsWith(l + ':')).map(([, v]) => v);
    const ok = entries.reduce((a, v) => a + v.ok, 0), miss = entries.reduce((a, v) => a + v.miss, 0);
    const recent = (readHist[l] || []).slice(-10);
    const pct = n => (n === null ? '–' : Math.round(n * 100) + ' %');
    html += `<tr><td>${names[l]}</td><td class="c">${ok + miss}</td><td class="c">${pct(ok + miss ? ok / (ok + miss) : null)}</td><td class="c">${pct(recent.length ? recent.reduce((a, b) => a + b, 0) / recent.length : null)}</td></tr>`;
  }
  html += '</table>';
  const all = Object.entries(readStats).map(([k, v]) => ({ level: Number(k.split(':')[0]), text: k.slice(k.indexOf(':') + 1).replace(/-/g, ''), ...v }));
  const hard = all.filter(x => x.miss > 0 && x.streak < 3).sort((a, b) => b.miss / (b.ok + b.miss) - a.miss / (a.ok + a.miss) || b.miss - a.miss).slice(0, 14);
  const mastered = all.filter(x => x.streak >= 3);
  html += '<h3>Zatím to jde hůř</h3>' + (hard.length ? '<div class="stitky">' + hard.map(x => `<span title="${names[x.level]}">${x.text} <small>${x.ok}/${x.ok + x.miss}</small></span>`).join('') + '</div>' : '<p>Zatím nic, nebo se ještě nehrálo.</p>');
  html += `<h3>Už to umí (${mastered.length})</h3>` + (mastered.length ? '<div class="stitky umi">' + mastered.slice(0, 40).map(x => `<span>${x.text}</span>`).join('') + '</div>' : '<p>Až něco přečte třikrát po sobě napoprvé, objeví se to tady.</p>');
  $('prehled-obsah').innerHTML = html;
  $('prehled').hidden = false;
}
$('cteni-prehled').addEventListener('click', () => { play('tap'); openOverview(); });
$('prehled-zavrit').addEventListener('click', () => { $('prehled').hidden = true; });
$('prehled').addEventListener('click', ev => { if (ev.target.id === 'prehled') $('prehled').hidden = true; });

$('cteni-napoveda').addEventListener('click', () => {
  if (!round) return;
  initAudio(); play('tap');
  roundHelp = true;
  // syllables light up one after another while they are read, then the whole thing
  const els = [...$('cteni-karta').querySelectorAll('.slabika')];
  els.forEach((el, i) => setTimeout(() => flashSyl(el), i * 650));
  speak(round.hint.toLowerCase());
});
$('cteni-velikost').addEventListener('click', () => {
  play('tap');
  readLower = !readLower;
  store.set('kk-cteni-mala', readLower);
  $('cteni-velikost').textContent = readLower ? 'ABC' : 'abc';
  if (round) renderCard();
});
$('cteni-zpet').addEventListener('click', () => { play('tap'); round = null; setPhase(albumEntry(current) ? 'care' : 'stage'); });

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
  await captureRoomReflections();
  requestAnimationFrame(loop);
  await putOnStage({ type: 'item', item: first }, { appear: false });
  loadBar.style.width = '100%';
  for (const it of ITEMS) loadItemGltf(it).catch(() => {});
  // celebration emoji: draw and upload their textures now, not in the middle of the big moment
  for (const ch of ['⭐', '✨', '🎉', '💫', '💖', 'Z', '🏅']) { emojiTexCache[ch] ||= canvasTexture(ch); renderer.initTexture(emojiTexCache[ch]); }
  checkForUpdate();

  if (params.has('nahledy')) { window.__kk = { ITEMS, putOnStage, spinner, camera, renderer, resize }; $('nacitani').classList.add('pryc'); return; }
  if (params.has('demo')) { window.__kk = { choose, putOnStage, current: () => current, ITEMS, newMonsterSpec, setPhase, phase: () => phase, startSpecial, album: () => album, setAlbum: a => { album = a; saveAlbum(); }, renderer, scene, camera, box,
    screen: which => { const v = (which === 'box' ? box.localToWorld(new THREE.Vector3(0, 0.9, 0)) : centerOf(current.obj).c).project(camera); return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]; } }; }

  $('start').hidden = false;
  $('start').addEventListener('click', () => {
    initAudio();
    play('poof');
    $('nacitani').classList.add('pryc');
    speak('Ahoj Maruško! Tohle je kouzelná krabice. Otevři ji, dej dovnitř, co chceš, a laser to promění!');
    setPhase('stage');
  }, { once: true });
}
start();
