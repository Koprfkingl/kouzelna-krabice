// Letters from monsters: once a day one of the monsters writes a short letter (in syllables, to read),
// asks a question and the child answers by picking a picture and building its word from letter cards.
// The answer gives a star and makes the monster happy.
import * as THREE from 'three';
import { play, initAudio } from './audio.js';
import { S } from './stav.js';
import { saveAlbum, showBubble, speak } from './main.js';
import { $, params, store } from './util.js';
import { syllableHTML } from './cteni.js';
import { flashSyl, giveStar, readLower } from './citanka.js';
import { a as rod, hrac, vokativ } from './hrac.js';
import { today } from './ukoly.js';

// q: the question in syllables; a: answers [word, picture]; dik: the thank you, {w} is the chosen word
const OTAZKY = [
  { q: 'MÁM HLAD. CO MÁM SNÍST?', a: [['DORT', '🍰'], ['SÝR', '🧀'], ['MED', '🍯'], ['RÝŽE', '🍚']], dik: 'Mňam, {w}! Děkuju!' },
  { q: 'NU-DÍM SE. S ČÍM SI MÁM HRÁT?', a: [['MÍČ', '⚽'], ['AUTO', '🚗'], ['KOLO', '🚲'], ['VLAK', '🚂']], dik: 'Super, {w}! Jdu si hrát.' },
  { q: 'KAM PŮ-JDE-ME NA VÝ-LET?', a: [['LES', '🌲'], ['ZOO', '🦁'], ['MOŘE', '🌊'], ['HORY', '⛰️']], dik: 'Hurá, {w}! Těším se na výlet.' },
  { q: () => `JA-KÉ ZVÍ-ŘE MÁŠ ${rod('RÁ-DA', 'RÁD')}?`, a: [['PES', '🐶'], ['KOČKA', '🐱'], ['MYŠ', '🐭'], ['KŮŇ', '🐴']], dik: 'Já taky! {w} je moje nejmilejší zvíře.' },
  { q: 'CO MI DÁŠ K NA-RO-ZE-NI-NÁM?', a: [['DORT', '🎂'], ['KYTKA', '🌷'], ['MÍČ', '⚽'], ['KNIHA', '📖']], dik: 'Jé, to bude krásný dárek!' },
  { q: 'CO SI DÁM NA HLA-VU?', a: [['KORUNA', '👑'], ['ČEPICE', '🧢'], ['MAŠLE', '🎀'], ['HELMA', '⛑️']], dik: 'Budu nejhezčí příšerka na světě!' },
  { q: 'CO JE VI-DĚT NA NE-BI?', a: [['SLUNCE', '☀️'], ['MRAK', '☁️'], ['DUHA', '🌈'], ['HVĚZDA', '⭐']], dik: 'Ano! Půjdu se podívat ven.' },
  { q: 'MÁM ŽÍZEŇ. CO MÁM PÍT?', a: [['MLÉKO', '🥛'], ['ČAJ', '🍵'], ['VODA', '💧'], ['DŽUS', '🧃']], dik: 'Děkuju, už nemám žízeň!' },
];
const PISMENA = 'AÁBCČDEÉĚFHIÍJKLMNOPRŘSŠTUÚŮVYÝZŽ';

let st = { den: '', ceka: null, pocet: 0, ...store.get('kk-dopis', {}) };
const save = () => store.set('kk-dopis', st);
let answer = null; // the word being built: { word, done }

const pick = a => a[Math.floor(Math.random() * a.length)];
const textOf = q => (typeof q.q === 'function' ? q.q() : q.q);

// a new letter from a random monster of the collection
export function novyDopis() {
  if (!S.album.length) return false;
  const m = pick(S.album);
  st.ceka = { seed: m.seed, q: Math.floor(Math.random() * OTAZKY.length) };
  st.den = today();
  save();
  updateBtn();
  return true;
}
const waiting = () => st.ceka && S.album.find(a => a.seed === st.ceka.seed);

function updateBtn() {
  const b = $('btn-dopis');
  b.hidden = !waiting();
  b.classList.toggle('ceka', !!waiting());
}

