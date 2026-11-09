// Rewards for reading: accessories a monster can wear. Unlocked by stars, one per slot.
import * as THREE from 'three';
import { CARTOON } from './util.js';
import { toonify } from './vzhled.js';
import { joinDissolve } from './dissolve.js';

export const DOPLNKY = [
  { id: 'masle', nazev: 'Mašle', ikona: '🎀', hvezdy: 5, slot: 'vlasy' },
  { id: 'cepicka', nazev: 'Párty čepička', ikona: '🥳', hvezdy: 10, slot: 'hlava' },
  { id: 'kvetina', nazev: 'Kytička', ikona: '🌸', hvezdy: 15, slot: 'vlasy' },
  { id: 'bryle', nazev: 'Brýle', ikona: '🕶️', hvezdy: 25, slot: 'oci' },
  { id: 'cylindr', nazev: 'Cylindr', ikona: '🎩', hvezdy: 35, slot: 'hlava' },
  { id: 'korunka', nazev: 'Korunka', ikona: '👑', hvezdy: 50, slot: 'hlava' },
  { id: 'hvezda', nazev: 'Kouzelná hvězda', ikona: '⭐', hvezdy: 75, slot: 'nad' },
  { id: 'kridla', nazev: 'Křídla', ikona: '🦋', hvezdy: 100, slot: 'zada' },
  { id: 'santa', nazev: 'Santova čepice', ikona: '🎅', hvezdy: 0, slot: 'hlava', vanoce: true }, // from the Advent calendar
];
export const byIdD = id => DOPLNKY.find(d => d.id === id);

const mat = (color, o = {}) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.4, clearcoat: 0.5, ...o });
const shadowy = g => { g.traverse(m => { if (m.isMesh) m.castShadow = true; }); return g; };

function bow(color) {
  const g = new THREE.Group(), m = mat(color);
  for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.SphereGeometry(0.07, 20, 12), m); w.scale.set(1, 0.65, 0.4); w.position.x = s * 0.065; w.rotation.z = s * 0.35; g.add(w); }
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.03, 16, 10), m));
  return g;
}

