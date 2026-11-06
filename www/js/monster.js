// Cute monster generator. A seed always gives the same monster, so the album can store just the seed.
import * as THREE from 'three';
import { monsterName } from './catalog.js';
import { makeMonster2 } from './monster2.js';

export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

export const PALETTE = [0xff8fb8, 0x8fd3ff, 0xa8f0a0, 0xffd36e, 0xc7a2ff, 0xff9f7a, 0x7ff0e0, 0xffb3e6, 0x9fb8ff, 0xf6f08a];

// Smooth noise for bumping the body shape.
export function vnoise(x, y, z, r) {
  return Math.sin(x * r[0] + r[3]) * Math.sin(y * r[1] + r[4]) * Math.sin(z * r[2] + r[5]);
}

export function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export function eyeTexture(iris, rand) {
  return canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = '#fbfbf8'; g.fillRect(0, 0, w, h);
    // faint veins-free sclera shading
    const cx = w * 0.25, cy = h * 0.5, R = h * 0.19;
    const gr = g.createRadialGradient(cx, cy, R * 0.2, cx, cy, R);
    const c = new THREE.Color(iris);
    const dark = c.clone().multiplyScalar(0.45).getStyle(), mid = c.getStyle(), light = c.clone().lerp(new THREE.Color(1, 1, 1), 0.35).getStyle();
    gr.addColorStop(0, light); gr.addColorStop(0.6, mid); gr.addColorStop(1, dark);
    g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fill();
    // iris fibres
    g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 1.2;
    for (let i = 0; i < 70; i++) {
      const a = (i / 70) * Math.PI * 2 + rand() * 0.05;
      g.beginPath(); g.moveTo(cx + Math.cos(a) * R * 0.45, cy + Math.sin(a) * R * 0.45);
      g.lineTo(cx + Math.cos(a) * R * 0.95, cy + Math.sin(a) * R * 0.95); g.stroke();
    }
    g.strokeStyle = 'rgba(0,0,0,0.55)'; g.lineWidth = 3; g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#060608'; g.beginPath(); g.arc(cx, cy, R * 0.48, 0, Math.PI * 2); g.fill();
  });
}

function spotTexture(base, spot, rand) {
  return canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = new THREE.Color(base).getStyle(); g.fillRect(0, 0, w, h);
    g.fillStyle = new THREE.Color(spot).getStyle();
    const n = 10 + Math.floor(rand() * 14);
    for (let i = 0; i < n; i++) {
      const x = rand() * w, y = h * (0.15 + rand() * 0.7), r = 8 + rand() * 26;
      g.globalAlpha = 0.85; g.beginPath(); g.ellipse(x, y, r * 1.3, r, 0, 0, Math.PI * 2); g.fill();
      if (x < r * 2) { g.beginPath(); g.ellipse(x + w, y, r * 1.3, r, 0, 0, Math.PI * 2); g.fill(); }
    }
  });
}

