// Room decorations from the daily chest, built from simple shapes (no downloads, few triangles).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const M = (color, o = {}) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.55, clearcoat: 0.3, ...o });
const mesh = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; return m; };
const rx = (m, a) => { m.rotation.x = a; return m; };
const S = (r, w = 20, h = 14) => new THREE.SphereGeometry(r, w, h);

function letterTex(ch, bg) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, 128, 128);
  g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = 10; g.strokeRect(8, 8, 112, 112);
  g.fillStyle = '#fff'; g.font = '900 86px Nunito, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ch, 64, 70);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

const BUILD = {
  medvidek() {
    const g = new THREE.Group(), fur = M(0xb07a4a, { roughness: 0.9, clearcoat: 0, sheen: 1, sheenColor: 0xffd9b0 }), light = M(0xf1d1a8, { roughness: 0.9, clearcoat: 0 }), dark = M(0x2a1a12, { roughness: 0.3 });
    const body = mesh(S(0.16), fur, 0, 0.17, 0); body.scale.set(1, 1.1, 0.9); g.add(body);
    g.add(mesh(S(0.09), light, 0, 0.16, 0.1));
    g.add(mesh(S(0.12), fur, 0, 0.4, 0));
    g.add(mesh(S(0.05), light, 0, 0.38, 0.1));
    g.add(mesh(S(0.02), dark, 0, 0.4, 0.15));
    for (const s of [-1, 1]) {
      g.add(mesh(S(0.045), fur, s * 0.09, 0.5, 0)); g.add(mesh(S(0.017), dark, s * 0.045, 0.44, 0.105));
      const arm = mesh(S(0.055), fur, s * 0.15, 0.22, 0.04); arm.scale.set(0.8, 1.3, 0.8); g.add(arm);
      const leg = mesh(S(0.065), fur, s * 0.09, 0.05, 0.08); leg.scale.set(1, 0.8, 1.3); g.add(leg);
    }
    const bow = mesh(new THREE.TorusGeometry(0.03, 0.015, 8, 16), M(0xff4f8b), 0, 0.31, 0.1); g.add(bow);
    return g;
  },
  balonky() {
    const g = new THREE.Group();
    g.add(mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.06, 16), M(0x7c4dff), 0, 0.03, 0));
    [[0xff4f8b, -0.12, 0.75], [0xffd36e, 0.1, 0.82], [0x5fd4a8, 0, 0.95], [0x5b8def, 0.15, 0.66]].forEach(([c, x, y]) => {
      const b = mesh(S(0.1, 24, 16), M(c, { roughness: 0.15, clearcoat: 1 }), x, y, (x * 3) % 0.1); b.scale.y = 1.18; g.add(b);
      const pts = [new THREE.Vector3(0, 0.06, 0), new THREE.Vector3(x * 0.4, y * 0.5, 0.02), new THREE.Vector3(x, y - 0.12, (x * 3) % 0.1)];
      g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 12, 0.003, 4), M(0xffffff)));
    });
    g.userData.sway = true;
    return g;
  },
  raketa() {
    const g = new THREE.Group(), white = M(0xf4f4f8, { metalness: 0.2 }), red = M(0xff4f5e);
    g.add(mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.36, 24), white, 0, 0.3, 0));
    g.add(mesh(new THREE.ConeGeometry(0.1, 0.2, 24), red, 0, 0.58, 0));
    g.add(rx(mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.02, 20), M(0x5fb8ff, { roughness: 0.05 }), 0, 0.36, 0.095), Math.PI / 2));
    for (let i = 0; i < 3; i++) { const f = mesh(new THREE.BoxGeometry(0.02, 0.14, 0.1), red); const a = i / 3 * Math.PI * 2; f.position.set(Math.sin(a) * 0.11, 0.15, Math.cos(a) * 0.11); f.rotation.y = a; g.add(f); }
    g.add(rx(mesh(new THREE.ConeGeometry(0.07, 0.1, 16), M(0xffb347, { emissive: 0xff7a00, emissiveIntensity: 1.2 }), 0, 0.07, 0), Math.PI));
    return g;
  },
  kaktus() {
    const g = new THREE.Group(), green = M(0x4caf6a, { roughness: 0.7 });
    g.add(mesh(new THREE.CylinderGeometry(0.12, 0.09, 0.16, 20), M(0xe07a4f, { roughness: 0.8 }), 0, 0.08, 0));
    g.add(mesh(new THREE.CapsuleGeometry(0.07, 0.24, 6, 14), green, 0, 0.34, 0));
    for (const s of [-1, 1]) { const arm = mesh(new THREE.CapsuleGeometry(0.04, 0.1, 6, 12), green, s * 0.1, 0.36 + s * 0.04, 0); g.add(arm); }
    g.add(mesh(S(0.035), M(0xff6fb5), 0, 0.53, 0));
    return g;
  },
  duha() {
    const g = new THREE.Group();
    [0xff5e5e, 0xffa04f, 0xffe066, 0x6fd38a, 0x5b9dff, 0x9b6bff].forEach((c, i) => g.add(mesh(new THREE.TorusGeometry(0.32 - i * 0.04, 0.02, 10, 40, Math.PI), M(c, { roughness: 0.35 }), 0, 0.06, 0)));
    for (const s of [-1, 1]) { const cl = mesh(S(0.08), M(0xffffff, { roughness: 0.9, clearcoat: 0 }), s * 0.26, 0.06, 0); cl.scale.set(1.4, 0.8, 0.8); g.add(cl); }
    return g;
  },
  kostky() {
    const g = new THREE.Group();
    [['A', '#ff5e7e', -0.1, 0.07, 0.2], ['B', '#5b9dff', 0.1, 0.07, -0.15], ['C', '#ffb347', 0, 0.21, 0.1]].forEach(([ch, col, x, y, r]) => {
      const t = letterTex(ch, col);
      const b = mesh(new RoundedBoxGeometry(0.14, 0.14, 0.14, 2, 0.015), new THREE.MeshStandardMaterial({ map: t, roughness: 0.5 }), x, y, 0); b.rotation.y = r; g.add(b);
    });
    return g;
  },
  houbicka() {
    const g = new THREE.Group();
    g.add(mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.22, 20), M(0xfff4e6, { emissive: 0xffe2b0, emissiveIntensity: 0.4 }), 0, 0.11, 0));
    const cap = mesh(new THREE.SphereGeometry(0.17, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), M(0xff4f5e, { emissive: 0xff2a3c, emissiveIntensity: 0.55 }), 0, 0.2, 0); cap.scale.y = 0.75; g.add(cap);
    for (let i = 0; i < 6; i++) { const a = i * 1.1, d = mesh(S(0.025, 10, 8), M(0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.6 })); d.position.set(Math.cos(a) * 0.11, 0.29 - (i % 2) * 0.03, Math.sin(a) * 0.11); g.add(d); }
    return g;
  },
  snehulak() {
    const g = new THREE.Group(), snow = M(0xffffff, { roughness: 0.8, clearcoat: 0.1, sheen: 1, sheenColor: 0xdfefff });
    g.add(mesh(S(0.15), snow, 0, 0.14, 0)); g.add(mesh(S(0.11), snow, 0, 0.36, 0)); g.add(mesh(S(0.08), snow, 0, 0.53, 0));
    g.add(rx(mesh(new THREE.ConeGeometry(0.018, 0.09, 10), M(0xff8a2a), 0, 0.53, 0.11), Math.PI / 2));
    for (const s of [-1, 1]) g.add(mesh(S(0.012), M(0x222222), s * 0.03, 0.56, 0.072));
    g.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.08, 20), M(0x222233), 0, 0.64, 0)); g.add(mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.012, 20), M(0x222233), 0, 0.6, 0));
    g.add(rx(mesh(new THREE.TorusGeometry(0.09, 0.025, 8, 20), M(0xff4f8b, { roughness: 0.9, clearcoat: 0 }), 0, 0.45, 0), Math.PI / 2));
    return g;
  },
  kacenka() {
    const g = new THREE.Group(), y = M(0xffd84d, { roughness: 0.25, clearcoat: 1 });
    const body = mesh(S(0.15, 24, 16), y, 0, 0.13, 0); body.scale.set(1.2, 0.85, 1); g.add(body);
    g.add(mesh(S(0.1, 24, 16), y, 0.08, 0.3, 0));
    const beak = mesh(S(0.05), M(0xff8a2a, { roughness: 0.3 }), 0.18, 0.28, 0); beak.scale.set(1.2, 0.4, 0.8); g.add(beak);
    for (const s of [-1, 1]) g.add(mesh(S(0.018), M(0x222222), 0.15, 0.33, s * 0.05));
    const tail = mesh(new THREE.ConeGeometry(0.05, 0.1, 12), y, -0.18, 0.2, 0); tail.rotation.z = 1.0; g.add(tail);
    return g;
  },
  dort() {
    const g = new THREE.Group();
    g.add(mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.14, 32), M(0xffc1d9, { roughness: 0.7 }), 0, 0.07, 0));
    g.add(mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.12, 32), M(0xfff4f8, { roughness: 0.7 }), 0, 0.2, 0));
    for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; g.add(mesh(S(0.022, 8, 6), M([0xff4f5e, 0x5fd4a8, 0xffd36e][i % 3]), Math.cos(a) * 0.18, 0.15, Math.sin(a) * 0.18)); }
    g.add(mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.09, 8), M(0x5b9dff), 0, 0.3, 0));
    const fl = mesh(S(0.018, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffc94d }), 0, 0.36, 0); fl.scale.y = 1.6; g.add(fl);
    return g;
  },
  koule() {
    const g = new THREE.Group();
    g.add(mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.08, 24), M(0x6b3fa0, { metalness: 0.6, roughness: 0.3 }), 0, 0.04, 0));
    g.add(mesh(S(0.15, 32, 20), M(0xc9a2ff, { roughness: 0.02, transparent: true, opacity: 0.55, emissive: 0x7c4dff, emissiveIntensity: 0.5, clearcoat: 1 }), 0, 0.22, 0));
    g.add(mesh(S(0.05, 16, 10), M(0xffffff, { emissive: 0xffd36e, emissiveIntensity: 1.5 }), 0, 0.22, 0));
    g.userData.glow = true;
    return g;
  },
  globus() {
    const c = document.createElement('canvas'); c.width = 256; c.height = 128;
    const x = c.getContext('2d'); x.fillStyle = '#3d8ee8'; x.fillRect(0, 0, 256, 128); x.fillStyle = '#5fc46a';
    for (const [a, b, r] of [[40, 40, 22], [60, 70, 16], [130, 45, 26], [150, 80, 18], [200, 50, 20], [215, 95, 12], [100, 100, 10]]) { x.beginPath(); x.arc(a, b, r, 0, 7); x.fill(); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const g = new THREE.Group();
    g.add(mesh(new THREE.CylinderGeometry(0.08, 0.11, 0.04, 24), M(0x8a5a2b), 0, 0.02, 0));
    g.add(mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.12, 8), M(0xd9a84e, { metalness: 1, roughness: 0.3 }), 0, 0.09, 0));
    const ball = mesh(S(0.15, 32, 20), new THREE.MeshStandardMaterial({ map: t, roughness: 0.35 }), 0, 0.3, 0); ball.rotation.z = 0.4; g.add(ball);
    g.userData.spinBall = ball;
    return g;
  },
};

