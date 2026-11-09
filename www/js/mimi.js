// Monster babies: two monsters zapped together in the box get a baby.
// The baby takes its kind (slime, crystal, cloud, ghost…) from one parent and a colour between both of theirs.
// It starts small with big eyes and grows with every bit of care, until it is all grown up.
import * as THREE from 'three';
import { S } from './stav.js';
import { monsterStyle } from './monster2.js';
import { rng } from './monster.js';
import { monsterName } from './catalog.js';

const STEP = 0.1; // ten acts of care and the baby is grown up

const entryOf = m => S.album.find(a => a.seed === m.seed);
export const styleOf = m => m.style || entryOf(m)?.style || monsterStyle(m.seed, m.gen || 1);

// how the monster is built: kind, and for a baby how far it has grown
export function babyOpts(m) {
  const e = entryOf(m) || m;
  const o = { style: m.style || e.style };
  if (e.baby) { o.baby = true; o.rust = e.rust || 0; }
  return o;
}
// a baby is smaller: half size when born, full size when grown up (so the growing is easy to see)
export const babySize = o => (o.baby ? 0.5 + 0.5 * o.rust : 1);
// how many acts of care the baby has had out of the ten it needs
export const careDone = e => Math.round((e.rust || 0) * 10);

const colorOf = c => c.obj?.userData.monster?.color ?? c.monster.tint ?? 0xffffff;
export const isPair = (a, b) => a?.type === 'monster' && b?.type === 'monster';

export function babyOf(a, b) {
  const seed = (Math.random() * 2 ** 31) >>> 0 || 11;
  const tint = new THREE.Color(colorOf(a)).lerp(new THREE.Color(colorOf(b)), 0.5).getHex();
  const style = styleOf(Math.random() < 0.5 ? a.monster : b.monster);
  return { seed, name: monsterName(rng(seed)), tint, gen: 3, style, baby: true, rust: 0, rodice: [a.monster.name, b.monster.name] };
}

// the extra fields kept in the album for a baby
export const babyFields = m => (m.baby ? { style: m.style, baby: true, rust: 0, rodice: m.rodice } : m.style ? { style: m.style } : {});

// one act of care: the baby grows a little. Returns words for the bubble when something worth saying happened.
export function grow(c, entry) {
  if (!entry || !entry.baby) return '';
  const before = babySize(entry);
  entry.rust = Math.min(1, Math.round(((entry.rust || 0) + STEP) * 100) / 100);
  const after = babySize({ baby: true, rust: entry.rust });
  c.obj.scale.multiplyScalar(after / before);
  if (entry.rust >= 1) { delete entry.baby; entry.dospela = true; return `Hurá, ${entry.name} vyrostla! Už to není miminko, je z ní velká příšerka.`; }
  const n = careDone(entry);
  return `${entry.name} povyrostla! Ještě ${10 - n} ${10 - n === 1 ? 'péče' : 'péčí'} a bude velká.`;
}
