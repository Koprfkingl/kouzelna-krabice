// Renderer, camera, lights and the fixed parts of the scene: the room, the box and the turntable.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { makeBox, makeSparkles } from './box.js';
import { makeRoom } from './room.js';
import { $, FREEZE, params } from './util.js';

// ---------- Renderer & scene ----------
const canvas = $('scena');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: params.has('nahledy') });
// Phones have very dense screens; drawing every physical pixel makes the game stutter.
// Start at a moderate resolution and lower it further if frames take too long (see adaptQuality).
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

// If the phone can't keep up, draw fewer pixels (checked every 2 seconds, only ever goes down).
// Returns true when the resolution changed (the caller then resizes the view).
let qT = 0, qFrames = 0, qSlow = 0;
function adaptQuality(dt) {
  if (FREEZE || document.hidden) return false;
  qT += dt; qFrames++;
  if (qT < 1.2) return false;
  const fps = qFrames / qT;
  qT = 0; qFrames = 0;
  qSlow = fps < 50 ? qSlow + 1 : 0;
  if (qSlow >= 1 && dprStep < DPR_STEPS.length - 1) {
    dprStep++;
    renderer.setPixelRatio(DPR_STEPS[dprStep]);
    qSlow = 0;
    return true;
  } else if (qSlow >= 2 && dprStep === DPR_STEPS.length - 1 && key.shadow.mapSize.x > 512) {
    key.shadow.mapSize.set(512, 512);
    key.shadow.map?.dispose(); key.shadow.map = null;
  }
  return false;
}

export { KEY, adaptQuality, box, boxSlot, camera, canvas, captureRoomReflections, fill, gltfLoader, key, loadBar, manager,
  renderer, room, scene, sparkles, spinner, texLoader };
