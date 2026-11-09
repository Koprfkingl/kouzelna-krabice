// Laser Boost ⚡: a golden laser shot. Not for money (a beta tester asked for one "for 5 euro"):
// every 5 stars from reading give one, and the Advent "season pass" gives a few more.
// A boosted monster comes out golden, anything else gets a bonus star, and there are fireworks.
import * as THREE from 'three';
import { S } from './stav.js';
import { store } from './util.js';
import { play } from './audio.js';
import { sparkles } from './scena.js';
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

// the celebration after a boosted shot; returns the extra words for the bubble
export function boostParty(c, centre) {
  S.boost = false;
  play('giggle');
  for (let i = 0; i < 4; i++) setTimeout(() => {
    sparkles.userData.emit(centre.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2, 0.6 + Math.random() * 0.8, (Math.random() - 0.5))), 60, 1.6, 0.5);
    play('zap');
  }, 300 + i * 350);
  for (const ch of ['🎆', '🌟', '⚡', '🎇']) floatUp(ch, centre, { n: 3, spread: 1.6, rise: 1.2, life: 2.6, size: 0.22 });
  if (c.type === 'monster') return 'Laser Boost: je zlatá!';
  const news = giveStar(centre);
  return 'Laser Boost: hvězdička navíc!' + (news ? ' ' + news : '');
}
