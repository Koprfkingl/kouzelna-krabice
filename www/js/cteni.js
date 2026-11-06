// Reading with monsters: words with pictures, split into syllables (as in a Czech first-grade reader).
// Levels: 1 letter, 2 syllable, 3 word, 4 a message from the monster (a short sentence).

// Word, picture. Syllables are separated by '-'.
export const SLOVA = [
  ['PES', '🐶'], ['MÍČ', '⚽'], ['LES', '🌲'], ['DŮM', '🏠'], ['SÝR', '🧀'], ['NOS', '👃'], ['ZUB', '🦷'], ['HAD', '🐍'],
  ['LEV', '🦁'], ['VLK', '🐺'], ['MYŠ', '🐭'], ['VLAK', '🚂'], ['LOĎ', '⛵'], ['DORT', '🎂'], ['SNÍH', '❄️'], ['SLON', '🐘'],
  ['AU-TO', '🚗'], ['O-KO', '👁️'], ['U-CHO', '👂'], ['RY-BA', '🐟'], ['LIŠ-KA', '🦊'], ['KO-LO', '🚲'], ['MĚ-SÍC', '🌙'],
  ['KYT-KA', '🌷'], ['HRUŠ-KA', '🍐'], ['BA-NÁN', '🍌'], ['MR-KEV', '🥕'], ['ME-LOUN', '🍉'], ['MLÉ-KO', '🥛'], ['RA-KE-TA', '🚀'],
  ['KO-RU-NA', '👑'], ['SO-VA', '🦉'], ['KO-ZA', '🐐'], ['ŽÁ-BA', '🐸'], ['KRÁ-VA', '🐮'], ['PRA-SE', '🐷'], ['OV-CE', '🐑'],
  ['KU-ŘE', '🐤'], ['TY-GR', '🐯'], ['O-PI-CE', '🐵'], ['ŽI-RA-FA', '🦒'], ['VE-VER-KA', '🐿️'], ['MO-TÝL', '🦋'], ['BO-TA', '👟'],
  ['ČE-PI-CE', '🧢'], ['DÁ-REK', '🎁'], ['BA-LÓN', '🎈'], ['LAM-PA', '💡'], ['MÁ-MA', '👩'], ['TÁ-TA', '👨'], ['VO-DA', '💧'],
  ['RU-KA', '✋'], ['NO-HA', '🦵'], ['SRD-CE', '❤️'], ['HR-NEK', '☕'], ['KNI-HA', '📖'], ['PE-RO', '🖊️'], ['DU-HA', '🌈'],
  ['MED-VĚD', '🐻'], ['KOČ-KA', '🐱'], ['SLUN-CE', '☀️'], ['HVĚZ-DA', '⭐'], ['JA-BL-KO', '🍎'], ['VA-JÍČ-KO', '🥚'],
  ['ZMRZ-LI-NA', '🍦'], ['MRAK', '☁️'], ['KA-ČE-NA', '🦆'],
].map(([w, e]) => ({ w, e, plain: w.replace(/-/g, ''), syl: w.split('-') }));

// Messages from the monster: what it wants (answered with a care action) …
export const VZKAZY_PECE = [
  { t: 'MÁM HLAD.', need: 'jidlo' }, { t: 'CHCI JÍST.', need: 'jidlo' }, { t: 'DEJ MI NĚ-CO DO BŘÍŠ-KA.', need: 'jidlo' },
  { t: 'MÁM ŽÍ-ZEŇ.', need: 'piti' }, { t: 'DEJ MI NA-PÍT.', need: 'piti' },
  { t: 'CHCI SPÁT.', need: 'spanek' }, { t: 'JSEM O-SPA-LÁ.', need: 'spanek' },
  { t: 'PO-HLAĎ MĚ.', need: 'mazleni' }, { t: 'DEJ MI PU-SU.', need: 'mazleni' },
  { t: 'POJĎ SI HRÁT.', need: 'hra' }, { t: 'CHCI SI HRÁT S MÍ-ČEM.', need: 'hra' },
  { t: 'BO-LÍ MĚ BŘÍŠ-KO.', need: 'zdravi' }, { t: 'BO-LÍ MĚ NO-ŽIČ-KA.', need: 'zdravi' },
];
// … or a question about a picture
export const VZKAZY_OTAZKA = ['KDE JE {}?', 'NA OB-RÁZ-KU JE {}.'];

const pick = a => a[Math.floor(Math.random() * a.length)];
const shuffle = a => a.map(x => [Math.random(), x]).sort((p, q) => p[0] - q[0]).map(x => x[1]);

