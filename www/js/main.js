import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

import { ITEMS, KINDS, byId, proměnil, monsterName } from './catalog.js';
import { makeMonster, rng } from './monster.js';
import { makeBox, makeLaser, makeSparkles } from './box.js';
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
const CAM_LOOK = new THREE.Vector3(0, 0.62, -0.25);
const camBase = new THREE.Vector3(0, 1.75, 3.6);

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  // On a narrow phone screen pull the camera back so the box and the stage both fit.
  const fit = Math.max(1, 0.62 / camera.aspect);
  camera.position.copy(camBase).sub(CAM_LOOK).multiplyScalar(Math.min(fit, 1.9)).add(CAM_LOOK);
  camera.position.y -= 0.0;
  camera.lookAt(CAM_LOOK.clone().add(new THREE.Vector3(0, -0.28 * (fit - 1), 0)));
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);

// Lights: the HDR room gives soft light and reflections, one warm key light gives shadows.
const key = new THREE.DirectionalLight(0xfff1dc, 2.2);
key.position.set(2.2, 4, 2.4);
key.castShadow = true;
key.shadow.mapSize.set(1024, 1024);
key.shadow.camera.left = -2.5; key.shadow.camera.right = 2.5; key.shadow.camera.top = 2.5; key.shadow.camera.bottom = -2.5;
key.shadow.camera.near = 1; key.shadow.camera.far = 10;
key.shadow.bias = -0.0006; key.shadow.normalBias = 0.02;
scene.add(key);
const rim = new THREE.DirectionalLight(0xb48cff, 0.9);
rim.position.set(-3, 2.5, -2);
scene.add(rim);
const hitLight = new THREE.PointLight(0xff50d0, 0, 3, 2);
scene.add(hitLight);
const flashLight = new THREE.PointLight(0xffffff, 0, 6, 2);
flashLight.position.set(0, 1.2, 1.2);
scene.add(flashLight);

// ---------- Loading ----------
const manager = new THREE.LoadingManager();
const ENV_INTENSITY = 1.1;
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

// The room around the table: an ordinary 8-bit photo (made from an HDR panorama by scripts/hdr2jpg.py).
// Float HDR textures overflowed on phone GPUs and turned the whole picture black and white.
const envReady = Promise.all([
  new Promise(res => texLoader.load('textury/prostredi.jpg', t => {
    t.mapping = THREE.EquirectangularReflectionMapping;
    t.colorSpace = THREE.SRGBColorSpace;
    // Reflections need float render targets; on a GPU without them use plain soft light instead.
    const gl = renderer.getContext();
    if (gl.getExtension('EXT_color_buffer_half_float') || gl.getExtension('EXT_color_buffer_float')) {
      scene.environment = t;
      scene.environmentIntensity = ENV_INTENSITY;
    } else {
      scene.add(new THREE.HemisphereLight(0xfff4e8, 0x5a4636, 1.6));
    }
    res();
  })),
  new Promise(res => texLoader.load('textury/pozadi.jpg', t => {
    t.mapping = THREE.EquirectangularReflectionMapping;
    t.colorSpace = THREE.SRGBColorSpace;
    scene.background = t; // pre-blurred and darkened, so no blur pass is needed
    res();
  })),
]);

// Table
const tableTex = {};
for (const [k, t] of Object.entries(wood)) { tableTex[k] = t.clone(); tableTex[k].repeat.set(3, 3); tableTex[k].needsUpdate = true; }
const table = new THREE.Mesh(new THREE.CircleGeometry(6, 96), new THREE.MeshPhysicalMaterial({
  map: tableTex.wood, roughnessMap: tableTex.woodRough, bumpMap: tableTex.woodBump, bumpScale: 0.6, color: 0xc49a76, roughness: 0.6, clearcoat: 0.35, clearcoatRoughness: 0.3,
}));
table.rotation.x = -Math.PI / 2;
table.receiveShadow = true;
scene.add(table);

const box = makeBox(wood);
box.position.set(0, 0, -1.05);
scene.add(box);

