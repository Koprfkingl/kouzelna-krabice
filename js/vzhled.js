// The cartoon look: flat toon shading in three steps, cheerful colours and a dark ink outline around things.
// toonify() turns the realistic materials of anything built into toon ones; it is safe to call again.
import * as THREE from 'three';

export const INK = new THREE.Color(0x3b2552);
export const BACKGROUND = 0xffe9f3;

// light → three flat bands
const ramp = (() => {
  const c = document.createElement('canvas'); c.width = 4; c.height = 1;
  const g = c.getContext('2d');
  ['#7a6a8a', '#c9bccf', '#ffffff', '#ffffff'].forEach((col, i) => { g.fillStyle = col; g.fillRect(i, 0, 1, 1); });
  const t = new THREE.CanvasTexture(c);
  t.minFilter = t.magFilter = THREE.NearestFilter; t.generateMipmaps = false;
  return t;
})();

// cartoon floorboards instead of the photo of real wood
let planks = null;
function plankTexture() {
  if (planks) return planks;
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d');
  for (let i = 0; i < 8; i++) {
    g.fillStyle = ['#f4c08a', '#efb47b', '#f7c995', '#ecb07a'][i % 4]; g.fillRect(0, i * 64, 512, 64);
    g.fillStyle = '#d49660'; g.fillRect(0, i * 64 + 60, 512, 4); g.fillRect((i * 173) % 512, i * 64, 4, 64);
  }
  planks = new THREE.CanvasTexture(c);
  planks.colorSpace = THREE.SRGBColorSpace;
  planks.wrapS = planks.wrapT = THREE.RepeatWrapping;
  return planks;
}

const brighter = col => {
  const h = {}; col.getHSL(h);
  return new THREE.Color().setHSL(h.h, Math.min(1, h.s * 1.35 + 0.05), Math.min(0.82, h.l * 1.08 + 0.04));
};
const GOLD = new THREE.Color(0xffc93c);

// Very dark textures (black ball, grey sofa) look gloomy in flat light, so they are lifted a little.
const lum = new WeakMap();
function textureLift(tex) {
  const img = tex && tex.image;
  if (!img || !(img.width > 0)) return 1;
  if (!lum.has(img)) {
    let l = 0.5;
    try {
      const c = document.createElement('canvas'); c.width = c.height = 16;
      const g = c.getContext('2d', { willReadFrequently: true });
      g.drawImage(img, 0, 0, 16, 16);
      const d = g.getImageData(0, 0, 16, 16).data;
      let s = 0;
      for (let i = 0; i < d.length; i += 4) s += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
      l = s / (d.length / 4) / 255;
    } catch (e) { /* not readable: leave it */ }
    lum.set(img, l);
  }
  const l = lum.get(img);
  return l < 0.3 ? Math.min(2.2, 0.38 / Math.max(l, 0.05)) : 1;
}

const converted = new WeakMap(); // realistic material → its toon twin (shared materials stay shared)
export function toonMaterial(m) {
  if (!m || m.userData.toon || m.userData.noToon) return m;
  if (!(m.isMeshStandardMaterial || m.isMeshPhongMaterial || m.isMeshLambertMaterial)) return m;
  if (converted.has(m)) return converted.get(m);
  const wood = !!(m.bumpMap && m.roughnessMap && m.map);
  const t = new THREE.MeshToonMaterial({
    color: wood ? new THREE.Color(0xffffff) : m.map ? m.color.clone().multiplyScalar(textureLift(m.map)) : brighter(m.color),
    map: wood ? plankTexture() : m.map,
    gradientMap: ramp,
    transparent: m.transparent, opacity: m.opacity, side: m.side, depthWrite: m.depthWrite, alphaTest: m.alphaTest,
    emissive: m.emissive, emissiveIntensity: m.emissiveIntensity, emissiveMap: m.emissiveMap,
    vertexColors: m.vertexColors,
  });
  if (wood) {
    const r = m.map.repeat; t.map = plankTexture().clone(); t.map.repeat.set(Math.max(1, r.x), Math.max(1, r.y)); t.map.needsUpdate = true;
  }
  if (m.metalness > 0.5 && !m.map) t.color = m.color.getHSL({}).l > 0.25 ? GOLD.clone().lerp(brighter(m.color), 0.35) : GOLD.clone().multiplyScalar(0.8);
  t.name = m.name;
  t.userData = { ...m.userData, toon: true };
  if (m.onBeforeCompile && m.onBeforeCompile !== THREE.Material.prototype.onBeforeCompile) {
    t.onBeforeCompile = m.onBeforeCompile;
    if (Object.prototype.hasOwnProperty.call(m, 'customProgramCacheKey')) t.customProgramCacheKey = m.customProgramCacheKey;
  }
  converted.set(m, t);
  return t;
}

