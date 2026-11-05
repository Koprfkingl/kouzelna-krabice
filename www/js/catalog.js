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
  { id: 'kun', kind: 'zive', name: 'Koník', acc: 'koníka', g: 'm', file: 'Horse', size: 1.2, rot: -1.0, anim: 'horse_A_', sound: 'kun' },
  { id: 'papousek', kind: 'zive', name: 'Papoušek', acc: 'papouška', g: 'm', file: 'Parrot', size: 1.0, rot: -0.6, anim: 'parrot_A_', float: 0.3, sound: 'ptak' },
  { id: 'plamenak', kind: 'zive', name: 'Plameňák', acc: 'plameňáka', g: 'm', file: 'Flamingo', size: 1.2, rot: -0.7, anim: 'flamingo_flyA_', float: 0.25, sound: 'ptak' },
  { id: 'cap', kind: 'zive', name: 'Čáp', acc: 'čápa', g: 'm', file: 'Stork', size: 1.2, rot: -0.7, anim: 'storkFly_B_', float: 0.25, sound: 'ptak' },
  { id: 'kytka', kind: 'zive', name: 'Kytka v květináči', acc: 'kytku v květináči', g: 'f', file: 'DiffuseTransmissionPlant', size: 1.15, rot: 0 },

  { id: 'mandarinka', kind: 'veci', name: 'Mandarinka', acc: 'mandarinku', g: 'f', file: 'MandarinOrange', size: 0.45, rot: 0 },
  { id: 'micek', kind: 'veci', name: 'Míček', acc: 'míček', g: 'm', file: 'CarbonFibre', size: 0.55, rot: 0 },
  { id: 'olivy', kind: 'veci', name: 'Miska s olivami', acc: 'misku s olivami', g: 'f', file: 'IridescentDishWithOlives', size: 0.75, rot: 0 },
  { id: 'jantar', kind: 'veci', name: 'Komár v jantaru', acc: 'komára v jantaru', g: 'm', file: 'MosquitoInAmber', size: 0.6, rot: 0 },
  { id: 'taburet', kind: 'veci', name: 'Hedvábný taburet', acc: 'hedvábný taburet', g: 'm', file: 'SpecularSilkPouf', size: 0.8, rot: 0 },
  { id: 'pohovka', kind: 'veci', name: 'Sametová pohovka', acc: 'sametovou pohovku', g: 'f', file: 'GlamVelvetSofa', size: 1.25, rot: 0.3 },
  { id: 'avokado', kind: 'veci', name: 'Avokádo', acc: 'avokádo', g: 'n', file: 'Avocado', size: 0.55, rot: 0 },
  { id: 'lahev', kind: 'veci', name: 'Láhev', acc: 'láhev', g: 'f', file: 'WaterBottle', size: 0.85, rot: 0 },
  { id: 'lucerna', kind: 'veci', name: 'Lucerna', acc: 'lucernu', g: 'f', file: 'Lantern', size: 1.1, rot: 0 },
  { id: 'kuzel', kind: 'veci', name: 'Dopravní kužel', acc: 'dopravní kužel', g: 'm', file: 'TrafficCone', size: 0.8, rot: 0, hide: ['Cone Retroreflection', 'GroundPlane', 'Bulb'] },
  { id: 'vaza', kind: 'veci', name: 'Vázičky s kytičkami', acc: 'vázičky s kytičkami', g: 'p', file: 'GlassVaseFlowers', size: 1.0, rot: 0 },
  { id: 'hrnek', kind: 'veci', name: 'Hrnek', acc: 'hrnek', g: 'm', file: 'DiffuseTransmissionTeacup', size: 0.6, rot: 0 },
  { id: 'zidle', kind: 'veci', name: 'Židle', acc: 'židli', g: 'f', file: 'SheenChair', size: 1.1, rot: 0.6 },
  { id: 'bota', kind: 'veci', name: 'Bota', acc: 'botu', g: 'f', file: 'MaterialsVariantsShoe', size: 0.9, rot: -0.7 },

  { id: 'robot', kind: 'stroje', name: 'Robot', acc: 'robota', g: 'm', file: 'RobotExpressive', size: 1.15, rot: -0.3, anim: 'Idle', sound: 'robot' },
  { id: 'vitraz', kind: 'stroje', name: 'Barevná lampa', acc: 'barevnou lampu', g: 'f', file: 'StainedGlassLamp', size: 1.0, rot: 0, sound: 'lampa' },
  { id: 'duhova', kind: 'stroje', name: 'Duhová lampička', acc: 'duhovou lampičku', g: 'f', file: 'IridescenceLamp', size: 0.9, rot: 0, sound: 'lampa' },
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

// Monster names: a fixed, hand-picked list, so no generated word can come out rude or silly.
export const MONSTER_NAMES = [
  'Bublinka', 'Mňaminka', 'Fifinka', 'Pusinka', 'Ťapinka', 'Kulička', 'Lentilka', 'Bambulka', 'Hvězdička', 'Jahůdka',
  'Malinka', 'Borůvka', 'Karamelka', 'Perlička', 'Duhůvka', 'Vločka', 'Kapička', 'Čepička', 'Rozinka', 'Šiška',
  'Mufinka', 'Sluníčko', 'Mráček', 'Puntík', 'Chlupáček', 'Bonbónek', 'Knoflík', 'Drobeček', 'Ťuťánek', 'Fazolka',
  'Medvídek', 'Pampeliška', 'Kokosek', 'Žužu', 'Mimi', 'Pupík', 'Bambule', 'Cukrátko', 'Bobík', 'Fíla',
  'Kuliferda', 'Mrkvička', 'Pecička', 'Hopsálek', 'Tulipánek', 'Koblížek', 'Mlsoun', 'Pudink', 'Míša', 'Lízátko',
];
export function monsterName(rand) {
  // Uses three random numbers on purpose: older versions did too, so saved monsters keep their looks.
  const a = rand(), b = rand(), c = rand();
  return MONSTER_NAMES[Math.floor(((a + b + c) % 1) * MONSTER_NAMES.length)];
}