// Turntable stage in front of the box
const stage = new THREE.Group();
stage.position.set(0, 0, 0.42);
scene.add(stage);
const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.66, 0.06, 96),
  new THREE.MeshPhysicalMaterial({ color: 0x1c0f2c, roughness: 0.9, sheen: 0.8, sheenColor: 0x5a3a80, sheenRoughness: 0.5 }));
plate.position.y = 0.03; plate.receiveShadow = true; plate.castShadow = true;
const plateRing = new THREE.Mesh(new THREE.TorusGeometry(0.645, 0.022, 16, 128), new THREE.MeshPhysicalMaterial({ color: 0xd9a84e, metalness: 1, roughness: 0.25 }));
plateRing.rotation.x = Math.PI / 2; plateRing.position.y = 0.06; plateRing.castShadow = true;
stage.add(plate, plateRing);
const spinner = new THREE.Group();
spinner.position.y = 0.06;
stage.add(spinner);

const laser = makeLaser();
scene.add(laser);
const sparkles = makeSparkles(500);
scene.add(sparkles);

// ---------- Objects on stage ----------
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
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
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
  if (gltf.animations.length) {
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

// What is on stage now: { type: 'item'|'monster'|'photo', item?, monster?, photo?, living, name, acc, g, obj }
let current = null;

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

async function buildFor(src) {
  const obj = src.type === 'item' ? await buildItem(src.item) : src.type === 'photo' ? await buildPhoto(src.photo) : buildMonster(src.monster);
  const dis = prepareDissolve(obj);
  dis.uDis.value = 1;
  try { await renderer.compileAsync(obj, camera, scene); } catch (e) { /* older GPUs: compile on first draw */ }
  return { ...src, ...describe(src), obj, dis };
}

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
const tweens = [];
const ease = { out: k => 1 - Math.pow(1 - k, 3), inOut: k => k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2,
  elastic: k => k === 0 || k === 1 ? k : Math.pow(2, -10 * k) * Math.sin((k * 10 - 0.75) * (2 * Math.PI) / 3) + 1 };

async function putOnStage(src, { appear = true } = {}) {
  const next = await buildFor(src);
  if (current) { spinner.remove(current.obj); disposeObj(current.obj); }
  current = next;
  spinner.add(next.obj);
  if (appear) {
    play('place');
    await animate(0.7, k => { next.dis.uDis.value = 1 - ease.out(k); });
  }
  next.dis.uDis.value = 0;
  return next;
}

function disposeObj(o) {
  o.traverse(c => {
    if (c.isMesh) {
      const ms = Array.isArray(c.material) ? c.material : [c.material];
      for (const m of ms) m.dispose();
    }
  });
}

// ---------- The transformation ----------
let busy = false;
const tmpV = new THREE.Vector3();

function centerOf(obj) {
  const bb = new THREE.Box3().setFromObject(obj, false);
  if (bb.isEmpty()) return { c: spinner.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.4, 0)), s: new THREE.Vector3(0.6, 0.8, 0.6) };
  return { c: bb.getCenter(new THREE.Vector3()), s: bb.getSize(new THREE.Vector3()) };
}

