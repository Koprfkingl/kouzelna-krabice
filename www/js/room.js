// A child's bedroom around the magic box: wallpaper, a window with curtains, a shelf with books,
// a garland, a fluffy rug and a few real furniture models from the catalog.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Merges geometries of different kinds (indexed or not) into one, keeping position, normal and uv.
function mergeAll(geos) {
  return mergeGeometries(geos.map(g => {
    const n = g.index ? g.toNonIndexed() : g;
    for (const k of Object.keys(n.attributes)) if (!['position', 'normal', 'uv'].includes(k)) n.deleteAttribute(k);
    n.clearGroups();
    return n;
  }));
}

function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}

function star(g, x, y, r, n = 5) {
  g.beginPath();
  for (let i = 0; i <= n * 2; i++) {
    const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2, rr = i % 2 ? r * 0.45 : r;
    i ? g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr) : g.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  g.fill();
}

// Wallpapers and rugs the child can pick for stars (tapety.js); the first of each is the original look.
const seeded = seed => { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; };
const heart = (g, x, y, r) => { g.beginPath(); g.moveTo(x, y + r * 0.9); g.bezierCurveTo(x - r * 1.6, y - r * 0.2, x - r * 0.6, y - r * 1.3, x, y - r * 0.4); g.bezierCurveTo(x + r * 0.6, y - r * 1.3, x + r * 1.6, y - r * 0.2, x, y + r * 0.9); g.fill(); };
const blob = (g, x, y, r) => { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); };
const WALLS = {
  srdicka(g, w, h) {
    g.fillStyle = '#fde8ef'; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 128) { g.fillStyle = 'rgba(255,190,214,0.45)'; g.fillRect(x, 0, 64, h); }
    const r = seeded(11);
    for (let i = 0; i < 22; i++) { g.fillStyle = ['#ff6f9f', '#ffb3cb', '#c88cff'][i % 3]; heart(g, r() * w, r() * h, 10 + r() * 6); }
  },
  oblacky(g, w, h) {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#bfe3ff'); gr.addColorStop(1, '#e6f4ff');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    const r = seeded(5); g.fillStyle = 'rgba(255,255,255,0.95)';
    for (let i = 0; i < 9; i++) { const x = r() * w, y = r() * h, s = 0.6 + r() * 0.6; for (const [dx, dy, rr] of [[0, 0, 22], [22, -8, 26], [46, 2, 20], [24, 10, 22]]) blob(g, x + dx * s, y + dy * s, rr * s); }
    for (let i = 0; i < 5; i++) { g.fillStyle = '#ffd84d'; star(g, r() * w, r() * h, 8); g.fillStyle = 'rgba(255,255,255,0.95)'; }
  },
  lesik(g, w, h) {
    g.fillStyle = '#e8f6e3'; g.fillRect(0, 0, w, h);
    const r = seeded(3);
    for (let i = 0; i < 14; i++) {
      const x = r() * w, y = r() * h, s = 0.7 + r() * 0.5;
      g.fillStyle = '#a0704a'; g.fillRect(x - 3 * s, y + 18 * s, 6 * s, 14 * s);
      g.fillStyle = ['#7cc576', '#5fae5a', '#9ad48f'][i % 3];
      g.beginPath(); g.moveTo(x, y - 22 * s); g.lineTo(x - 18 * s, y + 20 * s); g.lineTo(x + 18 * s, y + 20 * s); g.fill();
    }
    for (let i = 0; i < 10; i++) { g.fillStyle = '#ff6f6f'; blob(g, r() * w, r() * h, 5); }
  },
  vesmir(g, w, h) {
    g.fillStyle = '#2b2a5c'; g.fillRect(0, 0, w, h);
    const r = seeded(9);
    for (let i = 0; i < 70; i++) { g.fillStyle = `rgba(255,255,255,${0.4 + r() * 0.6})`; blob(g, r() * w, r() * h, 1 + r() * 2); }
    for (let i = 0; i < 10; i++) { g.fillStyle = '#ffe36e'; star(g, r() * w, r() * h, 7 + r() * 5); }
    for (const [c, ring] of [['#ff9f6e', true], ['#7fd0ff', false], ['#c99bff', true]]) {
      const x = r() * w, y = r() * h, rr = 16 + r() * 10; g.fillStyle = c; blob(g, x, y, rr);
      if (ring) { g.strokeStyle = '#ffe9b0'; g.lineWidth = 4; g.beginPath(); g.ellipse(x, y, rr * 1.7, rr * 0.45, -0.3, 0, Math.PI * 2); g.stroke(); }
    }
  },
  sliz(g, w, h) {
    g.fillStyle = '#eaffd6'; g.fillRect(0, 0, w, h);
    // slime dripping from the top of each tile
    for (let x = 0; x < w; x += 32) {
      const len = 30 + ((x * 37) % 90);
      g.fillStyle = ['#7ee05a', '#5fd4a8', '#b8f05a'][(x / 32) % 3];
      g.fillRect(x, 0, 32, 18); g.fillRect(x + 8, 0, 16, len); blob(g, x + 16, len, 9);
    }
    const r = seeded(13);
    for (let i = 0; i < 16; i++) { g.fillStyle = 'rgba(126,224,90,0.35)'; blob(g, r() * w, 140 + r() * (h - 140), 6 + r() * 10); }
  },
};
const RUGS = {
  duha(g, w) { ['#ff6f6f', '#ffa94d', '#ffe066', '#69db7c', '#4dabf7', '#9775fa', '#fff3f7'].forEach((c, i, a) => { g.fillStyle = c; blob(g, w / 2, w / 2, w / 2 * (1 - i / a.length)); }); },
  kytka(g, w) {
    g.fillStyle = '#fff6d6'; blob(g, w / 2, w / 2, w / 2);
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; g.fillStyle = i % 2 ? '#ffb3cb' : '#ff8fb3'; blob(g, w / 2 + Math.cos(a) * w * 0.27, w / 2 + Math.sin(a) * w * 0.27, w * 0.17); }
    g.fillStyle = '#ffd43b'; blob(g, w / 2, w / 2, w * 0.15);
  },
  sliz(g, w) {
    g.fillStyle = '#c3f7a0'; blob(g, w / 2, w / 2, w / 2);
    g.fillStyle = '#8be05a'; blob(g, w / 2, w / 2, w * 0.4);
    const r = seeded(21);
    for (let i = 0; i < 14; i++) { g.fillStyle = ['#5fd46a', '#b4f08a', '#e8ffd9'][i % 3]; blob(g, w * (0.2 + r() * 0.6), w * (0.2 + r() * 0.6), 10 + r() * 22); }
  },
  kocka(g, w) {
    g.fillStyle = '#ffd8a8'; blob(g, w / 2, w / 2, w / 2);
    g.fillStyle = '#ffc078'; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(w / 2 + s * w * 0.18, w * 0.2); g.lineTo(w / 2 + s * w * 0.4, w * 0.05); g.lineTo(w / 2 + s * w * 0.38, w * 0.33); g.fill(); }
    g.fillStyle = '#3b2552'; for (const s of [-1, 1]) blob(g, w / 2 + s * w * 0.15, w * 0.45, w * 0.05);
    g.fillStyle = '#ff8fb3'; blob(g, w / 2, w * 0.56, w * 0.035);
    g.strokeStyle = '#3b2552'; g.lineWidth = 5;
    for (const s of [-1, 1]) for (const d of [-0.04, 0.03]) { g.beginPath(); g.moveTo(w / 2 + s * w * 0.08, w * (0.6 + d)); g.lineTo(w / 2 + s * w * 0.32, w * (0.57 + d * 2)); g.stroke(); }
  },
};
export const WALL_IDS = ['zakladni', ...Object.keys(WALLS)], RUG_IDS = ['zakladni', ...Object.keys(RUGS)];