function openDopis() {
  const m = waiting();
  if (!m) { updateBtn(); return; }
  const q = OTAZKY[st.ceka.q], text = textOf(q);
  answer = null;
  $('dopis-hlava').textContent = `${hrac.kluk ? 'Milý' : 'Milá'} ${vokativ(hrac.jmeno)},`;
  $('dopis-text').innerHTML = syllableHTML(text, readLower, true);
  $('dopis-text').querySelectorAll('.slabika').forEach(el => el.addEventListener('click', () => { initAudio(); flashSyl(el); speak(el.dataset.s.toLowerCase()); }));
  $('dopis-podpis').textContent = `Tvoje příšerka ${m.name} 💜`;
  $('dopis-moznosti').innerHTML = '';
  for (const [word, pic] of q.a) {
    const b = document.createElement('button');
    b.className = 'dopis-obrazek';
    b.textContent = pic;
    b.onclick = () => { initAudio(); play('tap'); startWord(word, pic); };
    $('dopis-moznosti').append(b);
  }
  $('dopis-skladani').hidden = true;
  $('dopis-napoveda').textContent = 'Přečti si dopis a vyber obrázek. Pak slovo slož z písmenek.';
  $('dopis').hidden = false;
  speak(text.replace(/-/g, '').toLowerCase());
}

// the answer: the picked word is built letter by letter from shuffled cards
function startWord(word, pic) {
  answer = { word, pic, done: 0 };
  for (const b of $('dopis-moznosti').children) b.classList.toggle('vybrano', b.textContent === pic);
  const letters = [...word];
  const extra = [...PISMENA].filter(l => !letters.includes(l)).sort(() => Math.random() - 0.5).slice(0, 2);
  const cards = [...letters, ...extra].sort(() => Math.random() - 0.5);
  $('dopis-slovo').innerHTML = letters.map(() => '<span class="policko"></span>').join('');
  const box = $('dopis-pismena');
  box.innerHTML = '';
  for (const l of cards) {
    const b = document.createElement('button');
    b.className = 'pismenko';
    b.textContent = l;
    b.onclick = () => tapLetter(b);
    box.append(b);
  }
  $('dopis-skladani').hidden = false;
  $('dopis-napoveda').textContent = `Slož slovo ${pic} z písmenek.`;
  speak('slož slovo ' + word.toLowerCase());
}
function tapLetter(b) {
  if (!answer || b.disabled) return;
  initAudio();
  const want = answer.word[answer.done];
  if (b.textContent !== want) {
    play('boing');
    b.classList.remove('spatne'); void b.offsetWidth; b.classList.add('spatne');
    return;
  }
  play('place');
  speak(want.toLowerCase());
  b.disabled = true;
  $('dopis-slovo').children[answer.done].textContent = want;
  answer.done++;
  if (answer.done === answer.word.length) setTimeout(send, 500);
}
export function send() {
  const m = waiting();
  if (!m || !answer) return;
  const q = OTAZKY[st.ceka.q];
  st.ceka = null; st.pocet++;
  save();
  updateBtn();
  if (m.pece) { m.pece.mazleni = 100; m.pece.hra = Math.min(100, (m.pece.hra || 0) + 30); saveAlbum(); }
  play('poof'); setTimeout(() => play('giggle'), 300);
  $('dopis').hidden = true;
  const news = giveStar(new THREE.Vector3(0, 1.4, -0.6));
  const word = answer.word.charAt(0) + answer.word.slice(1).toLowerCase();
  const dik = q.dik.replace('{w}', q.dik.startsWith('{w}') ? word : word.toLowerCase());
  const t = `✉️ ${m.name} dostala tvou odpověď ${answer.pic}. ${dik} Máš hvězdičku!${news ? ' ' + news : ''}`;
  showBubble(t); speak(t.replace(/[^\p{L}\p{N} ,.!?]/gu, ''));
  answer = null;
  return true;
}

export function initDopisy() {
  if (st.ceka && !waiting()) st.ceka = null; // the monster was set free
  if (st.den !== today() && !st.ceka && S.album.length && !params.has('demo')) {
    setTimeout(() => {
      if (!novyDopis()) return;
      const m = waiting(), t = `📬 Přišel ti dopis od příšerky ${m.name}! Klepni na obálku nahoře.`;
      showBubble(t); speak(t);
    }, 20000);
  }
  updateBtn();
}
$('btn-dopis').addEventListener('click', () => { initAudio(); play('tap'); openDopis(); });
$('dopis-zavrit').addEventListener('click', () => { $('dopis').hidden = true; });
$('dopis').addEventListener('click', e => { if (e.target.id === 'dopis') $('dopis').hidden = true; });

export { openDopis };