// Outline: the back faces of the same mesh, pushed out along the normals by a fixed amount on screen.
const outlineMat = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });
outlineMat.userData = { toon: true, outline: true };
outlineMat.onBeforeCompile = shader => {
  shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
    { vec3 vn = normalize(normalMatrix * normal); mvPosition.xyz += vn * 0.0042 * max(-mvPosition.z, 0.5); gl_Position = projectionMatrix * mvPosition; }`);
};
outlineMat.customProgramCacheKey = () => 'ink-outline';

function wantsOutline(o) {
  if (o.userData.noOutline || !o.geometry || !o.geometry.attributes.normal) return false;
  const mats = [o.material].flat();
  if (mats.some(m => !m || (m.transparent && !m.userData.forceOutline) || m.side === THREE.DoubleSide || m.isShaderMaterial || m.isPointsMaterial || m.userData.outline || m.userData.noOutline)) return false;
  if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
  const s = new THREE.Vector3(); o.getWorldScale(s);
  const r = o.geometry.boundingSphere.radius * Math.max(s.x, s.y, s.z);
  return r > 0.012 && r < 1.4; // not specks, not walls and floor
}
function addOutline(o) {
  const l = o.isSkinnedMesh ? new THREE.SkinnedMesh(o.geometry, outlineMat) : new THREE.Mesh(o.geometry, outlineMat);
  if (o.isSkinnedMesh) l.bind(o.skeleton, o.bindMatrix);
  // morph-animated models (the parrot flaps its wings this way): the outline must move with them, not stay in the rest pose
  if (o.morphTargetInfluences) { l.morphTargetInfluences = o.morphTargetInfluences; l.morphTargetDictionary = o.morphTargetDictionary; }
  l.name = 'obrys';
  l.userData.outline = true;
  l.raycast = () => {};
  l.castShadow = false; l.receiveShadow = false;
  l.renderOrder = o.renderOrder;
  o.add(l);
  return l;
}

export function toonify(root, { outlines = true } = {}) {
  if (!root) return root;
  root.updateWorldMatrix(true, true);
  const meshes = [];
  root.traverse(o => { if (o.isMesh && !o.userData.outline && !o.userData.toonDone) meshes.push(o); });
  for (const o of meshes) {
    // toon shading needs normals (some models were lit flat without them)
    if (o.geometry && !o.geometry.attributes.normal && o.geometry.attributes.position) o.geometry.computeVertexNormals();
    o.material = Array.isArray(o.material) ? o.material.map(toonMaterial) : toonMaterial(o.material);
    o.userData.toonDone = true;
    if (outlines && !o.isInstancedMesh && wantsOutline(o)) addOutline(o);
  }
  return root;
}

// One cheerful colour for a whole model that is too dark and grey for the cartoon look (catalog: ton).
export function tint(root, color) {
  root.traverse(o => {
    if (!o.isMesh || o.userData.outline) return;
    o.material = [o.material].flat().map(m => {
      if (!m.isMeshToonMaterial) return m;
      const t = m.clone();
      t.map = null;
      t.color = brighter(new THREE.Color(color));
      return t;
    });
    if (o.material.length === 1) o.material = o.material[0];
  });
  return root;
}

// Soft bright light for the toon look (no reflections, no tone mapping).
export function cartoonLights(scene, renderer) {
  scene.environment = null;
  scene.background = new THREE.Color(BACKGROUND);
  scene.traverse(o => {
    if (o.isHemisphereLight) { o.intensity = 1.6; o.color.set(0xfff4f8); o.groundColor.set(0xd9b8e6); }
    if (o.isDirectionalLight) o.intensity *= 1.25;
  });
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.toneMappingExposure = 1;
}