function wallpaper(id = 'zakladni') {
  if (WALLS[id]) return canvasTex(512, 512, WALLS[id], [4, 2.6]);
  return canvasTex(512, 512, (g, w, h) => {
    // soft mint stripes
    g.fillStyle = '#f3e9f2'; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 64) { g.fillStyle = 'rgba(190,226,218,0.45)'; g.fillRect(x, 0, 32, h); }
    // little stars and moons
    const rnd = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
    for (let i = 0; i < 18; i++) {
      const x = rnd() * w, y = rnd() * h;
      g.fillStyle = ['#f6c85f', '#f29bc0', '#9cc7f0', '#b9a3e8'][i % 4];
      if (i % 5 === 0) { g.beginPath(); g.arc(x, y, 12, 0, Math.PI * 2); g.fill(); g.fillStyle = '#f3e9f2'; g.beginPath(); g.arc(x + 6, y - 4, 11, 0, Math.PI * 2); g.fill(); }
      else star(g, x, y, 9 + rnd() * 5);
    }
  }, [4, 2.6]);
}

function skyTexture() {
  return canvasTex(256, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#5fa8ff'); gr.addColorStop(0.7, '#bfe3ff'); gr.addColorStop(1, '#e8f6ff');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.9)';
    for (const [x, y, s] of [[60, 70, 1], [180, 120, 0.8], [110, 180, 0.6]]) {
      for (const [dx, dy, r] of [[0, 0, 22], [22, -8, 26], [46, 2, 20], [24, 10, 22]]) { g.beginPath(); g.arc(x + dx * s, y + dy * s, r * s, 0, Math.PI * 2); g.fill(); }
    }
    // a tree top
    g.fillStyle = '#5fae5a'; g.beginPath(); g.arc(30, 250, 70, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#4c9a49'; g.beginPath(); g.arc(230, 260, 55, 0, Math.PI * 2); g.fill();
  });
}