const BUILD = {
  masle: mt => { const g = bow(0xff4f8b); g.position.set(mt.width * 0.45, mt.top - 0.03, 0.05); g.rotation.z = -0.4; return g; },
  kvetina: mt => {
    const g = new THREE.Group();
    const pm = mat(0xffb3d9), cm = mat(0xffd84d);
    for (let i = 0; i < 6; i++) { const p = new THREE.Mesh(new THREE.SphereGeometry(0.04, 14, 10), pm); const a = i / 6 * Math.PI * 2; p.position.set(Math.cos(a) * 0.045, Math.sin(a) * 0.045, 0); p.scale.set(1, 1, 0.4); g.add(p); }
    const c = new THREE.Mesh(new THREE.SphereGeometry(0.03, 14, 10), cm); c.position.z = 0.012; g.add(c);
    g.position.set(-mt.width * 0.5, mt.top - 0.06, 0.12); g.rotation.y = -0.5;
    return g;
  },
  cepicka: mt => {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const x = c.getContext('2d'); x.fillStyle = '#7c4dff'; x.fillRect(0, 0, 128, 128);
    ['#ffd36e', '#ff5fc8', '#5fd4a8'].forEach((col, i) => { x.fillStyle = col; for (let k = 0; k < 6; k++) { x.beginPath(); x.arc((k * 41 + i * 23) % 128, (k * 29 + i * 47) % 128, 7, 0, 7); x.fill(); } });
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const g = new THREE.Group();
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 28), new THREE.MeshPhysicalMaterial({ map: t, roughness: 0.5 })); cone.position.y = 0.15;
    const pom = new THREE.Mesh(new THREE.SphereGeometry(0.04, 14, 10), mat(0xffffff, { roughness: 1 })); pom.position.y = 0.31;
    g.add(cone, pom); g.position.set(0.04, mt.top - 0.04, 0); g.rotation.z = -0.18;
    return g;
  },
  santa: mt => {
    const g = new THREE.Group(), red = mat(0xe8283c, { roughness: 0.7, clearcoat: 0.1 }), white = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 });
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.32, 24), red); cone.position.set(0.03, 0.16, 0); cone.rotation.z = -0.35;
    const brim = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.04, 12, 28), white); brim.rotation.x = Math.PI / 2; brim.position.y = 0.01;
    const pom = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 12), white); pom.position.set(0.14, 0.29, 0);
    g.add(cone, brim, pom); g.position.set(0, mt.top - 0.05, 0);
    return g;
  },
  cylindr: mt => {
    const g = new THREE.Group(), m = mat(0x1d1726, { roughness: 0.6 });
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.02, 32), m);
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.13, 0.24, 32), m); crown.position.y = 0.13;
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.132, 0.132, 0.04, 32), mat(0xff4f8b)); band.position.y = 0.04;
    g.add(brim, crown, band); g.position.set(0, mt.top - 0.03, 0); g.rotation.z = 0.12;
    return g;
  },
  korunka: mt => {
    const g = new THREE.Group(), gold = new THREE.MeshPhysicalMaterial({ color: 0xf5c542, metalness: 1, roughness: 0.25 });
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.07, 32, 1, true), gold); ring.material.side = THREE.DoubleSide; ring.position.y = 0.035;
    g.add(ring);
    for (let i = 0; i < 5; i++) {
      const a = i / 5 * Math.PI * 2;
      const sp = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.09, 12), gold); sp.position.set(Math.cos(a) * 0.15, 0.11, Math.sin(a) * 0.15); g.add(sp);
      const gem = new THREE.Mesh(new THREE.SphereGeometry(0.018, 12, 8), mat([0xff3b6b, 0x3b8bff, 0x3bd16f][i % 3], { clearcoat: 1, roughness: 0.1 })); gem.position.set(Math.cos(a) * 0.152, 0.035, Math.sin(a) * 0.152); g.add(gem);
    }
    g.position.set(0, mt.top - 0.045, 0);
    return g;
  },
  bryle: mt => {
    const g = new THREE.Group(), frame = mat(0xff4f8b), lens = new THREE.MeshPhysicalMaterial({ color: 0x222233, roughness: 0.05, transparent: true, opacity: 0.75, clearcoat: 1 });
    const half = Math.min(0.17, mt.width * 0.38);
    for (const s of [-1, 1]) {
      const l = new THREE.Mesh(new THREE.CircleGeometry(0.085, 28), lens); l.position.x = s * half;
      const r = new THREE.Mesh(new THREE.TorusGeometry(0.088, 0.012, 8, 28), frame); r.position.x = s * half;
      g.add(l, r);
    }
    const br = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, half * 2 - 0.17, 8), frame); br.rotation.z = Math.PI / 2; g.add(br);
    g.position.set(0, mt.faceY + 0.02, mt.front + 0.13);
    return g;
  },
  hvezda: mt => {
    const sh = new THREE.Shape();
    for (let i = 0; i < 10; i++) { const r = i % 2 ? 0.045 : 0.1, a = i / 10 * Math.PI * 2 + Math.PI / 2; sh[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r); }
    const g = new THREE.Group();
    const st = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.03, bevelEnabled: true, bevelSize: 0.01, bevelThickness: 0.01, bevelSegments: 2 }),
      new THREE.MeshStandardMaterial({ color: 0xffd84d, emissive: 0xffc400, emissiveIntensity: 1.4, roughness: 0.3 }));
    st.position.z = -0.015;
    g.add(st);
    g.position.set(0, mt.top + 0.32, 0);
    g.userData.spin = true;
    return g;
  },
  kridla: mt => {
    const g = new THREE.Group();
    const wm = new THREE.MeshPhysicalMaterial({ color: 0xd8c4ff, transparent: true, opacity: 0.6, roughness: 0.1, iridescence: 1, side: THREE.DoubleSide, depthWrite: false });
    const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.bezierCurveTo(0.12, 0.32, 0.4, 0.3, 0.36, 0.1); sh.bezierCurveTo(0.34, -0.05, 0.16, -0.06, 0, 0);
    const sh2 = new THREE.Shape(); sh2.moveTo(0, 0); sh2.bezierCurveTo(0.2, -0.02, 0.28, -0.2, 0.18, -0.24); sh2.bezierCurveTo(0.08, -0.26, 0.02, -0.12, 0, 0);
    for (const s of [-1, 1]) {
      const p = new THREE.Group();
      for (const shape of [sh, sh2]) { const w = new THREE.Mesh(new THREE.ShapeGeometry(shape), wm); w.scale.x = s; p.add(w); }
      p.position.x = s * 0.06; p.userData.side = s;
      g.add(p);
    }
    g.position.set(0, mt.top * 0.55, -mt.front * 0.85);
    g.userData.flap = true;
    return g;
  },
};

// Put the worn accessories on a monster holder; returns an updater for the moving ones.
export function wear(holder, ids = []) {
  const mon = holder.userData.monster;
  if (!mon || !mon.mount) return;
  const mt = mon.mount;
  mt.group.children.filter(c => c.userData.doplnek).forEach(c => c.removeFromParent());
  const parts = [];
  for (const id of ids) {
    if (!BUILD[id]) continue;
    const o = shadowy(BUILD[id](mt));
    o.userData.doplnek = id;
    // the same look as the monster, and it must vanish with it (otherwise a hat floats in the air during hide and seek)
    if (CARTOON) toonify(o);
    if (holder.userData.dissolve) joinDissolve(o, holder.userData.dissolve);
    mt.group.add(o);
    parts.push(o);
  }
  mon.doplnkyUpdate = t => {
    for (const o of parts) {
      if (o.userData.spin) { o.rotation.y = t * 1.5; o.position.y = mt.top + 0.32 + Math.sin(t * 2) * 0.03; }
      if (o.userData.flap) for (const p of o.children) p.rotation.y = p.userData.side * (0.5 + 0.35 * Math.sin(t * 7));
    }
  };
}
