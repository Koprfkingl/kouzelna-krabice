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
const DPR_STEPS = [Math.min(window.devicePixelRatio, MOBILE ? 1.5 : 2), 1.25, 1.0, 0.8].filter((v, i, a) => i === 0 || v < a[0]);
let dprStep = 0;
renderer.setPixelRatio(DPR_STEPS[0]);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 60);
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

function buildMonster(m) { return makeMonster(m.seed, { tint: m.tint, size: 0.82 }); }

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

// A built thing: holder (moved between stage and box) > obj (bounces when tapped) > model.
async function buildFor(src) {
  const obj = src.type === 'item' ? await buildItem(src.item) : src.type === 'photo' ? await buildPhoto(src.photo) : buildMonster(src.monster);
  const dis = prepareDissolve(obj);
  dis.uDis.value = 1;
  const holder = new THREE.Group();
  holder.add(obj);
  const size = new THREE.Box3().setFromObject(obj, true).getSize(new THREE.Vector3());
  const fit = Math.min(1, box.userData.insideFit / Math.max(size.x, size.y, size.z, 0.01));
  try { await renderer.compileAsync(holder, camera, scene); } catch (e) { /* older GPUs compile on first draw */ }
  return { ...src, ...describe(src), obj, holder, dis, fit, where: 'stage' };
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

async function setLid(open) {
  if (lidOpen === open) return;
  lidOpen = open;
  play('lid');
  const from = open ? 0 : 1, to = open ? 1 : 0;
  await animate(open ? 0.9 : 0.7, k => {
    const e = open ? ease.out(k) : ease.inOut(k);
    box.userData.setLid(from + (to - from) * e);
    box.userData.setInnerLight(open ? e : 1 - e);
  });
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

// The lid opens; the new thing rises out of the mist.
async function reveal(before) {
  const c = current;
  await setLid(true);
  play('poof');
  sparkles.userData.emit(boxSlot.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.4, 0)), 120, 1.8, 0.5);
  await animate(1.3, k => {
    c.dis.uDis.value = 1 - ease.out(k);
    c.holder.position.y = -0.2 + 0.32 * ease.out(k);
    box.userData.setInnerLight(1 + Math.sin(k * Math.PI) * 0.8);
  });
  c.dis.uDis.value = 0;
  const sentence = `${before.name} ${proměnil(before.g)} na ${c.acc}!`;
  showBubble('✨ ' + sentence + ' ✨');
  speak(sentence);
  if (c.type === 'monster') { play('giggle'); setTimeout(() => saveToAlbum(c), 700); }
  return sentence;
}

function flash() {
  const el = $('blesk');
  el.style.transition = 'none'; el.style.opacity = '0.6';
  requestAnimationFrame(() => { el.style.transition = 'opacity .7s'; el.style.opacity = '0'; });
}

// ---------- Camera ----------
// Two views: the stage in front of the box, and a closer look into the box.
const SHOTS = {
  stage: { pos: new THREE.Vector3(0, 1.75, 3.7), look: new THREE.Vector3(0, 0.6, -0.2) },
  box: { pos: new THREE.Vector3(0, 3.65, 1.75), look: new THREE.Vector3(0, 0.35, -1.0) },
};
let shot = 'stage';
const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
function shotTarget(name) {
  const s = SHOTS[name];
  const fit = Math.min(1.9, Math.max(1, 0.62 / camera.aspect)); // narrow phone screens: step back
  const pos = s.pos.clone().sub(s.look).multiplyScalar(fit).add(s.look);
  const look = s.look.clone().add(new THREE.Vector3(0, -0.22 * (fit - 1), 0));
  return { pos, look };
}
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
function snapCamera() { const t = shotTarget(shot); camPos.copy(t.pos); camLook.copy(t.look); }

// ---------- Tapping things ----------
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let reaction = null;
const lampLight = new THREE.PointLight(0xffd59a, 0, 3, 2);
scene.add(lampLight);
const flashLight = new THREE.PointLight(0xffffff, 0, 6, 2);
scene.add(flashLight);

canvas.addEventListener('pointerdown', e => {
  initAudio();
  if (busy || !current) return;
  pointer.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  if (raycaster.intersectObject(current.holder, true).length) react(current);
});

function react(c) {
  const kind = c.type === 'item' ? c.item.sound : c.type === 'monster' ? 'monster' : null;
  if (kind === 'monster') play('giggle'); else if (kind) play(kind); else play('boing');
  if (kind === 'lampa') { lampLight.intensity = lampLight.intensity > 0 ? 0 : 4; lampLight.position.copy(centerOf(c.obj).c).add(new THREE.Vector3(0, 0.2, 0.3)); }
  if (kind === 'fotak') { flashLight.position.copy(centerOf(c.obj).c).add(new THREE.Vector3(0, 0.3, 0.6)); flashLight.intensity = 30; setTimeout(() => flashLight.intensity = 0, 120); flash(); }
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
  reaction = { obj: c.obj, start: performance.now(), spin: kind === 'auto' };
}