function rugTexture(id = 'zakladni') {
  return canvasTex(512, 512, (g, w) => {
    if (RUGS[id]) RUGS[id](g, w);
    else {
      const cols = ['#f7c6d9', '#fbe3a4', '#bfe6dd', '#cdbcf0', '#f7c6d9', '#fff3f7'];
      for (let i = 0; i < cols.length; i++) {
        g.fillStyle = cols[i];
        g.beginPath(); g.arc(w / 2, w / 2, w / 2 * (1 - i / cols.length), 0, Math.PI * 2); g.fill();
      }
    }
    // woolly noise
    const img = g.getImageData(0, 0, w, w);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (Math.random() - 0.5) * 26;
      img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
    }
    g.putImageData(img, 0, 0);
  });
}

function bookSpine(color, title) {
  return canvasTex(64, 256, (g, w, h) => {
    g.fillStyle = color; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.75)'; g.fillRect(0, 22, w, 6); g.fillRect(0, h - 28, w, 6);
    g.save(); g.translate(w / 2 + 6, h / 2); g.rotate(-Math.PI / 2);
    g.font = 'bold 26px sans-serif'; g.textAlign = 'center'; g.fillText(title, 0, 0); g.restore();
  });
}

function pictureTexture() {
  return canvasTex(256, 200, (g, w, h) => {
    g.fillStyle = '#fffaf0'; g.fillRect(0, 0, w, h);
    // a child's drawing: sun, house, flowers
    g.fillStyle = '#ffd23f'; g.beginPath(); g.arc(205, 45, 26, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#ffd23f'; g.lineWidth = 5;
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; g.beginPath(); g.moveTo(205 + Math.cos(a) * 32, 45 + Math.sin(a) * 32); g.lineTo(205 + Math.cos(a) * 44, 45 + Math.sin(a) * 44); g.stroke(); }
    g.fillStyle = '#ff7a8a'; g.fillRect(50, 95, 90, 70);
    g.fillStyle = '#7a4fd6'; g.beginPath(); g.moveTo(40, 98); g.lineTo(95, 50); g.lineTo(150, 98); g.fill();
    g.fillStyle = '#5ab0ff'; g.fillRect(70, 112, 22, 22); g.fillStyle = '#8a5a2b'; g.fillRect(105, 125, 22, 40);
    g.fillStyle = '#4caf50'; g.fillRect(0, 165, w, 35);
    for (const x of [170, 200, 230]) { g.fillStyle = '#e91e63'; g.beginPath(); g.arc(x, 155, 8, 0, Math.PI * 2); g.fill(); }
  });
}

const BED = { x: -3.7, len: 1.85, w: 1.0 };
const softMat = (color, o = {}) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.85, sheen: 0.6, sheenColor: 0xffffff, sheenRoughness: 0.6, ...o });

