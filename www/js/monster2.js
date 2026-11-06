// Second generation of cute monsters: many more body shapes, skins, colours, eyes and accessories.
// A seed always gives the same monster, so the album still only stores the seed.
import * as THREE from 'three';
import { monsterName } from './catalog.js';
import { rng, canvasTex, makeFur, vnoise } from './monster.js';

const COLORS = [0xff8fb8, 0x8fd3ff, 0xa8f0a0, 0xffd36e, 0xc7a2ff, 0xff9f7a, 0x7ff0e0, 0xffb3e6, 0x9fb8ff, 0xf6f08a,
  0x5fd4a8, 0x4fc3f7, 0xb388ff, 0xff7aa8, 0xffc04d, 0x9ee35a, 0x5f8dff, 0xff6f61, 0x48d1cc, 0xe57bff, 0x9be7ff, 0xffe0a3];
const IRIS = [0x3a8dde, 0x5bbf5a, 0x8b5a2b, 0xb05fe0, 0xe08a2b, 0x20b2aa, 0xe0407a, 0xd4a017, 0x1e90ff, 0x7b3fe4];

function eyeTex(iris, slit, rand) {
  return canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = '#fbfbf8'; g.fillRect(0, 0, w, h);
    const cx = w * 0.25, cy = h * 0.5, R = h * (0.17 + rand() * 0.06);
    const c = new THREE.Color(iris);
    const gr = g.createRadialGradient(cx, cy, R * 0.2, cx, cy, R);
    gr.addColorStop(0, c.clone().lerp(new THREE.Color(1, 1, 1), 0.4).getStyle()); gr.addColorStop(0.6, c.getStyle()); gr.addColorStop(1, c.clone().multiplyScalar(0.4).getStyle());
    g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.2)'; g.lineWidth = 1.2;
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * Math.PI * 2;
      g.beginPath(); g.moveTo(cx + Math.cos(a) * R * 0.45, cy + Math.sin(a) * R * 0.45); g.lineTo(cx + Math.cos(a) * R * 0.95, cy + Math.sin(a) * R * 0.95); g.stroke();
    }
    g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 3; g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#060608';
    g.beginPath();
    if (slit) g.ellipse(cx, cy, R * 0.16, R * 0.75, 0, 0, Math.PI * 2); else g.arc(cx, cy, R * 0.48, 0, Math.PI * 2);
    g.fill();
  });
}

// Skin pictures wrapped around the sphere (u = 0.25 is the front).
function skinTexture(kind, base, accent, rand) {
  const B = new THREE.Color(base).getStyle(), A = new THREE.Color(accent).getStyle();
  return canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = B; g.fillRect(0, 0, w, h);
    g.fillStyle = A; g.strokeStyle = A;
    if (kind === 'stripes') {
      const n = 6 + Math.floor(rand() * 6), wob = rand() * 10;
      for (let i = 0; i < n; i++) {
        const x0 = (i / n) * w;
        g.beginPath();
        for (let y = 0; y <= h; y += 8) g.lineTo(x0 + Math.sin(y * 0.05 + i) * wob, y);
        for (let y = h; y >= 0; y -= 8) g.lineTo(x0 + w / n * 0.42 + Math.sin(y * 0.05 + i) * wob, y);
        g.fill();
      }
    } else if (kind === 'polka') {
      const r = 9 + rand() * 8;
      for (let y = r; y < h; y += r * 3) for (let x = (Math.round(y / (r * 3)) % 2) * r * 1.5; x < w + r; x += r * 3) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
    } else if (kind === 'scales') {
      const r = 12;
      g.lineWidth = 2.5;
      for (let y = 0, row = 0; y < h + r; y += r * 0.9, row++) for (let x = (row % 2) * r; x < w + r; x += r * 2) {
        const gr = g.createRadialGradient(x, y, 2, x, y, r);
        gr.addColorStop(0, B); gr.addColorStop(1, A);
        g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI); g.fill();
      }
    } else if (kind === 'spots') {
      const n = 12 + Math.floor(rand() * 14);
      for (let i = 0; i < n; i++) {
        const x = rand() * w, y = h * (0.12 + rand() * 0.76), r = 8 + rand() * 26;
        g.beginPath(); g.ellipse(x, y, r * 1.3, r, rand() * 3, 0, Math.PI * 2); g.fill();
      }
    }
    if (kind === 'belly' || rand() < 0.3) {
      // a lighter tummy patch on the front
      g.fillStyle = new THREE.Color(base).lerp(new THREE.Color(1, 1, 1), 0.55).getStyle();
      g.beginPath(); g.ellipse(w * 0.25, h * 0.66, w * 0.09, h * 0.2, 0, 0, Math.PI * 2); g.fill();
    }
  });
}