function updateReaction(now) {
  if (!reaction) return;
  const t = (now - reaction.start) / 1000, o = reaction.obj;
  if (t > 1.0) { o.scale.setScalar(1); o.position.y = 0; o.rotation.y = 0; reaction = null; return; }
  const jump = Math.sin(Math.min(1, t * 1.6) * Math.PI);
  o.position.y = jump * 0.22;
  const squash = 1 + Math.sin(t * Math.PI * 4) * 0.08 * (1 - t);
  o.scale.set(1 / Math.sqrt(squash), squash, 1 / Math.sqrt(squash));
  if (reaction.spin) o.rotation.y = ease.out(t) * Math.PI * 2;
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
    if (ud.monster) ud.monster.update(t, camera.position);
    if (ud.float && !reaction) current.obj.position.y = Math.sin(t * 1.7) * 0.04;
  }
  updateReaction(now);
  sparkles.userData.update(dt);
  mist += (mistTarget - mist) * Math.min(1, dt * 2);
  box.userData.setMist(lidOpen ? mist : mist * 0.0);
  box.userData.update(t, dt, zapping);
  if (!busy) box.userData.setCharge(0.08 + 0.06 * Math.sin(t * 1.5));
  // glide the camera towards the current view
  const target = shotTarget(shot);
  const f = FREEZE || params.has('okamzite') ? 1 : 1 - Math.exp(-dt * 2.5);
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
  if (qT < 2) return;
  const fps = qFrames / qT;
  qT = 0; qFrames = 0;
  qSlow = fps < 45 ? qSlow + 1 : 0;
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

async function saveToAlbum(c) {
  if (album.some(a => a.seed === c.monster.seed)) return;
  const thumb = await snapshot(c.obj);
  album.unshift({ seed: c.monster.seed, name: c.monster.name, tint: c.monster.tint || null, thumb });
  album = album.slice(0, 80);
  while (!store.set('kk-album', album) && album.length > 1) album.pop();
  updateAlbumCount();
}
function updateAlbumCount() { $('album-pocet').textContent = album.length; }

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
    for (const a of album) grid.append(mark(tile({ label: a.name, img: a.thumb, onClick: el => pickT({ type: 'monster', monster: { seed: a.seed, name: a.name, tint: a.tint } }, el) }), chosenTarget.monster?.seed === a.seed));
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
  return { seed, name: monsterName(rng(seed)), tint: tint || null };
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

// Each step of the magic is one button press.
// phase: stage → stageOpen → inside → closed → (laser) → done → (open) → result
let phase = 'stage';
let lastBefore = null;
function action(label, fn, cls = '') { return { label, fn, cls }; }

function setPhase(p) {
  phase = p;
  const c = current;
  let title = '', main = null, extra = [];
  $('zive-info').hidden = true;
  $('cil-volba').hidden = true;
  shot = ['inside', 'closed', 'done', 'result'].includes(p) ? 'box' : 'stage';
  const other = action('🔄 Vybrat něco jiného', () => showPicker());
  if (p === 'stage') {
    title = `${c.name} čeká před krabicí`;
    main = action('📦 Otevřít krabici', async () => { await setLid(true); setPhase('stageOpen'); });
    extra = [other];
  } else if (p === 'stageOpen') {
    title = 'Krabice je otevřená!';
    main = action('⬆️ Dát do krabice', async () => { await moveCurrent('box'); setPhase('inside'); });
    extra = [other];
  } else if (p === 'inside') {
    title = `${c.name} je v krabici`;
    main = action('🔒 Zavřít víko', async () => { mistTarget = 0; await setLid(false); setPhase('closed'); });
    extra = [action('⬇️ Vyndat ven', async () => { await moveCurrent('stage'); await setLid(false); setPhase('stage'); })];
  } else if (p === 'closed') {
    title = c.living ? `${c.name} je v krabici` : 'Na co to proměníme?';
    if (c.living) $('zive-info').hidden = false;
    else { $('cil-volba').hidden = false; renderTargets(); }
    main = action('⚡ LASER! ⚡', async () => { const r = await zap(pickTarget()); lastBefore = r.before; setPhase('done'); }, 'laser');
    extra = [action('📦 Otevřít', async () => { await setLid(true); setPhase('inside'); })];
  } else if (p === 'done') {
    title = 'Hotovo! Co je uvnitř?';
    main = action('📦 Otevřít krabici', async () => { await reveal(lastBefore); setPhase('result'); }, 'laser');
  } else if (p === 'result') {
    title = `Tadá! ${c.name}`;
    main = action('✨ Zavřít a proměnit znovu', async () => { mistTarget = 0; await setLid(false); setPhase('closed'); });
    extra = [action('⬇️ Vyndat ven', async () => { mistTarget = 0; await moveCurrent('stage'); await setLid(false); setPhase('stage'); }), other];
  }
  $('akce-nadpis').textContent = title;
  const mb = $('btn-hlavni');
  mb.textContent = main.label;
  mb.className = 'velke hlavni ' + main.cls;
  mb.onclick = () => run(main.fn);
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

async function run(fn) {
  if (busy) return;
  initAudio();
  play('tap');
  busy = true;
  hidePanel(true);
  hideBubble();
  try { await fn(); } finally { busy = false; }
}

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
  speak(current.name);
  setPhase('stage');
}

function showStep(which) {
  for (const s of ['vyber', 'akce']) $('krok-' + s).hidden = s !== which;
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
function renderAlbum() {
  const grid = $('album-mrizka');
  grid.innerHTML = '';
  if (!album.length) { grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;opacity:.8">Zatím tu nic není. Dej do krabice něco živého!</p>'; return; }
  for (const a of album) grid.append(tile({ label: a.name, img: a.thumb, onClick: () => { $('album').hidden = true; choose({ type: 'monster', monster: { seed: a.seed, name: a.name, tint: a.tint } }); } }));
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
      const g = await buildItem({ ...it, size: p.size, rot: p.rot, float: 0, anim: null });
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
  checkForUpdate();

  if (params.has('nahledy')) { window.__kk = { ITEMS, putOnStage, spinner, camera, renderer, resize }; $('nacitani').classList.add('pryc'); return; }
  if (params.has('demo')) { window.__kk = { choose, putOnStage, current: () => current, ITEMS, newMonsterSpec, setPhase, phase: () => phase }; }

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