function duvetTexture() {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#f7b8d2'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < 6; y++) for (let x = 0; x < 6; x++) {
      g.fillStyle = (x + y) % 2 ? '#fff4f8' : '#ffd36e';
      if ((x + y) % 3 === 0) star(g, x * 44 + 22 + (y % 2) * 10, y * 44 + 22, 10); else { g.beginPath(); g.arc(x * 44 + 22, y * 44 + 22, 6, 0, Math.PI * 2); g.fill(); }
    }
  }, [2, 2]);
}

// A little bed along the left wall: white wooden frame with a heart, mattress, starry duvet and a pillow.
function makeBed(BACK) {
  const g = new THREE.Group();
  const z0 = BACK + 0.08, zc = z0 + BED.len / 2;
  g.position.set(BED.x, 0, zc);
  const wood = new THREE.MeshStandardMaterial({ color: 0xfbf3ea, roughness: 0.5 });
  // the wooden parts are merged into one mesh (one draw call instead of thirty)
  const woodParts = [];
  const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; if (mat === wood) woodParts.push(m); else g.add(m); return m; };
  const hw = BED.w / 2 + 0.05, hl = BED.len / 2;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(new THREE.CylinderGeometry(0.045, 0.05, sz < 0 ? 1.15 : 0.75, 16), wood, sx * hw, (sz < 0 ? 1.15 : 0.75) / 2, sz * hl);
  for (const sz of [-1, 1]) for (const sy of [0, 1]) add(new THREE.CylinderGeometry(0.03, 0.03, hw * 2, 12), wood, 0, sz < 0 ? 0.4 + sy * 0.66 : 0.4 + sy * 0.3, sz * hl).rotation.z = Math.PI / 2;
  // bars of the head and foot
  for (const sz of [-1, 1]) for (let i = -3; i <= 3; i++) add(new THREE.CylinderGeometry(0.018, 0.018, sz < 0 ? 0.66 : 0.3, 8), wood, i * hw / 4, sz < 0 ? 0.73 : 0.55, sz * hl);
  for (const sx of [-1, 1]) add(new RoundedBoxGeometry(0.06, 0.14, BED.len, 2, 0.02), wood, sx * hw, 0.3, 0);
  add(new RoundedBoxGeometry(BED.w, 0.16, BED.len - 0.04, 3, 0.05), softMat(0xffffff), 0, 0.4, 0);
  // heart on the headboard
  const heart = new THREE.Shape();
  heart.moveTo(0, -0.1); heart.bezierCurveTo(-0.16, 0.02, -0.08, 0.15, 0, 0.07); heart.bezierCurveTo(0.08, 0.15, 0.16, 0.02, 0, -0.1);
  add(new THREE.ExtrudeGeometry(heart, { depth: 0.02, bevelEnabled: true, bevelSize: 0.01, bevelThickness: 0.01, bevelSegments: 2 }), new THREE.MeshPhysicalMaterial({ color: 0xff5f9e, roughness: 0.35, clearcoat: 0.6 }), 0, 1.0, -hl + 0.03);
  // duvet over the foot two thirds, folded edge, pillow at the head
  const duvet = add(new RoundedBoxGeometry(BED.w + 0.06, 0.09, BED.len * 0.68, 3, 0.04), softMat(0xffffff, { map: duvetTexture() }), 0, 0.52, hl - BED.len * 0.34 - 0.02);
  duvet.rotation.x = 0.01;
  add(new RoundedBoxGeometry(BED.w + 0.07, 0.1, 0.16, 3, 0.045), softMat(0xfff4f8), 0, 0.55, hl - BED.len * 0.68);
  const pillow = add(new RoundedBoxGeometry(0.62, 0.13, 0.34, 4, 0.06), softMat(0xbfe6dd), 0, 0.54, -hl + 0.3);
  pillow.rotation.x = -0.18;
  const merged = new THREE.Mesh(mergeAll(woodParts.map(m => { m.updateMatrix(); return m.geometry.clone().applyMatrix4(m.matrix); })), wood);
  merged.castShadow = merged.receiveShadow = true;
  g.add(merged);
  g.userData.bed = true;
  g.userData.duvet = duvet; g.userData.pillow = pillow; // monsters mess these up (neporadek.js)
  return g;
}