async function transform(targetSrc) {
  if (busy || !current) return;
  busy = true;
  hidePanel(true);
  hideBubble();
  const before = current;
  const nextPromise = buildFor(targetSrc);

  // 1) The box charges up.
  play('charge');
  await animate(1.1, k => {
    box.userData.setCharge(k * k);
    key.intensity = 2.2 - k * 1.2;
    scene.environmentIntensity = ENV_INTENSITY * (1 - k * 0.45);
  });

  // 2) Laser on: it sweeps over the thing and dissolves it.
  const lens = box.localToWorld(box.userData.lensLocal.clone());
  const { c: cBefore, s: sBefore } = centerOf(before.obj);
  laser.visible = true;
  play('laser');
  let last = performance.now();
  await animate(1.7, k => {
    const now = performance.now(), dt = (now - last) / 1000; last = now;
    const sweep = Math.sin(k * Math.PI * 5);
    const hit = cBefore.clone().add(tmpV.set(sweep * sBefore.x * 0.3, (0.35 - k * 0.6) * sBefore.y, sBefore.z * 0.25));
    laser.userData.aim(lens, hit, now / 1000, 0.8 + 0.4 * Math.sin(now / 40));
    hitLight.position.copy(hit);
    hitLight.intensity = 4 + Math.random() * 3;
    sparkles.userData.emit(hit, 6, 1.4, 0.08);
    before.dis.uDis.value = Math.min(1, ease.inOut(k) * 1.05);
    box.userData.setCharge(1);
    camera.position.x += (Math.random() - 0.5) * 0.004; // a tiny shake
    void dt;
  });

  // 3) Poof! The new thing appears.
  const next = await nextPromise;
  spinner.remove(before.obj);
  disposeObj(before.obj);
  current = next;
  spinner.add(next.obj);
  spinner.rotation.y = 0;
  play('poof');
  flash();
  const { c: cNext } = centerOf(next.obj);
  sparkles.userData.emit(cNext, 160, 2.6, 0.4);
  flashLight.intensity = 12;
  last = performance.now();
  await animate(1.0, k => {
    const now = performance.now();
    next.dis.uDis.value = 1 - ease.out(k);
    next.obj.scale.setScalar(0.6 + 0.4 * ease.elastic(k));
    flashLight.intensity = 12 * (1 - k);
    if (k < 0.45) laser.userData.aim(lens, cNext, now / 1000, (1 - k / 0.45));
    else laser.visible = false;
    hitLight.intensity = (1 - k) * 4;
    box.userData.setCharge(1 - k);
    key.intensity = 1.0 + k * 1.2;
    scene.environmentIntensity = ENV_INTENSITY * (0.55 + k * 0.45);
    last = now;
  });
  laser.visible = false;
  hitLight.intensity = 0; flashLight.intensity = 0;
  next.dis.uDis.value = 0;
  next.obj.scale.setScalar(1);
  resize();

  const sentence = `${before.name} ${proměnil(before.g)} na ${next.acc}!`;
  showResult(sentence);
  speak(sentence);
  if (next.type === 'monster') {
    play('giggle');
    setTimeout(() => saveToAlbum(next), 900);
  }
  busy = false;
}

function flash() {
  const el = $('blesk');
  el.style.transition = 'none'; el.style.opacity = '0.6';
  requestAnimationFrame(() => { el.style.transition = 'opacity .7s'; el.style.opacity = '0'; });
}

// ---------- Tapping the thing on stage ----------
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let reaction = null;
const lampLight = new THREE.PointLight(0xffd59a, 0, 3, 2);
scene.add(lampLight);

canvas.addEventListener('pointerdown', e => {
  initAudio();
  if (busy || !current) return;
  pointer.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  if (!raycaster.intersectObject(current.obj, true).length) return;
  react(current);
});

function react(c) {
  const start = performance.now();
  const kind = c.type === 'item' ? c.item.sound : c.type === 'monster' ? 'monster' : null;
  if (kind === 'monster') play('giggle');
  else if (kind) play(kind);
  else play('boing');
  if (kind === 'lampa') { lampLight.intensity = lampLight.intensity > 0 ? 0 : 4; lampLight.position.copy(centerOf(c.obj).c).add(new THREE.Vector3(0, 0.2, 0.3)); }
  if (kind === 'fotak') { flashLight.intensity = 30; setTimeout(() => flashLight.intensity = 0, 120); flash(); }
  if (kind === 'liska' && c.obj.userData.mixer) {
    const mixer = c.obj.userData.mixer, clips = c.obj.userData.clips;
    const run = THREE.AnimationClip.findByName(clips, 'Run');
    if (run) { mixer.stopAllAction(); mixer.clipAction(run).play(); setTimeout(() => { if (current === c) { mixer.stopAllAction(); mixer.clipAction(THREE.AnimationClip.findByName(clips, 'Survey') || clips[0]).play(); } }, 2200); }
  }
  if (kind === 'radio') {
    for (let i = 0; i < 6; i++) setTimeout(() => sparkles.userData.emit(centerOf(c.obj).c, 14, 1.2, 0.3), i * 170);
  }
  reaction = { obj: c.obj, start, spin: kind === 'auto' };
}