// Fur: a stack of shells over the body. Each shell keeps only the strands taller than its height.
function furNoiseTexture() {
  return canvasTex(256, 256, (g, w, h) => {
    const img = g.createImageData(w, h);
    for (let i = 0; i < w * h; i++) {
      const v = Math.random();
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v * 255;
      img.data[i * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }, false);
}
let FUR_TEX = null;

export function makeFur(geometry, color, len, shells, density) {
  if (!FUR_TEX) {
    FUR_TEX = furNoiseTexture();
    FUR_TEX.wrapS = FUR_TEX.wrapT = THREE.RepeatWrapping;
    FUR_TEX.magFilter = THREE.NearestFilter; FUR_TEX.minFilter = THREE.NearestFilter;
    FUR_TEX.generateMipmaps = false;
  }
  const group = new THREE.Group();
  for (let i = 1; i <= shells; i++) {
    const h = i / shells;
    // Lambert is much cheaper than PBR, and fur is matte anyway; the shells are drawn up to 12 times over the body
    const m = new THREE.MeshLambertMaterial({ color, transparent: false, alphaTest: 0.5 });
    m.emissive.copy(new THREE.Color(color)).multiplyScalar(0.22); // stands in for the room reflections Lambert does not get
    const u = { uH: { value: h }, uLen: { value: len }, uFur: { value: FUR_TEX }, uDen: { value: density } };
    m.onBeforeCompile = shader => {
      Object.assign(shader.uniforms, u);
      shader.vertexShader = 'uniform float uH; uniform float uLen; varying vec2 vFurUv;\n' + shader.vertexShader
        .replace('#include <begin_vertex>', `
          vec3 transformed = position + normal * uLen * uH;
          transformed.y -= uLen * 0.35 * uH * uH;
          vFurUv = uv;`);
      shader.fragmentShader = 'uniform float uH; uniform sampler2D uFur; uniform vec2 uDen; varying vec2 vFurUv;\n' + shader.fragmentShader
        .replace('#include <alphatest_fragment>', `
          float strand = texture2D(uFur, vFurUv * uDen).r;
          float tip = strand - uH;
          if (tip < 0.0) discard;
          diffuseColor.a = 1.0;`)
        .replace('#include <aomap_fragment>', `#include <aomap_fragment>
          reflectedLight.indirectDiffuse *= mix(0.35, 1.0, uH);
          reflectedLight.directDiffuse *= mix(0.45, 1.0, uH);`);
    };
    m.customProgramCacheKey = () => 'fur-shell';
    const mesh = new THREE.Mesh(geometry, m);
    mesh.castShadow = i === Math.round(shells * 0.5);
    mesh.receiveShadow = false;
    group.add(mesh);
  }
  return group;
}

export function makeMonster(seed, opts = {}) {
  if (opts.gen === 2) return makeMonster2(seed, opts);
  return makeMonsterV1(seed, opts);
}

// The first generation (kept as it was, so monsters already in the album keep their looks).
function makeMonsterV1(seed, opts = {}) {
  const rand = rng(seed);
  const r = () => rand();
  const pick = a => a[Math.floor(r() * a.length)];
  const monster = new THREE.Group();
  const name = monsterName(rand);

  let baseColor = new THREE.Color(pick(PALETTE));
  if (opts.tint) baseColor.lerp(new THREE.Color(opts.tint), 0.55);
  const hsl = {}; baseColor.getHSL(hsl);
  baseColor.setHSL(hsl.h, Math.max(0.45, hsl.s), Math.min(0.72, Math.max(0.5, hsl.l)));
  const accent = new THREE.Color().setHSL((hsl.h + 0.08 + r() * 0.5) % 1, 0.75, 0.62);

  const skin = pick(['fur', 'fur', 'velvet', 'jelly', 'spots']);

  // Body: a deformed sphere (egg, pear or ball) with gentle bumps.
  const sx = 0.85 + r() * 0.35, sy = 0.85 + r() * 0.45, sz = 0.8 + r() * 0.3;
  const pear = (r() - 0.3) * 0.5;
  const rn = [1 + r() * 2, 1 + r() * 2, 1 + r() * 2, r() * 6, r() * 6, r() * 6];
  const bumps = skin === 'jelly' ? 0.02 : 0.05;
  const geo = new THREE.SphereGeometry(0.5, 72, 48);
  const pos = geo.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const k = 1 + pear * (-v.y * 2) + bumps * vnoise(v.x * 4, v.y * 4, v.z * 4, rn);
    v.set(v.x * sx * k, v.y * sy, v.z * sz * k);
    if (v.y < -0.38 * sy) v.y = -0.38 * sy + (v.y + 0.38 * sy) * 0.3; // a flat-ish bottom to sit on
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  geo.computeBoundingBox();
  const bottom = geo.boundingBox.min.y;

  let bodyMat;
  if (skin === 'jelly') {
    // Jelly look without real transmission (that costs a second render of the whole scene on phones).
    bodyMat = new THREE.MeshPhysicalMaterial({ color: baseColor, roughness: 0.1, transparent: true, opacity: 0.82, clearcoat: 1, clearcoatRoughness: 0.05,
      emissive: baseColor, emissiveIntensity: 0.18 });
  } else if (skin === 'velvet') {
    bodyMat = new THREE.MeshPhysicalMaterial({ color: baseColor, roughness: 0.75, sheen: 1, sheenRoughness: 0.45,
      sheenColor: baseColor.clone().lerp(new THREE.Color(1, 1, 1), 0.5) });
  } else if (skin === 'spots') {
    bodyMat = new THREE.MeshPhysicalMaterial({ map: spotTexture(baseColor, accent, rand), roughness: 0.38, clearcoat: 0.6, clearcoatRoughness: 0.25 });
  } else {
    bodyMat = new THREE.MeshStandardMaterial({ color: baseColor.clone().multiplyScalar(0.8), roughness: 0.9 });
  }
  const body = new THREE.Mesh(geo, bodyMat);
  body.castShadow = true; body.receiveShadow = true;
  const bodyGroup = new THREE.Group();
  bodyGroup.add(body);
  let furLen = 0;
  if (skin === 'fur') {
    const long = r() < 0.4;
    furLen = long ? 0.09 : 0.05;
    bodyGroup.add(makeFur(geo, baseColor, furLen, long ? 12 : 10, new THREE.Vector2(long ? 34 : 48, long ? 17 : 24)));
  }
  monster.add(bodyGroup);

  const ray = new THREE.Raycaster();
  const furPad = furLen * 0.8;
  // Point on the body surface in a given direction from the center.
  const surface = (dir) => {
    dir.normalize();
    ray.set(dir.clone().multiplyScalar(3), dir.clone().negate());
    const hit = ray.intersectObject(body, false)[0];
    return hit ? { p: hit.point.clone(), n: hit.face.normal.clone() } : { p: dir.clone().multiplyScalar(0.5), n: dir.clone() };
  };
  const place = (obj, dir, out = 0) => {
    const s = surface(dir);
    obj.position.copy(s.p).addScaledVector(s.n, out);
    return s;
  };

  // Eyes
  const eyeCount = pick([1, 2, 2, 2, 2, 3]);
  const eyeSize = eyeCount === 1 ? 0.2 + r() * 0.06 : eyeCount === 3 ? 0.11 + r() * 0.03 : 0.13 + r() * 0.05;
  const iris = pick([0x3a8dde, 0x5bbf5a, 0x8b5a2b, 0xb05fe0, 0xe08a2b, 0x20b2aa]);
  const eyeTex = eyeTexture(iris, rand);
  const eyeMat = new THREE.MeshPhysicalMaterial({ map: eyeTex, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.02 });
  const eyes = [];
  const eyeY = 0.12 + r() * 0.1;
  const xs = eyeCount === 1 ? [0] : eyeCount === 2 ? [-1, 1] : [-1.2, 0, 1.2];
  for (const xi of xs) {
    const eg = new THREE.Group();
    const ball = new THREE.Mesh(new THREE.SphereGeometry(eyeSize, 48, 32), eyeMat);
    ball.castShadow = true;
    eg.add(ball);
    const y = eyeY + (eyeCount === 3 && xi === 0 ? 0.1 : 0);
    place(eg, new THREE.Vector3(xi * (eyeSize * 1.25 + 0.02), y, 0.5), eyeSize * 0.12 + furPad);
    eg.userData.ball = ball;
    eyes.push(eg);
    monster.add(eg);
  }

  // Mouth: a smile, sometimes with a tooth or a tongue.
  const mouthW = 0.07 + r() * 0.07;
  const mouthMat = new THREE.MeshPhysicalMaterial({ color: 0x3a0d18, roughness: 0.5, clearcoat: 0.8 });
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(mouthW, 0.018, 12, 32, Math.PI), mouthMat);
  const ms = place(mouth, new THREE.Vector3(0, eyeY - eyeSize - 0.09, 0.5), 0.005 + furPad);
  mouth.lookAt(mouth.position.clone().add(ms.n));
  mouth.rotateZ(Math.PI);
  monster.add(mouth);
  const mouthQ = mouth.quaternion.clone(), sadQ = mouthQ.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI));
  const extra = pick(['tooth', 'tongue', 'teeth', 'none']);
  const toothMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.2, clearcoat: 1 });
  if (extra === 'tooth' || extra === 'teeth') {
    for (const dx of extra === 'tooth' ? [0] : [-0.35, 0.35]) {
      const t = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.04, 0.02), toothMat);
      t.position.set(dx * mouthW, -mouthW - 0.012, 0.004);
      mouth.add(t);
    }
  } else if (extra === 'tongue') {
    const t = new THREE.Mesh(new THREE.SphereGeometry(0.035, 24, 16), new THREE.MeshPhysicalMaterial({ color: 0xff5c7a, roughness: 0.35, clearcoat: 0.6 }));
    t.scale.set(1, 1.2, 0.5);
    t.position.set(mouthW * 0.3, -mouthW - 0.02, 0.01);
    mouth.add(t);
  }

  // Blush cheeks
  if (r() < 0.75) {
    const blush = canvasTex(128, 128, (g, w) => {
      const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
      gr.addColorStop(0, 'rgba(255,90,130,0.65)'); gr.addColorStop(1, 'rgba(255,90,130,0)');
      g.fillStyle = gr; g.fillRect(0, 0, w, w);
    });
    const bm = new THREE.MeshBasicMaterial({ map: blush, transparent: true, depthWrite: false });
    for (const s of [-1, 1]) {
      const c = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.08), bm);
      const cs = place(c, new THREE.Vector3(s * 0.32, eyeY - eyeSize - 0.05, 0.42), 0.01 + furPad);
      c.lookAt(c.position.clone().add(cs.n));
      monster.add(c);
    }
  }

  // Head decoration
  const hornMat = new THREE.MeshPhysicalMaterial({ color: pick([0xfff3d6, accent.getHex(), 0xffe08a]), roughness: 0.3, clearcoat: 1 });
  const deco = pick(['horns', 'ears', 'bunny', 'antennae', 'none', 'horns', 'ears']);
  const decoObjs = [];
  for (const s of (deco === 'none' ? [] : [-1, 1])) {
    let o;
    if (deco === 'horns') {
      o = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.18, 24), hornMat);
      o.geometry.translate(0, 0.09, 0);
    } else if (deco === 'ears') {
      o = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.17, 4, 1), skin === 'fur' ? new THREE.MeshStandardMaterial({ color: baseColor, roughness: 0.9 }) : bodyMat);
      o.geometry.translate(0, 0.08, 0);
      o.scale.set(1, 1, 0.45);
    } else if (deco === 'bunny') {
      o = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.22, 8, 16), skin === 'fur' ? new THREE.MeshStandardMaterial({ color: baseColor, roughness: 0.9 }) : bodyMat);
      o.geometry.translate(0, 0.15, 0);
      o.scale.set(1, 1, 0.55);
    } else {
      o = new THREE.Group();
      const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.012, 0.22, 8), new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.5 }));
      stalk.position.y = 0.11;
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.035, 24, 16), new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 1.6 }));
      ball.position.y = 0.23;
      o.add(stalk, ball);
    }
    const ss = place(o, new THREE.Vector3(s * 0.45, 1, 0.05), -0.01);
    o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), ss.n.clone().add(new THREE.Vector3(0, 0.6, 0)).normalize());
    o.castShadow = true;
    monster.add(o);
    decoObjs.push(o);
  }

  // Little feet and arms
  const limbMat = skin === 'fur' ? new THREE.MeshStandardMaterial({ color: baseColor.clone().multiplyScalar(0.85), roughness: 0.9 }) : bodyMat;
  for (const s of [-1, 1]) {
    const foot = new THREE.Mesh(new THREE.SphereGeometry(0.09, 32, 16), limbMat);
    foot.scale.set(1, 0.55, 1.3);
    foot.position.set(s * 0.18 * sx, bottom + 0.03, 0.12);
    foot.castShadow = true;
    monster.add(foot);
  }
  const arms = [];
  if (r() < 0.8) {
    for (const s of [-1, 1]) {
      const arm = new THREE.Group();
      const a = new THREE.Mesh(new THREE.CapsuleGeometry(0.04, 0.12, 8, 16), limbMat);
      a.position.y = -0.07;
      a.castShadow = true;
      arm.add(a);
      place(arm, new THREE.Vector3(s, -0.05, 0.15), -0.02);
      arm.rotation.z = s * 0.5;
      arm.userData.side = s;
      monster.add(arm);
      arms.push(arm);
    }
  }

  // Sit on the floor and fit roughly into a 1-unit tall space.
  const holder = new THREE.Group();
  monster.position.y = -bottom;
  holder.add(monster);
  const scale = (opts.size || 1.0) / (sy * 1.0 + 0.25);
  holder.scale.setScalar(scale);

  const blinkAt = { t: 1 + r() * 3 };
  const phase = r() * 10;
  holder.userData.monster = {
    // where accessories go (in the monster's own units; the group sits on the floor)
    mount: { group: monster, top: geo.boundingBox.max.y + furLen * 0.6, faceY: eyeY, front: geo.boundingBox.max.z + furLen * 0.6, width: geo.boundingBox.max.x },
    name, seed, color: baseColor.getHex(),
    update(t, camPos) {
      const bob = Math.sin(t * 2.2 + phase);
      bodyGroup.scale.set(1 + bob * 0.02, 1 - bob * 0.025, 1 + bob * 0.02);
      const ex = this.expr || {};
      const es = ex.eyeScale || 1, shut = ex.closed || ex.sleep;
      for (const e of eyes) {
        // Blink by squashing the eye for a moment.
        const b = shut || (t > blinkAt.t && t < blinkAt.t + 0.14) ? 0.1 : 1;
        e.scale.set(es, b * es, es);
        if (camPos) e.lookAt(camPos); // the iris is painted on the +z side of the eyeball
      }
      mouth.quaternion.copy(ex.sad ? sadQ : mouthQ);
      if (t > blinkAt.t + 0.14) blinkAt.t = t + 2 + Math.random() * 3;
      for (const a of arms) a.rotation.z = a.userData.side * (0.5 + 0.25 * Math.sin(t * 3 + phase + a.userData.side));
      for (const d of decoObjs) d.rotation.x = 0.06 * Math.sin(t * 2.5 + phase);
    },
    wiggle: 0,
  };
  return holder;
}