// A shelf for trophies: reading ranks and monster collection medals stand here (see main.js).
function makeTrophyShelf(BACK) {
  const g = new THREE.Group();
  g.position.set(3.3, 0, BACK + 0.14);
  const mat = new THREE.MeshStandardMaterial({ color: 0xc7a2ff, roughness: 0.45 });
  const slots = [];
  for (const y of [1.2, 1.78]) {
    const b = new THREE.Mesh(new RoundedBoxGeometry(1.55, 0.05, 0.26, 2, 0.015), mat);
    b.position.y = y; b.castShadow = b.receiveShadow = true; g.add(b);
    for (const s of [-1, 1]) { const br = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.12, 0.2), mat); br.position.set(s * 0.6, y - 0.08, -0.02); g.add(br); }
    for (let k = 0; k < 5; k++) slots.push(new THREE.Vector3(3.3 - 0.6 + k * 0.3, y + 0.025, BACK + 0.16));
  }
  return { group: g, slots };
}

// A low glass cabinet under the trophies with four compartments (fochy) for the secret spells.
const FOCH_COLORS = [0xffd1e3, 0xfff0b3, 0xc9ecff, 0xe3d4ff];
function makeVitrina(BACK) {
  const g = new THREE.Group();
  g.position.set(3.3, 0, BACK + 0.24);
  const W = 1.44, D = 0.4, T = 0.035, floors = [0.1, 0.53], top = 0.96;
  const mat = new THREE.MeshStandardMaterial({ color: 0x8fd8c4, roughness: 0.5 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xffc93c, metalness: 1, roughness: 0.3 });
  const box = (w, h, d, x, y, z, m = mat) => { const b = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, 0.01), m); b.position.set(x, y, z); b.castShadow = b.receiveShadow = true; g.add(b); return b; };
  for (const y of [floors[0] - T / 2, floors[1] - T / 2, top]) box(W, T, D, 0, y, 0);
  for (const x of [-W / 2, 0, W / 2]) box(T, top - floors[0] + T, D, x, (top + floors[0]) / 2, 0);
  for (const s of [-1, 1]) for (const z of [-1, 1]) box(0.05, 0.1, 0.05, s * (W / 2 - 0.05), 0.04, z * (D / 2 - 0.05));
  for (const s of [-1, 1]) { const k = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 8), gold); k.position.set(s * W / 2, top + 0.04, D / 2 - 0.04); g.add(k); }
  const fochy = [];
  let i = 0;
  for (const fy of [floors[1], floors[0]]) for (const fx of [-W / 4, W / 4]) {
    const back = new THREE.Mesh(new THREE.PlaneGeometry(W / 2 - T, 0.43 - T), new THREE.MeshStandardMaterial({ color: FOCH_COLORS[i], roughness: 0.8 }));
    back.position.set(fx, fy + 0.2, -D / 2 + 0.01);
    g.add(back);
    const slots = [-0.24, -0.08, 0.08, 0.24].map(dx => new THREE.Vector3(3.3 + fx + dx, fy, BACK + 0.24 + 0.02));
    fochy.push({ center: new THREE.Vector3(3.3 + fx, fy + 0.2, BACK + 0.24), slots });
    i++;
  }
  g.userData.pokoj = { kind: 'vitrina' };
  return { group: g, fochy };
}

function emptyFrameTexture() {
  return canvasTex(128, 160, (g, w, h) => {
    g.fillStyle = '#fff7fb'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#f2c4da'; g.lineWidth = 4; g.setLineDash([10, 8]); g.strokeRect(14, 14, w - 28, h - 28);
    g.fillStyle = '#f7c6d9'; g.font = '44px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('♥', w / 2, h / 2);
  });
}
const FRAME_COLORS = { r1: 0xffc1d9, r2: 0xffe08a, r3: 0x9ad3c8 };
function makeFrame(id) {
  const group = new THREE.Group();
  const frame = new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.6, 0.035, 2, 0.012), new THREE.MeshStandardMaterial({ color: FRAME_COLORS[id], roughness: 0.45 }));
  frame.castShadow = true;
  const empty = emptyFrameTexture();
  const img = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.5), new THREE.MeshStandardMaterial({ map: empty, roughness: 0.6 }));
  img.position.z = 0.019;
  group.add(frame, img);
  return { group, img, empty };
}