function updateReaction(now) {
  if (!reaction) return;
  const t = (now - reaction.start) / 1000;
  const o = reaction.obj;
  if (t > 1.0) { o.scale.setScalar(1); o.position.y = 0; o.rotation.y = 0; reaction = null; return; }
  const k = t / 1.0;
  const jump = Math.sin(Math.min(1, k * 1.6) * Math.PI);
  o.position.y = jump * 0.22;
  const squash = 1 + Math.sin(k * Math.PI * 4) * 0.08 * (1 - k);
  o.scale.set(1 / Math.sqrt(squash), squash, 1 / Math.sqrt(squash));
  if (reaction.spin) o.rotation.y = ease.out(k) * Math.PI * 2;
}

// ---------- Main loop ----------
const clock = new THREE.Clock();
let pendingSnapshot = null;
function loop() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const now = performance.now();
  const t = now / 1000;
  for (let i = tweens.length - 1; i >= 0; i--) if (!tweens[i](now)) tweens.splice(i, 1);
  if (!busy) spinner.rotation.y = FREEZE ? 0 : Math.sin(t * 0.45) * 0.55;
  if (current) {
    const ud = current.obj.userData;
    if (ud.mixer) ud.mixer.update(dt);
    if (ud.monster) ud.monster.update(t, camera.position);
    if (ud.float && !reaction) current.obj.position.y = Math.sin(t * 1.7) * 0.04;
  }
  updateReaction(now);
  sparkles.userData.update(dt);
  if (!busy) box.userData.setCharge(0.08 + 0.06 * Math.sin(t * 1.5));
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
  } else if (qSlow >= 2 && renderer.shadowMap.enabled && dprStep === DPR_STEPS.length - 1) {
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
      const side = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) * 1.15;
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
const ICONS = { liska: '🦊', ryba: '🐟', kytka: '🪴', avokado: '🥑', lahev: '🧴', lucerna: '🏮', kuzel: '🚧', vaza: '💐', hrnek: '☕', zidle: '🪑', bota: '👟',
  radio: '📻', fotak: '📷', auticko: '🚗', lednice: '🧊', lampa: '💡' };

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
let srcTab = 'zive', dstTab = 'veci', chosenTarget = null;

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
  const info = current && current.living;
  $('zive-info').hidden = !info;
  $('cil-volba').hidden = !!info;
  $('cil-nadpis').textContent = info ? `${current.name} jde do krabice!` : 'Na co to proměníme?';
  $('btn-laser').disabled = !info && !chosenTarget;
  if (info) return;
  tabs($('zalozky-cil'), dstTab, id => { dstTab = id; renderTargets(); }, TARGET_KINDS);
  const grid = $('mrizka-cil');
  grid.innerHTML = '';
  const pickT = (src, el) => {
    chosenTarget = src;
    grid.querySelectorAll('.vybrano').forEach(x => x.classList.remove('vybrano'));
    el.classList.add('vybrano');
    $('btn-laser').disabled = false;
  };
  grid.append(tile({ label: 'Překvapení', icon: '🎲', cls: 'foto-nova', onClick: el => pickT({ surprise: true }, el) }));
  if (dstTab === 'priserky') {
    grid.append(tile({ label: 'Nová příšerka', icon: '👾', onClick: el => pickT({ type: 'monster', monster: newMonsterSpec() }, el) }));
    for (const a of album) grid.append(tile({ label: a.name, img: a.thumb, onClick: el => pickT({ type: 'monster', monster: { seed: a.seed, name: a.name, tint: a.tint } }, el) }));
  } else if (dstTab === 'fotky') {
    for (const p of photos) grid.append(tile({ label: 'Fotka', img: p.data, onClick: el => pickT({ type: 'photo', photo: p }, el) }));
  } else {
    for (const it of ITEMS.filter(i => i.kind === dstTab)) {
      if (current && current.type === 'item' && current.item.id === it.id) continue;
      grid.append(tile({ label: it.name, icon: ICONS[it.id], img: `nahledy/${it.id}.webp`, onClick: el => pickT({ type: 'item', item: it }, el) }));
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

async function choose(src) {
  if (busy) return;
  busy = true;
  hidePanel(true);
  await putOnStage(src);
  busy = false;
  speak(current.name);
  showStep('cil');
}

function showStep(which) {
  for (const s of ['vyber', 'cil', 'vysledek']) $('krok-' + s).hidden = s !== which;
  if (which === 'vyber') { chosenTarget = null; renderSource(); }
  if (which === 'cil') { chosenTarget = null; renderTargets(); }
  hidePanel(false);
}
function hidePanel(h) { $('panel').classList.toggle('schovany', h); }
function showResult(text) {
  $('vysledek-text').textContent = text;
  showStep('vysledek');
  showBubble('✨ ' + text + ' ✨');
}
let bubbleTimer = 0;
function showBubble(text) {
  const b = $('bublina');
  b.textContent = text; b.hidden = false;
  b.style.animation = 'none'; void b.offsetWidth; b.style.animation = '';
  clearTimeout(bubbleTimer);
  bubbleTimer = setTimeout(hideBubble, 4500);
}
function hideBubble() { $('bublina').hidden = true; }

$('btn-laser').addEventListener('click', () => {
  initAudio();
  if (!current) return;
  let target;
  if (current.living) {
    const tint = current.type === 'photo' ? current.photo.color : null;
    target = { type: 'monster', monster: newMonsterSpec(tint) };
  } else if (!chosenTarget || chosenTarget.surprise) target = randomTarget();
  else if (chosenTarget.type === 'monster' && current.type === 'monster' && chosenTarget.monster.seed === current.monster.seed) target = { type: 'monster', monster: newMonsterSpec() };
  else target = chosenTarget;
  transform(target);
});
$('btn-zpet').addEventListener('click', () => { play('tap'); showStep('vyber'); });
$('btn-znovu').addEventListener('click', () => { play('tap'); hideBubble(); showStep('cil'); });
$('btn-nove').addEventListener('click', () => { play('tap'); hideBubble(); showStep('vyber'); });

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
  if (!album.length) { grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;opacity:.8">Zatím tu nic není. Dej před krabici něco živého!</p>'; return; }
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

// ---------- Start ----------
let loadedCount = 0;
manager.onProgress = (url, done, total) => { loadBar.style.width = Math.round(done / total * 70) + '%'; };

async function start() {
  resize();
  updateAlbumCount();
  hidePanel(true);
  await envReady;
  // Warm up: load the first item, then the rest quietly in the background.
  const first = byId('liska');
  await loadItemGltf(first);
  loadBar.style.width = '85%';
  requestAnimationFrame(loop);
  await putOnStage({ type: 'item', item: first }, { appear: false });
  loadBar.style.width = '100%';
  for (const it of ITEMS) loadItemGltf(it).then(() => { loadedCount++; }).catch(() => {});

  if (params.has('nahledy')) { window.__kk = { ITEMS, putOnStage, spinner, camera, renderer, resize, CAM_LOOK }; $('nacitani').classList.add('pryc'); return; }
  if (params.has('demo')) { window.__kk = { transform, choose, putOnStage, current: () => current, ITEMS, newMonsterSpec, showStep }; }

  $('start').hidden = false;
  $('start').addEventListener('click', () => {
    initAudio();
    play('poof');
    $('nacitani').classList.add('pryc');
    speak('Ahoj Maruško! Tohle je kouzelná krabice. Vyber, co dáme před krabici, a laser to promění!');
    showStep('cil');
  }, { once: true });
}
start();
