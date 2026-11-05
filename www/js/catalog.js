// Everything the box can transform, and everything it can make.
// kind: 'zive' (living: turns into a random cute monster), 'veci' (objects), 'stroje' (machines).
// g: grammatical gender of the name (m, f, n) for "se proměnil / proměnila / proměnilo".
// acc: the name in the accusative, for "na ...".
// size: the longest side in scene units; rot: turn around the vertical axis so the model faces the camera.

export const KINDS = [
  { id: 'zive', label: 'Živé', icon: '🦊' },
  { id: 'veci', label: 'Věci', icon: '🧸' },
  { id: 'stroje', label: 'Stroje', icon: '⚙️' },
  { id: 'fotky', label: 'Fotky', icon: '📷' },
];

export const ITEMS = [
  { id: 'liska', kind: 'zive', name: 'Liška', acc: 'lišku', g: 'f', file: 'Fox', size: 1.25, rot: -0.9, anim: 'Survey', sound: 'liska' },
  { id: 'ryba', kind: 'zive', name: 'Ryba', acc: 'rybu', g: 'f', file: 'BarramundiFish', size: 1.15, rot: -1.2, float: 0.35, sound: 'ryba' },
  { id: 'kytka', kind: 'zive', name: 'Kytka v květináči', acc: 'kytku v květináči', g: 'f', file: 'DiffuseTransmissionPlant', size: 1.15, rot: 0 },

  { id: 'avokado', kind: 'veci', name: 'Avokádo', acc: 'avokádo', g: 'n', file: 'Avocado', size: 0.55, rot: 0 },
  { id: 'lahev', kind: 'veci', name: 'Láhev', acc: 'láhev', g: 'f', file: 'WaterBottle', size: 0.85, rot: 0 },
  { id: 'lucerna', kind: 'veci', name: 'Lucerna', acc: 'lucernu', g: 'f', file: 'Lantern', size: 1.1, rot: 0 },
  { id: 'kuzel', kind: 'veci', name: 'Dopravní kužel', acc: 'dopravní kužel', g: 'm', file: 'TrafficCone', size: 0.8, rot: 0, hide: ['Cone Retroreflection', 'GroundPlane', 'Bulb'] },
  { id: 'vaza', kind: 'veci', name: 'Vázičky s kytičkami', acc: 'vázičky s kytičkami', g: 'p', file: 'GlassVaseFlowers', size: 1.0, rot: 0 },
  { id: 'hrnek', kind: 'veci', name: 'Hrnek', acc: 'hrnek', g: 'm', file: 'DiffuseTransmissionTeacup', size: 0.6, rot: 0 },
  { id: 'zidle', kind: 'veci', name: 'Židle', acc: 'židli', g: 'f', file: 'SheenChair', size: 1.1, rot: 0.6 },
  { id: 'bota', kind: 'veci', name: 'Bota', acc: 'botu', g: 'f', file: 'MaterialsVariantsShoe', size: 0.9, rot: -0.7 },

  { id: 'radio', kind: 'stroje', name: 'Rádio', acc: 'rádio', g: 'n', file: 'BoomBox', size: 0.95, rot: 0, sound: 'radio' },
  { id: 'fotak', kind: 'stroje', name: 'Starý fotoaparát', acc: 'starý fotoaparát', g: 'm', file: 'AntiqueCamera', size: 1.05, rot: 0.5, sound: 'fotak' },
  { id: 'auticko', kind: 'stroje', name: 'Autíčko', acc: 'autíčko', g: 'n', file: 'ToyCar', size: 1.0, rot: -0.6, hide: ['Fabric'], sound: 'auto' },
  { id: 'lednice', kind: 'stroje', name: 'Lednice', acc: 'lednici', g: 'f', file: 'CommercialRefrigerator', size: 1.2, rot: 0.25, sound: 'lednice' },
  { id: 'lampa', kind: 'stroje', name: 'Lampa', acc: 'lampu', g: 'f', file: 'AnisotropyBarnLamp', size: 1.0, rot: 0.4, sound: 'lampa' },
];

export const byId = id => ITEMS.find(i => i.id === id);

export function proměnil(g) {
  return g === 'f' ? 'se proměnila' : g === 'n' ? 'se proměnilo' : g === 'p' ? 'se proměnily' : 'se proměnil';
}

// Monster names: two cute syllables and an ending, e.g. "Bublinka", "Fifík", "Žužlík".
const S1 = ['Bu', 'Mu', 'Fí', 'Žu', 'Pi', 'Ťu', 'Ňu', 'Lu', 'Ko', 'Bo', 'Mí', 'Čí', 'Šu', 'Ku', 'Dů', 'Hu', 'Zu', 'Pu'];
const S2 = ['bl', 'ml', 'f', 'žl', 'pl', 'ťap', 'ňaf', 'l', 'k', 'mb', 'š', 'č', 'nd', 'p', 'r', 'ch'];
const END = ['inka', 'ík', 'ánek', 'ulka', 'ouš', 'ička', 'ínek', 'enka', 'íček', 'uška'];
export function monsterName(rand) {
  const p = a => a[Math.floor(rand() * a.length)];
  let n = p(S1) + p(S2).toLowerCase() + p(END);
  return n.charAt(0).toUpperCase() + n.slice(1);
}
export function monsterGender(name) {
  return /(a)$/.test(name) ? 'f' : 'm';
}