// Three different pictures: the answer and two others that do not share the key (first letter, first syllable, word).
function pictures(key, answer, preferSameLetter) {
  const others = SLOVA.filter(s => s !== answer && key(s) !== key(answer) && !s.plain.startsWith(key(answer)));
  let pool = others;
  if (preferSameLetter) {
    const same = others.filter(s => s.plain[0] === answer.plain[0]);
    if (same.length) pool = [pick(same), ...shuffle(others.filter(s => s.plain[0] !== answer.plain[0]))];
    else pool = shuffle(others);
  } else pool = shuffle(others);
  const chosen = [];
  for (const s of pool) { if (chosen.length >= 2) break; if (!chosen.some(c => key(c) === key(s))) chosen.push(s); }
  return shuffle([answer, ...chosen]);
}

// Choosing tasks. Balance matters more than drilling: most tasks are things that go well or new easy ones,
// a hard one only now and then, and after a mistake the child climbs back up a little staircase of easier
// related steps (letter → syllable → easier word → the word again) instead of getting the hard thing again.
// stats[key] = { ok, miss, streak } where ok/miss count first tries.
export const statKey = (level, k) => `${level}:${k}`;
const uniq = a => [...new Set(a)];
const LETTERS = uniq(SLOVA.filter(s => !s.plain.startsWith('CH')).map(s => s.plain[0]));
const SYLLABLES = uniq(SLOVA.filter(s => s.syl.length > 1).map(s => s.syl[0]));
const DIA = /[ÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ]/;
// how easy something looks for a beginner (bigger = easier)
const simple = {
  1: L => (DIA.test(L) ? 0.5 : 1),
  2: S => (S.length === 2 && /[AEIOUY]$/.test(S) ? 1 : 0.5) * (DIA.test(S) ? 0.6 : 1),
  3: w => 1 / (0.5 + w.syl.length * 0.5) * (w.plain.length <= 4 ? 1.3 : 1) * (DIA.test(w.plain) ? 0.75 : 1),
  4: v => 1 / (1 + v.t.split(' ').length * 0.2),
};
const keyOf = { 1: x => x, 2: x => x, 3: w => w.plain, 4: v => v.t };
const ST = (stats, level, k) => stats[statKey(level, k)] || { ok: 0, miss: 0, streak: 0 };
function weight(stats, level, item) {
  const s = ST(stats, level, keyOf[level](item));
  if (s.ok + s.miss === 0) return 1.2 * simple[level](item);   // new: easy ones first
  const missRate = s.miss / (s.ok + s.miss);
  if (s.streak >= 3) return 0.35;                               // mastered: a confident "I know this" now and then
  return 0.8 + 1.0 * missRate;                                  // practised, only mildly favoured when hard
}
const isHard = (stats, level, item) => { const s = ST(stats, level, keyOf[level](item)); return s.miss > s.ok && s.streak < 2; };
const isComfy = (stats, level, item) => { const s = ST(stats, level, keyOf[level](item)); return s.streak >= 1 || (s.ok > s.miss && s.ok > 0); };
function weightedPick(items, wfn) {
  const ws = items.map(wfn), sum = ws.reduce((a, b) => a + b, 0);
  let r = Math.random() * sum;
  for (let i = 0; i < items.length; i++) { r -= ws[i]; if (r <= 0) return items[i]; }
  return items[items.length - 1];
}
const POOL = { 1: LETTERS, 2: SYLLABLES, 3: SLOVA, 4: VZKAZY_PECE };

// Builders for one task of each kind.
function roundLetter(L, a) {
  a ||= pick(SLOVA.filter(s => s.plain[0] === L && !s.plain.startsWith('CH')));
  return { level: 1, key: L, text: L, answer: a, choices: pictures(s => s.plain[0], a, false), task: 'Který obrázek začíná tímhle písmenkem?', hint: `${L}, jako ${a.plain}` };
}
function roundSyl(S, a) {
  a ||= pick(SLOVA.filter(s => s.syl.length > 1 && s.syl[0] === S));
  return { level: 2, key: S, text: S, answer: a, choices: pictures(s => s.syl[0], a, true), task: 'Který obrázek začíná touhle slabikou?', hint: `${S}, jako ${a.plain}` };
}
function roundWord(a) {
  return { level: 3, key: a.plain, text: a.w, answer: a, choices: pictures(s => s.plain, a, true), task: 'Přečti slovo a najdi obrázek.', hint: a.syl.join(', ') + '. ' + a.plain };
}
function roundCare(v) {
  return { level: 4, key: v.t, text: v.t, need: v.need, task: 'Přečti vzkaz od příšerky a udělej, co chce.', hint: v.t.replace(/-/g, '') };
}
function roundQuestion(a) {
  const t = pick(VZKAZY_OTAZKA).replace('{}', a.w);
  return { level: 4, key: t, word: a, text: t, answer: a, choices: pictures(s => s.plain, a, true), task: 'Přečti vzkaz od příšerky.', hint: t.replace(/-/g, '') };
}
const BUILD = { 1: x => roundLetter(x), 2: x => roundSyl(x), 3: roundWord, 4: roundCare };