export function makeRoom(tex) {
  const room = new THREE.Group();
  const BACK = -2.6, SIDE = 4.4, HEIGHT = 4.2;

  // Floor: warm parquet
  const floorTex = {};
  for (const [k, t] of Object.entries(tex)) { floorTex[k] = t.clone(); floorTex[k].repeat.set(5.5, 4); floorTex[k].needsUpdate = true; }
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(SIDE * 2, 8), new THREE.MeshStandardMaterial({
    map: floorTex.wood, roughnessMap: floorTex.woodRough, bumpMap: floorTex.woodBump, bumpScale: 0.5, color: 0xdcb48c, roughness: 0.55,
  }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.z = 1.2;
  floor.receiveShadow = true;
  room.add(floor);

  // Walls with wallpaper
  const wallMat = new THREE.MeshStandardMaterial({ map: wallpaper(), roughness: 0.92 });
  const back = new THREE.Mesh(new THREE.PlaneGeometry(SIDE * 2, HEIGHT), wallMat);
  back.position.set(0, HEIGHT / 2, BACK);
  back.receiveShadow = true;
  room.add(back);
  for (const s of [-1, 1]) {
    const side = new THREE.Mesh(new THREE.PlaneGeometry(8, HEIGHT), wallMat);
    side.position.set(s * SIDE, HEIGHT / 2, 1.4);
    side.rotation.y = -s * Math.PI / 2;
    side.receiveShadow = true;
    room.add(side);
  }
  // Skirting board
  const white = new THREE.MeshStandardMaterial({ color: 0xfbf8f4, roughness: 0.45 });
  const skirt = new THREE.Mesh(new THREE.BoxGeometry(SIDE * 2, 0.12, 0.03), white);
  skirt.position.set(0, 0.06, BACK + 0.015);
  room.add(skirt);

  // Window on the left with sky, frame and curtains
  const win = new THREE.Group();
  win.position.set(-1.45, 1.85, BACK + 0.01);
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.3), new THREE.MeshBasicMaterial({ map: skyTexture() }));
  sky.position.z = -0.005;
  win.add(sky);
  const frameParts = [[1.32, 0.08, 0, 0.69], [1.32, 0.08, 0, -0.69], [0.08, 1.46, -0.62, 0], [0.08, 1.46, 0.62, 0], [0.04, 1.3, 0, 0], [1.2, 0.04, 0, 0.1]];
  for (const [w, h, x, y] of frameParts) {
    const f = new THREE.Mesh(new RoundedBoxGeometry(w, h, 0.08, 2, 0.015), white);
    f.position.set(x, y, 0.03);
    f.castShadow = true;
    win.add(f);
  }
  const sill = new THREE.Mesh(new RoundedBoxGeometry(1.5, 0.05, 0.22, 2, 0.02), white);
  sill.position.set(0, -0.75, 0.1);
  sill.castShadow = sill.receiveShadow = true;
  win.add(sill);
  // Curtains: wavy planes in pastel velvet
  const curtainMat = new THREE.MeshPhysicalMaterial({ color: 0xec7fae, roughness: 0.8, sheen: 1, sheenColor: 0xffd6e6, sheenRoughness: 0.5, side: THREE.DoubleSide });
  const curtains = [];
  for (const s of [-1, 1]) {
    const geo = new THREE.PlaneGeometry(0.42, 1.9, 24, 8);
    geo.userData.rest = Float32Array.from(geo.attributes.position.array);
    const c = new THREE.Mesh(geo, curtainMat);
    c.position.set(s * 0.8, -0.05, 0.3); // in front of the sill (0.21 deep), so it does not poke through
    c.castShadow = true;
    c.userData.phase = s > 0 ? 0 : 2.1;
    win.add(c);
    curtains.push(c);
  }
  // A gentle breeze: folds ripple and the hem swings a little (the top stays on the rod).
  const swayCurtains = t => {
    for (const c of curtains) {
      const pos = c.geometry.attributes.position, rest = c.geometry.userData.rest, ph = c.userData.phase;
      for (let i = 0; i < pos.count; i++) {
        const x = rest[i * 3], y = rest[i * 3 + 1];
        const down = (0.95 - y) / 1.9; // 0 at the rod, 1 at the hem
        pos.setX(i, x + Math.sin(t * 0.9 + ph) * 0.03 * down * down);
        pos.setZ(i, Math.sin(x * 38 + Math.sin(t * 0.7 + ph) * 0.8 * down) * 0.035 + Math.sin(t * 1.1 + ph + y * 2) * 0.05 * down * down);
      }
      pos.needsUpdate = true;
      c.geometry.computeVertexNormals();
    }
  };
  swayCurtains(0);
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 2.1, 12), new THREE.MeshStandardMaterial({ color: 0xd9a84e, metalness: 1, roughness: 0.3 }));
  rod.rotation.z = Math.PI / 2;
  rod.position.set(0, 0.92, 0.32);
  win.add(rod);
  room.add(win);
  // Daylight from the window
  const daylight = new THREE.PointLight(0xdcefff, 3.5, 6, 1.6);
  daylight.position.set(-1.45, 1.9, BACK + 0.6);
  room.add(daylight);

  // Shelf on the right with books
  const shelf = new THREE.Group();
  shelf.position.set(1.4, 1.55, BACK + 0.13);
  const board = new THREE.Mesh(new RoundedBoxGeometry(1.3, 0.05, 0.26, 2, 0.015), white);
  board.castShadow = board.receiveShadow = true;
  shelf.add(board);
  const board2 = board.clone(); board2.position.y = 0.62; shelf.add(board2);
  const books = [['#e85d75', 'POHÁDKY'], ['#5b8def', 'ZVÍŘÁTKA'], ['#f2b134', 'ABECEDA'], ['#6cc08b', 'LES'], ['#a070e0', 'HVĚZDY'], ['#ff8a5c', 'KOČKA']];
  let bx = -0.55;
  books.forEach(([c, t], i) => {
    const h = 0.28 + (i % 3) * 0.04, w = 0.07 + (i % 2) * 0.02;
    const spine = bookSpine(c, t);
    const m = [new THREE.MeshStandardMaterial({ color: c, roughness: 0.6 }), new THREE.MeshStandardMaterial({ color: c, roughness: 0.6 }),
      new THREE.MeshStandardMaterial({ color: 0xf5f0e6, roughness: 0.9 }), new THREE.MeshStandardMaterial({ color: 0xf5f0e6, roughness: 0.9 }),
      new THREE.MeshStandardMaterial({ map: spine, roughness: 0.55 }), new THREE.MeshStandardMaterial({ color: c, roughness: 0.6 })];
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.2), m);
    b.position.set(bx + w / 2, 0.025 + h / 2, 0);
    if (i === books.length - 1) { b.rotation.z = -0.25; b.position.x += 0.04; }
    b.castShadow = true;
    shelf.add(b);
    bx += w + 0.008;
  });
  room.add(shelf);

  // A framed child's drawing
  const pic = new THREE.Group();
  pic.position.set(0.15, 2.45, BACK + 0.02);
  pic.rotation.z = 0.03;
  const pframe = new THREE.Mesh(new RoundedBoxGeometry(0.7, 0.56, 0.03, 2, 0.01), new THREE.MeshStandardMaterial({ color: 0x9ad3c8, roughness: 0.5 }));
  const pimg = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.47), new THREE.MeshStandardMaterial({ map: pictureTexture(), roughness: 0.85 }));
  pimg.position.z = 0.016;
  pic.add(pframe, pimg);
  room.add(pic);

  // Bunting garland across the wall
  const flagCols = [0xf29bc0, 0xf6c85f, 0x9cc7f0, 0xa8e0b8, 0xc7a2ff];
  const flagGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-0.09, 0, 0), new THREE.Vector3(0.09, 0, 0), new THREE.Vector3(0, -0.2, 0)]);
  flagGeo.computeVertexNormals();
  const N = 15;
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1), x = -2.6 + t * 5.2, y = 3.05 - Math.sin(t * Math.PI) * 0.35;
    const f = new THREE.Mesh(flagGeo, new THREE.MeshStandardMaterial({ color: flagCols[i % flagCols.length], roughness: 0.8, side: THREE.DoubleSide }));
    f.position.set(x, y, BACK + 0.06);
    f.rotation.z = Math.cos(t * Math.PI) * 0.3;
    f.castShadow = true;
    room.add(f);
  }

  // Fluffy round rug under the box
  const rug = new THREE.Mesh(new THREE.CircleGeometry(1.75, 96), new THREE.MeshPhysicalMaterial({
    map: rugTexture(), roughness: 1, sheen: 1, sheenColor: 0xffffff, sheenRoughness: 0.8,
  }));
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(0, 0.006, -0.25);
  rug.receiveShadow = true;
  room.add(rug);
  // new wallpaper or rug (tapety.js)
  // (the mesh's material at that moment: the cartoon look replaces the original one)
  const swap = (mesh, tex) => { const mat = mesh.material, old = mat.map; mat.map = tex; mat.needsUpdate = true; if (old) old.dispose(); };
  room.userData.setWall = id => swap(back, wallpaper(id));
  room.userData.setRug = id => swap(rug, rugTexture(id));
  room.userData.wallTex = id => wallpaper(id).image; // canvases for the previews
  room.userData.rugTex = id => rugTexture(id).image;

  // Spots for real furniture models (filled in by main.js once they load)
  room.userData.props = [
    { id: 'kytka', pos: new THREE.Vector3(-2.4, 0, BACK + 0.45), size: 1.0, rot: 0.4 },
    { id: 'taburet', pos: new THREE.Vector3(2.15, 0, -1.2), size: 0.75, rot: 0.3 },
  ];
  // the pouf gets a spot on top once its model is in (see main.js)
  room.userData.props[1].spot = { id: 'taburet', size: 0.55 };

  room.userData.bed = makeBed(BACK);
  room.add(room.userData.bed);
  const trophies = makeTrophyShelf(BACK);
  room.add(trophies.group);
  room.userData.trophySlots = trophies.slots;
  const vitrina = makeVitrina(BACK);
  room.add(vitrina.group);
  room.userData.vitrina = vitrina;

  // Empty picture frames: the child hangs photos and monster pictures in them.
  room.userData.frames = [
    { id: 'r1', pos: new THREE.Vector3(-4.0, 1.75, BACK + 0.02), rot: -0.04 },
    { id: 'r2', pos: new THREE.Vector3(-3.35, 2.08, BACK + 0.02), rot: 0.05 },
    { id: 'r3', pos: new THREE.Vector3(3.3, 2.6, BACK + 0.02), rot: -0.03 },
  ].map(f => { const fr = makeFrame(f.id); fr.group.position.copy(f.pos); fr.group.rotation.z = f.rot; room.add(fr.group); return { ...f, ...fr }; });

  // Places where the child can put things to decorate the room.
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  room.userData.spots = [
    { id: 'polstar', pos: V(BED.x, 0.64, BACK + 0.45), size: 0.5, rot: 0.2 },
    { id: 'perina', pos: V(BED.x, 0.58, BACK + 1.45), size: 0.55, rot: 0.6 },
    { id: 'polickaA', pos: V(1.75, 1.575, BACK + 0.13), size: 0.38, rot: -0.4 },
    { id: 'polickaB', pos: V(1.1, 2.195, BACK + 0.13), size: 0.38, rot: 0.2 },
    { id: 'polickaC', pos: V(1.72, 2.195, BACK + 0.13), size: 0.4, rot: 0 },
    { id: 'zemA', pos: V(-1.9, 0, 0.75), size: 0.75, rot: 0.6 },
    { id: 'zemB', pos: V(2.75, 0, 0.45), size: 0.75, rot: -0.6 },
    { id: 'zemC', pos: V(3.75, 0, -1.35), size: 0.75, rot: -0.2 },
    { id: 'zemD', pos: V(-2.75, 0, -0.35), size: 0.75, rot: 0.5 },
  ];
  room.userData.swaying = []; // props that sway (the plant), added by the game
  room.userData.update = t => {
    swayCurtains(t);
    for (const g of room.userData.swaying) g.rotation.z = Math.sin(t * 0.8 + g.position.x) * 0.035, g.rotation.x = Math.sin(t * 0.55) * 0.02;
  };
  return room;
}