export function makeMonster2(seed, opts = {}) {
  const rand = rng(seed);
  const r = () => rand();
  const pick = a => a[Math.floor(r() * a.length)];
  const chance = p => r() < p;
  const monster = new THREE.Group();
  const name = monsterName(rand); // first, like generation 1, so names stay stable

  // ---- colours ----
  const baseColor = new THREE.Color(pick(COLORS));
  if (opts.tint) baseColor.lerp(new THREE.Color(opts.tint), 0.5);
  const hsl = {}; baseColor.getHSL(hsl);
  baseColor.setHSL(hsl.h, Math.max(0.5, hsl.s), Math.min(0.7, Math.max(0.48, hsl.l)));
  const accent = new THREE.Color().setHSL((hsl.h + pick([0.08, 0.5, 0.33, 0.66, 0.15]) + r() * 0.06) % 1, 0.75, chance(0.5) ? 0.4 : 0.66);

  // ---- body shape ----
  const shape = pick(['ball', 'egg', 'pear', 'tall', 'wide', 'bean', 'lumpy', 'egg', 'pear']);
  let sx = 1, sy = 1, sz = 0.9, pear = 0, bumps = 0.04, bend = 0;
  if (shape === 'ball') { sx = 1.05; sy = 1.0; }
  if (shape === 'egg') { sx = 0.9; sy = 1.25; pear = -0.15; }
  if (shape === 'pear') { sx = 1.05; sy = 1.2; pear = 0.32; }
  if (shape === 'tall') { sx = 0.72; sy = 1.65; sz = 0.72; pear = 0.1; }
  if (shape === 'wide') { sx = 1.5; sy = 0.78; sz = 0.95; }
  if (shape === 'bean') { sx = 0.95; sy = 1.3; bend = 0.25; }
  if (shape === 'lumpy') { sx = 1.05; sy = 1.1; bumps = 0.11; }
  sx *= 0.92 + r() * 0.16; sy *= 0.92 + r() * 0.16;

  const skin = pick(['fur', 'fur', 'furTips', 'velvet', 'jelly', 'spots', 'stripes', 'polka', 'scales', 'pearl', 'belly', 'stripes']);
  if (skin === 'jelly') bumps = Math.min(bumps, 0.02);
  const rn = [1 + r() * 2, 1 + r() * 2, 1 + r() * 2, r() * 6, r() * 6, r() * 6];
  const geo = new THREE.SphereGeometry(0.5, 72, 48);
  const pos = geo.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const k = 1 + pear * (-v.y * 2) + bumps * vnoise(v.x * 4, v.y * 4, v.z * 4, rn);
    v.set(v.x * sx * k, v.y * sy, v.z * sz * k);
    v.z += bend * (v.y * v.y * 2 - 0.2);
    if (v.y < -0.38 * sy) v.y = -0.38 * sy + (v.y + 0.38 * sy) * 0.3; // flat-ish bottom
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  geo.computeBoundingBox();
  const bottom = geo.boundingBox.min.y, top = geo.boundingBox.max.y;

  let bodyMat;
  if (skin === 'jelly') bodyMat = new THREE.MeshPhysicalMaterial({ color: baseColor, roughness: 0.1, transparent: true, opacity: 0.82, clearcoat: 1, clearcoatRoughness: 0.05, emissive: baseColor, emissiveIntensity: 0.2 });
  else if (skin === 'velvet') bodyMat = new THREE.MeshPhysicalMaterial({ color: baseColor, roughness: 0.75, sheen: 1, sheenRoughness: 0.45, sheenColor: baseColor.clone().lerp(new THREE.Color(1, 1, 1), 0.5) });
  else if (skin === 'pearl') bodyMat = new THREE.MeshPhysicalMaterial({ color: baseColor.clone().lerp(new THREE.Color(1, 1, 1), 0.25), roughness: 0.22, metalness: 0.1, iridescence: 1, iridescenceIOR: 1.35, iridescenceThicknessRange: [200, 600], clearcoat: 0.8 });
  else if (['spots', 'stripes', 'polka', 'scales', 'belly'].includes(skin)) {
    const map = skinTexture(skin, baseColor, accent, rand);
    bodyMat = new THREE.MeshPhysicalMaterial({ map, roughness: skin === 'scales' ? 0.3 : 0.45, clearcoat: skin === 'scales' ? 0.9 : 0.5, clearcoatRoughness: 0.25,
      bumpMap: skin === 'scales' ? map : null, bumpScale: 2 });
  } else bodyMat = new THREE.MeshStandardMaterial({ color: baseColor.clone().multiplyScalar(0.8), roughness: 0.9 });
  const body = new THREE.Mesh(geo, bodyMat);
  body.castShadow = true; body.receiveShadow = true;
  const bodyGroup = new THREE.Group();
  bodyGroup.add(body);
  let furLen = 0;
  if (skin === 'fur' || skin === 'furTips') {
    const long = chance(0.45);
    furLen = long ? 0.09 : 0.05;
    const fur = makeFur(geo, baseColor, furLen, long ? 12 : 10, new THREE.Vector2(long ? 34 : 48, long ? 17 : 24));
    if (skin === 'furTips') fur.children.forEach((m, i, a) => m.material.color.copy(baseColor).lerp(accent, (i / a.length) ** 2));
    bodyGroup.add(fur);
  }
  monster.add(bodyGroup);
  const softMat = c => skin.startsWith('fur') ? new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 }) : new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.45, clearcoat: 0.5 });
  const limbColor = chance(0.3) ? accent : baseColor.clone().multiplyScalar(0.88);
  const limbMat = softMat(limbColor);

  const ray = new THREE.Raycaster();
  const furPad = furLen * 0.8;
  const surface = dir => {
    dir.normalize();
    ray.set(dir.clone().multiplyScalar(3), dir.clone().negate());
    const hit = ray.intersectObject(body, false)[0];
    return hit ? { p: hit.point.clone(), n: hit.face.normal.clone() } : { p: dir.clone().multiplyScalar(0.5), n: dir.clone() };
  };
  const place = (obj, dir, out = 0) => { const s = surface(dir); obj.position.copy(s.p).addScaledVector(s.n, out); return s; };
  const orient = (obj, n, extraUp = 0) => obj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n.clone().add(new THREE.Vector3(0, extraUp, 0)).normalize());
  const wobblers = []; // parts that sway in update()

  // ---- eyes ----
  const eyeCount = pick([1, 2, 2, 3, 3, 3, 3, 4, 5]);
  const stalks = eyeCount <= 3 && chance(0.2);
  const iris = pick(IRIS), slit = chance(0.2);
  const eyeMat = new THREE.MeshPhysicalMaterial({ map: eyeTex(iris, slit, rand), roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.02 });
  const lidMat = softMat(baseColor.clone().multiplyScalar(0.85));
  const eyes = [];
  const faceY = (shape === 'tall' ? 0.25 : 0.12) * sy + r() * 0.06;
  const big = eyeCount === 1 ? 0.21 + r() * 0.06 : eyeCount === 2 ? 0.13 + r() * 0.05 : eyeCount === 3 ? 0.105 + r() * 0.03 : 0.085 + r() * 0.02;
  let layout;
  if (eyeCount === 1) layout = [[0, 0, 1]];
  else if (eyeCount === 2) layout = [[-1, 0, 1], [1, 0, 1]];
  else if (eyeCount === 3) layout = pick([[[-1.25, 0, 1], [0, 0.05, 1.15], [1.25, 0, 1]], [[-1, -0.6, 1], [1, -0.6, 1], [0, 1.0, 1.25]], [[-1.1, 0, 0.85], [0, 0.6, 1.3], [1.1, 0, 0.85]]]);
  else if (eyeCount === 4) layout = [[-1, 0.55, 1], [1, 0.55, 1], [-1.15, -0.55, 0.8], [1.15, -0.55, 0.8]];
  else layout = [[-2, -0.4, 0.8], [-1, 0.25, 0.95], [0, 0.5, 1.15], [1, 0.25, 0.95], [2, -0.4, 0.8]];
  const lashes = chance(0.3), brows = chance(0.35), lids = chance(0.25);
  for (const [xi, yi, sc] of layout) {
    const es = big * sc;
    const eg = new THREE.Group();
    const ball = new THREE.Mesh(new THREE.SphereGeometry(es, 40, 28), eyeMat);
    ball.castShadow = true;
    eg.add(ball);
    if (stalks) {
      // eyes on stalks sticking out of the top of the head
      const base = new THREE.Group();
      const s = place(base, new THREE.Vector3(xi * 0.35, 1, 0.25), -0.01);
      orient(base, s.n, 0.8);
      const len = 0.22 + r() * 0.12;
      const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.032, len, 12), limbMat);
      stalk.position.y = len / 2;
      eg.position.y = len + es * 0.7;
      base.add(stalk, eg);
      base.userData.ph = r() * 6;
      wobblers.push({ o: base, kind: 'stalk' });
      monster.add(base);
    } else {
      const sp = big * 1.25 + 0.02;
      place(eg, new THREE.Vector3(xi * sp, faceY + yi * sp, 0.5), es * 0.12 + furPad);
      monster.add(eg);
    }
    if (lids) { // sleepy half-lid on top of the eye
      const lid = new THREE.Mesh(new THREE.SphereGeometry(es * 1.06, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.3), lidMat);
      lid.rotation.x = -0.35;
      eg.add(lid);
    }
    if (lashes) for (let i = -2; i <= 2; i++) {
      const l = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.006, es * 0.45, 5), new THREE.MeshStandardMaterial({ color: 0x1a1020 }));
      l.position.set(i * es * 0.28, es * 0.95, es * 0.25);
      l.rotation.z = -i * 0.25; l.rotation.x = 0.4;
      eg.add(l);
    }
    eg.userData.ball = ball;
    eg.userData.es = es;
    eyes.push(eg);
  }
  if (brows && !stalks) for (const e of eyes) {
    const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.012, e.userData.es * 0.9, 4, 8), new THREE.MeshStandardMaterial({ color: accent.clone().multiplyScalar(0.5), roughness: 0.8 }));
    b.rotation.z = Math.PI / 2 + (e.position.x > 0.01 ? -0.25 : e.position.x < -0.01 ? 0.25 : 0);
    b.position.copy(e.position).add(new THREE.Vector3(0, e.userData.es * 1.35, 0.02));
    monster.add(b);
  }

  // ---- mouth ----
  const lowestEye = stalks ? faceY + 0.1 : Math.min(...eyes.map(e => e.position.y - e.userData.es));
  const mouthY = lowestEye - 0.08;
  const mouthKind = pick(['smile', 'grin', 'fangs', 'buck', 'tongue', 'ooh', 'smile', 'grin']);
  const mouthW = (mouthKind === 'grin' ? 0.11 : 0.07) + r() * 0.06;
  const mouthMat = new THREE.MeshPhysicalMaterial({ color: 0x3a0d18, roughness: 0.5, clearcoat: 0.8 });
  const toothMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.2, clearcoat: 1 });
  const mouth = new THREE.Group();
  const ms = place(mouth, new THREE.Vector3(0, mouthY, 0.5), 0.004 + furPad);
  mouth.lookAt(mouth.position.clone().add(ms.n));
  monster.add(mouth);
  const smileFace = new THREE.Group(); mouth.add(smileFace);
  if (mouthKind === 'ooh') {
    const o = new THREE.Mesh(new THREE.CircleGeometry(0.04, 24), mouthMat);
    o.scale.y = 1.3;
    smileFace.add(o);
  } else if (mouthKind === 'grin') {
    const g = new THREE.Mesh(new THREE.CircleGeometry(mouthW, 32, Math.PI, Math.PI), mouthMat);
    smileFace.add(g);
    const n = 4 + Math.floor(r() * 3);
    for (let i = 0; i < n; i++) {
      const t = new THREE.Mesh(new THREE.BoxGeometry(mouthW * 1.6 / n * 0.85, 0.03, 0.01), toothMat);
      t.position.set(-mouthW * 0.8 + (i + 0.5) * mouthW * 1.6 / n, -0.016, 0.004);
      smileFace.add(t);
    }
    if (chance(0.5)) { const tg = new THREE.Mesh(new THREE.CircleGeometry(mouthW * 0.5, 24, Math.PI, Math.PI), new THREE.MeshPhysicalMaterial({ color: 0xff5c7a, roughness: 0.4 })); tg.position.set(0, -mouthW * 0.45, 0.002); tg.scale.y = 0.55; smileFace.add(tg); }
  } else {
    const arc = new THREE.Mesh(new THREE.TorusGeometry(mouthW, 0.016, 10, 32, Math.PI), mouthMat);
    arc.rotation.z = Math.PI;
    smileFace.add(arc);
    if (mouthKind === 'fangs') for (const s of [-1, 1]) {
      const f = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.045, 12), toothMat);
      f.rotation.z = Math.PI; f.position.set(s * mouthW * 0.55, -mouthW * 0.75 - 0.02, 0.008);
      smileFace.add(f);
    }
    if (mouthKind === 'buck') for (const s of [-0.5, 0.5]) {
      const t = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.04, 0.015), toothMat);
      t.position.set(s * 0.032, -mouthW - 0.012, 0.006);
      smileFace.add(t);
    }
    if (mouthKind === 'tongue') {
      const t = new THREE.Mesh(new THREE.SphereGeometry(0.035, 20, 12), new THREE.MeshPhysicalMaterial({ color: 0xff5c7a, roughness: 0.35, clearcoat: 0.6 }));
      t.scale.set(1, 1.3, 0.45); t.position.set(mouthW * 0.3, -mouthW - 0.025, 0.01);
      smileFace.add(t);
    }
  }

  // ---- cheeks & freckles ----
  if (chance(0.7)) {
    const blush = canvasTex(128, 128, (g, w) => {
      const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
      gr.addColorStop(0, 'rgba(255,90,130,0.65)'); gr.addColorStop(1, 'rgba(255,90,130,0)');
      g.fillStyle = gr; g.fillRect(0, 0, w, w);
      if (chance(0.4)) { g.fillStyle = 'rgba(120,60,30,0.7)'; for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(30 + r() * 68, 40 + r() * 48, 4, 0, 7); g.fill(); } }
    });
    const bm = new THREE.MeshBasicMaterial({ map: blush, transparent: true, depthWrite: false });
    for (const s of [-1, 1]) {
      const c = new THREE.Mesh(new THREE.PlaneGeometry(0.13, 0.09), bm);
      const cs = place(c, new THREE.Vector3(s * 0.34 * sx, mouthY + 0.03, 0.42), 0.012 + furPad);
      c.lookAt(c.position.clone().add(cs.n));
      monster.add(c);
    }
  }

  // ---- things on the head ----
  const hornMat = new THREE.MeshPhysicalMaterial({ color: pick([0xfff3d6, accent.getHex(), 0xffe08a, 0xf5f5f5]), roughness: 0.3, clearcoat: 1 });
  const decoKinds = stalks ? ['none', 'spikes', 'tuft', 'none'] : ['horns', 'curly', 'unicorn', 'ears', 'catEars', 'roundEars', 'bunny', 'antennae', 'tentacles', 'spikes', 'tuft', 'crown', 'sprout', 'none'];
  const deco = pick(decoKinds);
  const decoObjs = [];
  const addDeco = (o, dir, out = -0.01, up = 0.6) => { const s = place(o, dir, out); orient(o, s.n, up); o.traverse(m => { m.castShadow = true; }); monster.add(o); decoObjs.push(o); return o; };
  const sides = [-1, 1];
  if (deco === 'horns') for (const s of sides) { const o = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.2, 20), hornMat); o.geometry.translate(0, 0.1, 0); addDeco(o, new THREE.Vector3(s * 0.45, 1, 0.05)); }
  if (deco === 'curly') for (const s of sides) {
    const o = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.03, 12, 24, Math.PI * 1.3), hornMat);
    const g = new THREE.Group(); o.rotation.y = Math.PI / 2; o.position.set(0, 0.05, 0); o.rotation.x = s > 0 ? 0 : Math.PI; g.add(o);
    addDeco(g, new THREE.Vector3(s * 0.6, 0.8, 0), -0.01, 0.2);
  }
  if (deco === 'unicorn') { const o = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.28, 24), hornMat); o.geometry.translate(0, 0.14, 0); addDeco(o, new THREE.Vector3(0, 1, 0.25), -0.01, 0.3); }
  if (deco === 'ears' || deco === 'catEars') for (const s of sides) {
    const o = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.19, deco === 'catEars' ? 3 : 4), softMat(baseColor));
    o.geometry.translate(0, 0.09, 0); o.scale.set(1, 1, 0.45);
    addDeco(o, new THREE.Vector3(s * 0.5, 1, 0.05));
  }
  if (deco === 'roundEars') for (const s of sides) {
    const o = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.03, 32), softMat(accent));
    o.rotation.x = Math.PI / 2; const g = new THREE.Group(); o.position.y = 0.08; g.add(o);
    addDeco(g, new THREE.Vector3(s * 0.65, 0.8, 0), -0.02, 0.4);
  }
  if (deco === 'bunny') for (const s of sides) { const o = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.24, 8, 16), softMat(baseColor)); o.geometry.translate(0, 0.16, 0); o.scale.set(1, 1, 0.55); addDeco(o, new THREE.Vector3(s * 0.35, 1, 0.05)); }
  if (deco === 'antennae') for (const s of sides) {
    const o = new THREE.Group();
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.012, 0.24, 8), new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.5 })); stalk.position.y = 0.12;
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.036, 20, 14), new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 1.6 })); ball.position.y = 0.25;
    o.add(stalk, ball);
    addDeco(o, new THREE.Vector3(s * 0.4, 1, 0.05));
  }
  if (deco === 'tentacles') {
    const n = 3 + Math.floor(r() * 4);
    for (let i = 0; i < n; i++) {
      const a = (i / (n - 1) - 0.5) * 1.6;
      const len = 0.18 + r() * 0.12;
      const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.02, len * 0.4, 0), new THREE.Vector3(-0.03, len * 0.75, 0.02), new THREE.Vector3(0.04, len, 0)]);
      const o = new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.028, 10, false), softMat(i % 2 ? accent : baseColor));
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 8), o.material); tip.position.set(0.04, len, 0); o.add(tip);
      const g = new THREE.Group(); g.add(o); g.userData.ph = i;
      addDeco(g, new THREE.Vector3(Math.sin(a) * 0.6, 1, 0.1 - Math.abs(a) * 0.1), -0.02, 0.5);
      wobblers.push({ o, kind: 'tentacle', ph: i * 1.3 });
    }
  }
  if (deco === 'spikes') for (let i = 0; i < 5; i++) {
    const o = new THREE.Mesh(new THREE.ConeGeometry(0.045 - i * 0.004, 0.12 - i * 0.01, 12), hornMat); o.geometry.translate(0, 0.05, 0);
    addDeco(o, new THREE.Vector3(0, 1 - i * 0.35, -0.2 - i * 0.3), -0.01, 0);
  }
  if (deco === 'tuft') for (let i = 0; i < 7; i++) {
    const o = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.16 + r() * 0.06, 8), softMat(accent)); o.geometry.translate(0, 0.07, 0);
    addDeco(o, new THREE.Vector3((r() - 0.5) * 0.3, 1, (r() - 0.5) * 0.3), -0.02, 0.2);
  }
  if (deco === 'crown') for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const o = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.1, 10), hornMat); o.geometry.translate(0, 0.045, 0);
    addDeco(o, new THREE.Vector3(Math.cos(a) * 0.3, 1, Math.sin(a) * 0.3), -0.01, 1.5);
  }
  if (deco === 'sprout') {
    const o = new THREE.Group();
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.01, 0.14, 8), new THREE.MeshStandardMaterial({ color: 0x3f9a3a })); stem.position.y = 0.07;
    o.add(stem);
    for (const s of sides) {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 10), new THREE.MeshPhysicalMaterial({ color: 0x5cc85a, roughness: 0.4, clearcoat: 0.6 }));
      leaf.scale.set(1, 0.25, 0.55); leaf.position.set(s * 0.045, 0.14, 0); leaf.rotation.z = s * 0.5;
      o.add(leaf);
    }
    addDeco(o, new THREE.Vector3(0, 1, 0), -0.01, 2);
  }

  // ---- accessories ----
  const accs = new Set();
  for (let i = 0; i < 2; i++) if (chance(0.45)) accs.add(pick(['bowtie', 'hat', 'bow', 'glasses', 'tail', 'wings', 'scarf', 'tail', 'wings']));
  if (stalks) accs.delete('glasses');
  if (eyeCount !== 2) accs.delete('glasses');
  if (deco !== 'none') accs.delete('hat');
  const accMat = new THREE.MeshPhysicalMaterial({ color: pick([0xff4f8b, 0x4f7bff, 0xffc93c, 0x7c4dff, 0x22c55e, 0xff7043]), roughness: 0.45, clearcoat: 0.4 });
  if (accs.has('bowtie') || accs.has('bow')) {
    const bt = new THREE.Group();
    for (const s of sides) { const w = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.08, 4), accMat); w.rotation.z = s * Math.PI / 2; w.position.x = s * 0.04; w.scale.z = 0.4; bt.add(w); }
    const knot = new THREE.Mesh(new THREE.SphereGeometry(0.022, 12, 8), accMat); bt.add(knot);
    if (accs.has('bowtie')) { const s = place(bt, new THREE.Vector3(0, mouthY - 0.2, 0.5), 0.02 + furPad); bt.lookAt(bt.position.clone().add(s.n)); monster.add(bt); }
    else { const b2 = bt.clone(); const s = place(b2, new THREE.Vector3(0.3, 1, 0.2), 0.01 + furPad); b2.lookAt(b2.position.clone().add(s.n)); b2.rotateX(-1.2); b2.scale.setScalar(1.3); monster.add(b2); }
  }
  if (accs.has('hat')) {
    const hat = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.26, 24), new THREE.MeshPhysicalMaterial({ map: canvasTex(128, 128, (g, w, h) => { g.fillStyle = '#' + accMat.color.getHexString(); g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; for (let i = 0; i < 14; i++) { g.beginPath(); g.arc(Math.random() * w, Math.random() * h, 5, 0, 7); g.fill(); } }), roughness: 0.5 }));
    hat.geometry.translate(0, 0.13, 0);
    const pom = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 })); pom.position.y = 0.27; hat.add(pom);
    const s = place(hat, new THREE.Vector3(0.12, 1, 0), -0.01); orient(hat, s.n, 0.3);
    monster.add(hat); decoObjs.push(hat);
  }
  if (accs.has('glasses')) {
    const gm = new THREE.MeshPhysicalMaterial({ color: 0x222222, roughness: 0.3, metalness: 0.5 });
    const g = new THREE.Group();
    for (const e of eyes) { const ring = new THREE.Mesh(new THREE.TorusGeometry(e.userData.es * 1.12, 0.008, 8, 32), gm); ring.position.copy(e.position).add(new THREE.Vector3(0, 0, e.userData.es * 0.6)); g.add(ring); }
    if (eyes.length === 2) { const br = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, Math.abs(eyes[0].position.x - eyes[1].position.x) - eyes[0].userData.es * 2.2, 6), gm); br.rotation.z = Math.PI / 2; br.position.set(0, eyes[0].position.y, eyes[0].position.z + eyes[0].userData.es * 0.6); g.add(br); }
    monster.add(g);
  }
  if (accs.has('scarf')) {
    const sc = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.045, 12, 48), accMat);
    sc.rotation.x = Math.PI / 2;
    sc.position.y = mouthY - 0.17;
    const half = surface(new THREE.Vector3(1, mouthY - 0.17, 0)).p.x, halfZ = surface(new THREE.Vector3(0, mouthY - 0.17, 1)).p.z;
    sc.scale.set((half + 0.02 + furPad) / 0.42, (halfZ + 0.02 + furPad) / 0.42, 1);
    monster.add(sc);
  }
  let tail = null;
  if (accs.has('tail')) {
    tail = new THREE.Group();
    if (chance(0.5)) { const puff = new THREE.Mesh(new THREE.SphereGeometry(0.08, 20, 14), softMat(chance(0.5) ? 0xffffff : accent)); puff.position.y = 0.04; tail.add(puff); }
    else {
      const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0.05, -0.12), new THREE.Vector3(0, 0.18, -0.2), new THREE.Vector3(0, 0.3, -0.15)]);
      const tm = new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.025, 8, false), limbMat);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.08, 4), hornMat); tip.position.set(0, 0.33, -0.15); tip.scale.z = 0.4;
      tail.add(tm, tip);
    }
    place(tail, new THREE.Vector3(0, -0.15, -1), -0.02);
    monster.add(tail);
  }
  const wings = [];
  if (accs.has('wings')) {
    const fairy = chance(0.5);
    const wm = fairy ? new THREE.MeshPhysicalMaterial({ color: 0xe8f4ff, transparent: true, opacity: 0.55, roughness: 0.1, iridescence: 1, side: THREE.DoubleSide, depthWrite: false })
      : new THREE.MeshStandardMaterial({ color: accent.clone().multiplyScalar(0.6), roughness: 0.6, side: THREE.DoubleSide });
    const shapeW = new THREE.Shape();
    if (fairy) { shapeW.moveTo(0, 0); shapeW.bezierCurveTo(0.1, 0.25, 0.32, 0.25, 0.3, 0.08); shapeW.bezierCurveTo(0.3, 0, 0.15, -0.05, 0, 0); }
    else { shapeW.moveTo(0, 0); shapeW.lineTo(0.12, 0.2); shapeW.lineTo(0.3, 0.16); shapeW.quadraticCurveTo(0.24, 0.08, 0.26, 0.02); shapeW.quadraticCurveTo(0.18, 0.04, 0.16, -0.04); shapeW.quadraticCurveTo(0.08, 0.02, 0, 0); }
    const wg = new THREE.ShapeGeometry(shapeW);
    for (const s of sides) {
      const pivot = new THREE.Group();
      const w = new THREE.Mesh(wg, wm); w.scale.x = s; w.castShadow = true;
      pivot.add(w);
      place(pivot, new THREE.Vector3(s * 0.4, 0.15, -1), -0.03);
      pivot.userData.side = s;
      monster.add(pivot);
      wings.push(pivot);
    }
  }

  // ---- arms and feet ----
  const armKind = pick(['stubby', 'stubby', 'long', 'four', 'tentacle', 'none', 'long']);
  const arms = [];
  const armSet = armKind === 'four' ? [[-1, 0.05], [1, 0.05], [-1, -0.2], [1, -0.2]] : armKind === 'none' ? [] : [[-1, -0.05], [1, -0.05]];
  for (const [s, y] of armSet) {
    const arm = new THREE.Group();
    if (armKind === 'tentacle') {
      const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.03 * s, -0.1, 0.02), new THREE.Vector3(0.08 * s, -0.2, 0.0), new THREE.Vector3(0.05 * s, -0.28, 0.04)]);
      arm.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.03, 10, false), limbMat));
    } else {
      const len = armKind === 'long' ? 0.24 : 0.12;
      const a = new THREE.Mesh(new THREE.CapsuleGeometry(0.038, len, 8, 16), limbMat);
      a.position.y = -len / 2 - 0.01;
      arm.add(a);
      if (armKind === 'long') { const hand = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 12), limbMat); hand.position.y = -len - 0.04; arm.add(hand); }
    }
    arm.traverse(m => { m.castShadow = true; });
    place(arm, new THREE.Vector3(s, y, 0.15), -0.02);
    arm.rotation.z = s * 0.5;
    arm.userData.side = s;
    monster.add(arm);
    arms.push(arm);
  }
  const footKind = pick(['round', 'round', 'big', 'three', 'claws']);
  const feet = footKind === 'three' ? [-1, 0, 1] : [-1, 1];
  for (const s of feet) {
    const fs = footKind === 'big' ? 0.12 : 0.09;
    const foot = new THREE.Mesh(new THREE.SphereGeometry(fs, 28, 14), limbMat);
    foot.scale.set(1, 0.55, footKind === 'big' ? 1.5 : 1.3);
    foot.position.set(s * (footKind === 'three' ? 0.2 : 0.2) * sx, bottom + 0.03, 0.12 + (footKind === 'three' && s === 0 ? 0.05 : 0));
    foot.castShadow = true;
    if (footKind === 'claws') for (const c of [-1, 0, 1]) { const cl = new THREE.Mesh(new THREE.ConeGeometry(0.015, 0.04, 8), hornMat); cl.rotation.x = Math.PI / 2; cl.position.set(c * 0.04, 0, 0.09); cl.scale.y = 1 / 1.3; foot.add(cl); }
    monster.add(foot);
  }

  // ---- size: fits roughly into a 1-unit tall space ----
  monster.position.y = -bottom;
  const holder = new THREE.Group();
  holder.add(monster);
  monster.updateMatrixWorld(true);
  const bb = new THREE.Box3().setFromObject(monster);
  const sz3 = bb.getSize(new THREE.Vector3());
  const scale = (opts.size || 1.0) / Math.max(sz3.y, sz3.x * 0.85, 0.5);
  holder.scale.setScalar(scale);

  const blinkAt = { t: 1 + r() * 3 };
  const phase = r() * 10;
  const smileQ = smileFace.quaternion.clone(), sadQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI);
  holder.userData.monster = {
    // where accessories go (in the monster's own units; the group sits on the floor)
    mount: { group: monster, top: geo.boundingBox.max.y + furLen * 0.6, faceY: faceY, front: geo.boundingBox.max.z + furLen * 0.6, width: geo.boundingBox.max.x },
    name, seed, color: baseColor.getHex(), gen: 2, expr: {},
    update(t, camPos) {
      const ex = this.expr || {};
      const bob = Math.sin(t * 2.2 + phase);
      bodyGroup.scale.set(1 + bob * 0.02, 1 - bob * 0.025, 1 + bob * 0.02);
      const es = ex.eyeScale || 1, shut = ex.closed || ex.sleep;
      const blink = t > blinkAt.t && t < blinkAt.t + 0.14;
      eyes.forEach((e, i) => {
        // eyes blink one after another, which looks funny with many eyes
        const b = shut || (blink && (t - blinkAt.t) * 30 > i * 0.6 - 0.5) ? 0.1 : 1;
        e.scale.set(es, b * es, es);
        if (camPos) e.lookAt(camPos);
      });
      if (t > blinkAt.t + 0.3) blinkAt.t = t + 2 + Math.random() * 3;
      smileFace.quaternion.copy(ex.sad ? sadQ : smileQ);
      for (const a of arms) a.rotation.z = a.userData.side * (0.5 + 0.25 * Math.sin(t * 3 + phase + a.userData.side));
      for (const d of decoObjs) d.rotation.x += (0.06 * Math.sin(t * 2.5 + phase) - (d.userData.lastWob || 0)), d.userData.lastWob = 0.06 * Math.sin(t * 2.5 + phase);
      for (const w of wobblers) {
        if (w.kind === 'stalk') w.o.rotation.z = 0.15 * Math.sin(t * 1.8 + w.o.userData.ph);
        else w.o.rotation.z = 0.25 * Math.sin(t * 2.2 + w.ph);
      }
      for (const w of wings) w.rotation.y = w.userData.side * (0.6 + 0.35 * Math.sin(t * (ex.sleep ? 1 : 9) + phase));
      if (tail) tail.rotation.y = 0.4 * Math.sin(t * 4 + phase);
    },
  };
  return holder;
}
