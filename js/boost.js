// Laser Boost ⚡: a golden laser shot. Not for money (a beta tester asked for one "for 5 euro"):
// every 5 stars from reading give one, and the Advent "season pass" gives a few more.
// A boosted monster comes out golden, anything else gets a bonus star, and there are fireworks.
import * as THREE from 'three';
import { S } from './stav.js';
import { store } from './util.js';
import { play } from './audio.js';
import { scene, sparkles } from './scena.js';
import { animate } from './util.js';
import { floatUp } from './pece.js';
import { giveStar } from './citanka.js';

const GOLD = 0xffd34d;
let st = { bonus: 0, used: 0, ...store.get('kk-boost', {}) };
const save = () => store.set('kk-boost', st);

export const boostCount = () => Math.max(0, Math.floor(S.stars / 5) + st.bonus - st.used);
export function addBoost(n) { st.bonus += n; save(); }
export function useBoost() { if (boostCount() < 1) return false; st.used++; save(); S.boost = true; return true; }

// what the laser makes, golden when boosted
export function boosted(target) {
  if (!S.boost || target.type !== 'monster') return target;
  return { ...target, monster: { ...target.monster, tint: GOLD } };
}

function shockwave(centre) {
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.035, 10, 64), new THREE.MeshBasicMaterial({ color: GOLD, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  ring.rotation.x = Math.PI / 2;
  ring.position.copy(centre);
  scene.add(ring);
  animate(1.1, k => { ring.scale.setScalar(1 + k * 6); ring.position.y = centre.y + k * 0.4; ring.material.opacity = 1 - k; }).then(() => { ring.removeFromParent(); ring.geometry.dispose(); ring.material.dispose(); });
}

// the celebration after a boosted shot; returns the extra words for the bubble
export function boostParty(c, centre) {
  S.boost = false;
  play('giggle');
  // fireworks: golden bursts one after another, with a coloured one in between
  const GOLDEN = new THREE.Color(1.7, 1.05, 0.12);
  for (let i = 0; i < 9; i++) setTimeout(() => {
    sparkles.userData.emit(centre.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2.4, 0.5 + Math.random() * 1.1, (Math.random() - 0.5))), 90, 2.2, 0.4, i % 3 === 2 ? null : GOLDEN);
    play('zap');
  }, 250 + i * 260);
  // golden rings flying out of the box
  for (let i = 0; i < 3; i++) setTimeout(() => shockwave(centre), i * 320);
  for (const ch of ['🎆', '🌟', '⚡', '🎇', '👑', '✨']) floatUp(ch, centre, { n: 3, spread: 1.8, rise: 1.4, life: 2.8, size: 0.24 });
  if (c.type === 'monster') return 'Laser Boost: je zlatá!';
  const news = giveStar(centre);
  return 'Laser Boost: hvězdička navíc!' + (news ? ' ' + news : '');
}
