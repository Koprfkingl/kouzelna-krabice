// The Book of Spells: two things put into the box together. Some pairs make a secret creation,
// every other pair mixes into a brand-new monster.
import * as THREE from 'three';

// a, b: catalog ids (order does not matter). base: the model the creation is made of.
// effect: how its materials change. attach: a second, smaller model put onto it
// (size in scene units, at: [x, height as a fraction of the base, z]).
export const KOUZLA = [
  { id: 'kvetouci-liska', a: 'liska', b: 'kytka', name: 'Kvetoucí liška', acc: 'kvetoucí lišku', g: 'f', icon: '🦊🌸', base: 'liska', effect: 'kvet', attach: { id: 'vaza', size: 0.34, at: [-0.08, 0.5, 0.0] } },
  { id: 'ryba-v-lahvi', a: 'ryba', b: 'lahev', name: 'Rybička v láhvi', acc: 'rybičku v láhvi', g: 'f', icon: '🐟🍾', base: 'lahev', effect: 'sklo', attach: { id: 'ryba', size: 0.32, at: [0, 0.32, 0], float: true } },
  { id: 'robokonik', a: 'kun', b: 'robot', name: 'Robokoník', acc: 'robokoníka', g: 'm', icon: '🐴🤖', base: 'kun', effect: 'kov' },
  { id: 'duhovy-papousek', a: 'papousek', b: 'radio', name: 'Zpívající duhový papoušek', acc: 'zpívajícího duhového papouška', g: 'm', icon: '🦜📻', base: 'papousek', effect: 'duha', sound: 'radio' },
  { id: 'zmrzla-mandarinka', a: 'mandarinka', b: 'lednice', name: 'Zmrzlá mandarinka', acc: 'zmrzlou mandarinku', g: 'f', icon: '🍊🧊', base: 'mandarinka', effect: 'led', size: 0.7 },
  { id: 'svitici-jantar', a: 'jantar', b: 'lampa', name: 'Svítící jantar', acc: 'svítící jantar', g: 'm', icon: '🪲💡', base: 'jantar', effect: 'svetlo', sound: 'lampa' },
  { id: 'papousek-ridic', a: 'auticko', b: 'papousek', name: 'Papoušek řidič', acc: 'papouška řidiče', g: 'm', icon: '🚗🦜', base: 'auticko', attach: { id: 'papousek', size: 0.42, at: [0, 0.78, 0.0] }, sound: 'auto' },
  { id: 'botka-s-kytkou', a: 'bota', b: 'kytka', name: 'Botička s kytičkou', acc: 'botičku s kytičkou', g: 'f', icon: '👟🪴', base: 'bota', attach: { id: 'kytka', size: 0.45, at: [-0.1, 0.45, 0] } },
  { id: 'rybka-v-hrnku', a: 'hrnek', b: 'ryba', name: 'Rybka v hrnku', acc: 'rybku v hrnku', g: 'f', icon: '☕🐟', base: 'hrnek', attach: { id: 'ryba', size: 0.32, at: [0, 0.75, 0], float: true } },
  { id: 'zlaty-robot', a: 'robot', b: 'fotak', name: 'Zlatý robot', acc: 'zlatého robota', g: 'm', icon: '🤖✨', base: 'robot', effect: 'zlato', sound: 'robot' },
  { id: 'liska-na-gauci', a: 'pohovka', b: 'liska', name: 'Liška na gauči', acc: 'lišku na gauči', g: 'f', icon: '🛋️🦊', base: 'pohovka', attach: { id: 'liska', size: 0.55, at: [0, 0.42, 0.08] } },
  { id: 'duhove-kyticky', a: 'vaza', b: 'duhova', name: 'Duhové kytičky', acc: 'duhové kytičky', g: 'p', icon: '💐🌈', base: 'vaza', effect: 'duha' },
  { id: 'obri-avokado', a: 'avokado', b: 'kuzel', name: 'Obří avokádo', acc: 'obří avokádo', g: 'n', icon: '🥑⬆️', base: 'avokado', size: 1.3 },
  { id: 'nocni-lucerna', a: 'lucerna', b: 'jantar', name: 'Kouzelná lucerna', acc: 'kouzelnou lucernu', g: 'f', icon: '🏮✨', base: 'lucerna', effect: 'svetlo', sound: 'lampa' },
  { id: 'zlata-zidle', a: 'zidle', b: 'mandarinka', name: 'Pomerančová židle', acc: 'pomerančovou židli', g: 'f', icon: '🪑🍊', base: 'zidle', effect: 'oranzova' },
  { id: 'kun-plamenak', a: 'kun', b: 'plamenak', name: 'Růžový koník', acc: 'růžového koníka', g: 'm', icon: '🐴🩷', base: 'kun', effect: 'ruzova' },
];
export const kouzloById = id => KOUZLA.find(k => k.id === id);
export const findKouzlo = (a, b) => KOUZLA.find(k => (k.a === a && k.b === b) || (k.a === b && k.b === a));

// Changes the materials of a built model.
export function applyEffect(root, effect) {
  if (!effect) return;
  const hue = { i: 0 };
  root.traverse(o => {
    if (!o.isMesh) return;
    const mats = (Array.isArray(o.material) ? o.material : [o.material]).map(m0 => {
      const m = m0.clone();
      switch (effect) {
        case 'zlato': m.color?.set(0xf5c542); m.metalness = 1; m.roughness = 0.22; if (m.map) m.map = null; break;
        case 'kov': m.color?.lerp(new THREE.Color(0xdfe6f0), 0.8); m.metalness = 0.55; m.roughness = 0.3; if ('emissive' in m) { m.emissive = new THREE.Color(0x4a5a70); m.emissiveIntensity = 0.35; } break;
        case 'sklo': m.transparent = true; m.opacity = 0.3; m.depthWrite = false; m.roughness = 0.05; break;
        case 'led': m.color?.lerp(new THREE.Color(0xbfe9ff), 0.65); m.roughness = 0.08; m.metalness = 0.1; m.transparent = true; m.opacity = 0.85;
          if ('emissive' in m) { m.emissive = new THREE.Color(0x3a7bd5); m.emissiveIntensity = 0.25; } break;
        case 'svetlo': if ('emissive' in m) { m.emissive = (m.color || new THREE.Color(0xffd36e)).clone().lerp(new THREE.Color(0xffd36e), 0.5); m.emissiveIntensity = 1.3; if (m.map) m.emissiveMap = m.map; } break;
        case 'duha': { const c = new THREE.Color().setHSL((hue.i++ * 0.17) % 1, 0.85, 0.6); m.color?.lerp(c, 0.7); if ('emissive' in m) { m.emissive = c; m.emissiveIntensity = 0.15; } break; }
        case 'oranzova': m.color?.lerp(new THREE.Color(0xff9a3c), 0.75); break;
        case 'ruzova': m.color?.lerp(new THREE.Color(0xff8fc8), 0.7); break;
        case 'kvet': m.color?.lerp(new THREE.Color(0xffb3d9), 0.25); break;
      }
      m.needsUpdate = true;
      return m;
    });
    o.material = Array.isArray(o.material) ? mats : mats[0];
  });
}
