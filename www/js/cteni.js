// Reading with monsters: words with pictures, split into syllables (as in a Czech first-grade reader).
// Levels: 1 letter, 2 syllable, 3 word, 4 a message from the monster (a short sentence).

// Word, picture. Syllables are separated by '-'.
export const SLOVA = [
  ['PES', '🐶'], ['MÍČ', '⚽'], ['LES', '🌲'], ['DŮM', '🏠'], ['SÝR', '🧀'], ['NOS', '👃'], ['ZUB', '🦷'], ['HAD', '🐍'],
  ['LEV', '🦁'], ['VLK', '🐺'], ['MYŠ', '🐭'], ['VLAK', '🚂'], ['LOĎ', '⛵'], ['DORT', '🎂'], ['SNÍH', '❄️'], ['SLON', '🐘'],
  ['AU-TO', '🚗'], ['O-KO', '👁️'], ['U-CHO', '👂'], ['RY-BA', '🐟'], ['LIŠ-KA', '🦊'], ['KO-LO', '🚲'], ['LU-NA', '🌙'],
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

let last = null;
export function newRound(level) {
  let r;
  for (let tries = 0; tries < 10; tries++) {
    if (level === 1) {
      const a = pick(SLOVA.filter(s => !s.plain.startsWith('CH')));
      r = { level, text: a.plain[0], answer: a, choices: pictures(s => s.plain[0], a, false), task: 'Který obrázek začíná tímhle písmenkem?', hint: `${a.plain[0]}, jako ${a.plain}` };
    } else if (level === 2) {
      const a = pick(SLOVA.filter(s => s.syl.length > 1));
      r = { level, text: a.syl[0], answer: a, choices: pictures(s => s.syl[0], a, true), task: 'Který obrázek začíná touhle slabikou?', hint: `${a.syl[0]}, jako ${a.plain}` };
    } else if (level === 3) {
      const a = pick(SLOVA);
      r = { level, text: a.w, answer: a, choices: pictures(s => s.plain, a, true), task: 'Přečti slovo a najdi obrázek.', hint: a.syl.join(', ') + '. ' + a.plain };
    } else {
      if (Math.random() < 0.6) {
        const v = pick(VZKAZY_PECE);
        r = { level, text: v.t, need: v.need, task: 'Přečti vzkaz od příšerky a udělej, co chce.', hint: v.t.replace(/-/g, '') };
      } else {
        const a = pick(SLOVA);
        const t = pick(VZKAZY_OTAZKA).replace('{}', a.w);
        r = { level, text: t, answer: a, choices: pictures(s => s.plain, a, true), task: 'Přečti vzkaz od příšerky.', hint: t.replace(/-/g, '') };
      }
    }
    if (!last || r.text !== last.text) break;
  }
  last = r;
  return r;
}

// Text → HTML with each syllable in its own colour (red/blue, like in a first-grade reader). Syllables can be tapped.
export function syllableHTML(text, lower, sentence) {
  let out = text;
  if (lower) { out = out.toLowerCase(); if (sentence) out = out.replace(/^\p{L}/u, ch => ch.toUpperCase()); }
  return out.split(' ').map(word => {
    const parts = word.split('-');
    return '<span class="slovo">' + parts.map((p, i) => `<span class="slabika s${i % 2}" data-s="${p.replace(/[.,?!]/g, '')}">${p}</span>`).join('') + '</span>';
  }).join(' ');
}