export const OZDOBY = [
  { id: 'medvidek', nazev: 'Plyšový medvídek', ikona: '🧸' },
  { id: 'balonky', nazev: 'Balónky', ikona: '🎈' },
  { id: 'raketa', nazev: 'Raketa', ikona: '🚀' },
  { id: 'kostky', nazev: 'Kostky s písmenky', ikona: '🔤' },
  { id: 'duha', nazev: 'Duha', ikona: '🌈' },
  { id: 'houbicka', nazev: 'Svítící houbička', ikona: '🍄' },
  { id: 'kacenka', nazev: 'Kačenka', ikona: '🐤' },
  { id: 'kaktus', nazev: 'Kaktus', ikona: '🌵' },
  { id: 'snehulak', nazev: 'Sněhulák', ikona: '⛄' },
  { id: 'dort', nazev: 'Dort', ikona: '🎂' },
  { id: 'koule', nazev: 'Kouzelná koule', ikona: '🔮' },
  { id: 'globus', nazev: 'Glóbus', ikona: '🌍' },
].map(o => ({ ...o, build: BUILD[o.id] }));
export const ozdobaById = id => OZDOBY.find(o => o.id === id);
export function buildOzdoba(id) {
  const o = ozdobaById(id);
  const g = o.build();
  g.userData.ozdoba = id;
  return g;
}
export function updateOzdoba(g, t) {
  if (g.userData.sway) g.rotation.z = Math.sin(t * 1.3) * 0.05;
  if (g.userData.spinBall) g.userData.spinBall.rotation.y = t * 0.6;
}