let last = null;
const ladder = [];      // the staircase after a mistake
const recent = [];      // last results (true = first try)

function pickItem(level, stats, mode) {
  let pool = POOL[level].filter(x => !last || keyOf[level](x) !== last.key);
  if (mode === 'comfy') {
    const c = pool.filter(x => isComfy(stats, level, x));
    // nothing known yet: take the easiest new things
    pool = c.length ? c : pool.slice().sort((x, y) => simple[level](y) - simple[level](x)).slice(0, Math.max(3, Math.ceil(pool.length / 4)));
  } else if (mode === 'notHard') {
    const c = pool.filter(x => !isHard(stats, level, x));
    if (c.length) pool = c;
  }
  return weightedPick(pool, x => weight(stats, level, x));
}

export function newRound(level, stats = {}) {
  if (ladder.length) { const r = ladder.shift()(); r.step = true; return (last = r); }
  // two misses lately → something they know, to get the good feeling back; otherwise hard tasks at most every third time
  const misses = recent.slice(-3).filter(x => !x).length;
  const lastWasHard = last && !last.step && isHardKey(stats, last);
  const mode = misses >= 2 ? 'comfy' : (lastWasHard || Math.random() < 0.7 ? 'notHard' : 'any');
  let r;
  if (level === 4 && Math.random() < 0.4) r = roundQuestion(pickItem(3, stats, mode));
  else r = BUILD[level](pickItem(level, stats, mode));
  return (last = r);
}
function isHardKey(stats, r) { const s = ST(stats, r.level, r.key); return s.miss > s.ok; }

// After every answered task. A mistake on a normal task builds the staircase back to it.
export function afterResult(r, firstTry, stats) {
  recent.push(firstTry);
  if (recent.length > 10) recent.shift();
  if (firstTry || r.step) return;
  const comfy = lvl => () => { const x = pickItem(lvl, stats, 'comfy'); return BUILD[lvl](x); };
  ladder.length = 0;
  if (r.level === 1) {
    ladder.push(comfy(1), () => roundLetter(r.key));
  } else if (r.level === 2) {
    ladder.push(() => roundLetter(r.key[0]), comfy(2), () => roundSyl(r.key));
  } else if (r.level === 3) {
    const w = r.answer;
    // an easier word with the same beginning: shorter, fewer syllables
    const easier = SLOVA.filter(s => s !== w && s.plain[0] === w.plain[0] && (s.syl.length < w.syl.length || s.plain.length < w.plain.length))
      .sort((a, b) => a.plain.length - b.plain.length)[0];
    if (w.syl.length > 1) ladder.push(() => roundSyl(w.syl[0], w)); else ladder.push(() => roundLetter(w.plain[0], w));
    if (easier) ladder.push(() => roundWord(easier));
    ladder.push(() => roundWord(w));
  } else if (r.word) {
    ladder.push(() => roundWord(r.word), () => roundQuestion(r.word));
  } else {
    const v = VZKAZY_PECE.find(x => x.t === r.key);
    ladder.push(comfy(4), () => roundCare(v));
  }
}

// Reading ranks by the number of stars.
export const HODNOSTI = [
  { od: 0, nazev: 'Začínám číst', ikona: '🐣' },
  { od: 10, nazev: 'Písmenková průzkumnice', ikona: '🔤' },
  { od: 30, nazev: 'Slabiková kouzelnice', ikona: '🪄' },
  { od: 60, nazev: 'Čtenářka', ikona: '📗' },
  { od: 100, nazev: 'Velká čtenářka', ikona: '📚' },
  { od: 160, nazev: 'Mistryně čtení', ikona: '🏆' },
  { od: 250, nazev: 'Knižní dračice', ikona: '🐉' },
];
export const hodnost = stars => HODNOSTI.filter(h => stars >= h.od).pop();
export const dalsiHodnost = stars => HODNOSTI.find(h => h.od > stars);

// Text → HTML with each syllable in its own colour (red/blue, like in a first-grade reader). Syllables can be tapped.
export function syllableHTML(text, lower, sentence) {
  let out = text;
  if (lower) { out = out.toLowerCase(); if (sentence) out = out.replace(/^\p{L}/u, ch => ch.toUpperCase()); }
  return out.split(' ').map(word => {
    const parts = word.split('-');
    return '<span class="slovo">' + parts.map((p, i) => `<span class="slabika s${i % 2}" data-s="${p.replace(/[.,?!]/g, '')}">${p}</span>`).join('') + '</span>';
  }).join(' ');
}
