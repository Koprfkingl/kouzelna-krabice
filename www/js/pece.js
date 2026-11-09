// Caring for monsters.
import * as THREE from 'three';
import { play } from './audio.js';
import { a as rod } from './hrac.js';
import { S } from './stav.js';
import { choose, hideBubble, saveAlbum, setPhase, showBubble, speak, tile } from './main.js';
import { $, animate, centerOf, disposeObj, ease, store } from './util.js';
import { camera, fill, key, scene, sparkles } from './scena.js';
import { dayEvent } from './den.js';
import { grow } from './mimi.js';

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
const albumEntry = c => c && c.type === 'monster' ? S.album.find(a => a.seed === c.monster.seed) : null;
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
  const c = S.current, a = albumEntry(c);
  if (!a || careBusy) return;
  careBusy = true;
  S.busy = true;
  hideBubble();
  try {
    ageCare(a);
    const say = await CARE[need.id](c, a);
    a.pece[need.id] = need.id === 'zdravi' ? 100 : Math.min(100, a.pece[need.id] + 45);
    const grew = grow(c, a); // a baby grows a little with every bit of care
    if (grew) floatUp(a.baby ? '📏' : '🎉', centerOf(c.obj).c, { n: 3, spread: 0.6, rise: 0.8 });
    saveAlbum();
    showBubble(grew ? say + ' ' + grew : say); speak(grew ? say + ' ' + grew : say);
    dayEvent('pece', { need: need.id });
  } finally { careBusy = false; S.busy = false; }
  if (S.phase === 'care') setPhase('care');
}
let lastStroke = 0;
function pet() {
  const c = S.current, a = albumEntry(c);
  if (!a || careBusy) return;
  const now = performance.now();
  if (now - lastStroke < 180) return;
  lastStroke = now;
  ageCare(a);
  a.pece.mazleni = Math.min(100, a.pece.mazleni + 3);
  floatUp('💖', centerOf(c.obj).c.add(new THREE.Vector3((Math.random() - 0.5) * 0.3, 0.2, 0.2)), { n: 1, size: 0.12 });
  if (Math.random() < 0.25) play('love');
  c.bounce.rotation.z = (Math.random() - 0.5) * 0.12;
  clearTimeout(pet.t); pet.t = setTimeout(() => { c.bounce.rotation.z = 0; saveAlbum(); if (S.phase === 'care') renderCare(); }, 600);
}
function renderCare() {
  const a = albumEntry(S.current), box_ = $('pece');
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
  $('foto-otazka').textContent = `Co jsi vyfotil${rod('a', '')}?`;
  speak(`Co jsi vyfotil${rod('a', '')}?`);
  $('foto-dotaz').querySelectorAll('[data-druh]').forEach(b => {
    b.onclick = () => {
      play('tap');
      photo.kind = b.dataset.druh;
      S.photos.unshift(photo);
      S.photos = S.photos.slice(0, 16);
      while (!store.set('kk-fotky', S.photos) && S.photos.length > 1) S.photos.pop();
      $('foto-dotaz').hidden = true;
      choose({ type: 'photo', photo });
    };
  });
}
$('foto-zrusit').addEventListener('click', () => { $('foto-dotaz').hidden = true; });

export { NEEDS, ageCare, albumEntry, canvasTexture, doCare, emojiSprite, emojiTexCache, floatUp, freshCare, hop, moodOf, neediest,
  pet, renderCare, updateFloaters };
