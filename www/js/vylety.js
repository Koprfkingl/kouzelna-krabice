// Trips: a monster from the collection goes out of the window for a while. When it comes back it brings
// a postcard to read (in syllables) and a souvenir for the room. Real time, so the child looks forward to it.
import { play, initAudio } from './audio.js';
import { S } from './stav.js';
import { saveAlbum, showBubble, speak } from './main.js';
import { $, params } from './util.js';
import { syllableHTML } from './cteni.js';
import { flashSyl, readLower } from './citanka.js';
import { pokoj, savePokoj } from './pokojicek.js';
import { ozdobaById } from './ozdoby.js';
import { addBoost } from './boost.js';

export const TRIP_MIN = 45; // minutes away
const VYLETY = [
  { kam: 'k moři', obr: '🌊🏖️🐬', text: 'A-HOJ Z MO-ŘE! KOU-PA-LA JSEM SE A VI-DĚ-LA DEL-FÍ-NA.', suvenyr: 'musle' },
  { kam: 'do lesa', obr: '🌲🦔🍄', text: 'A-HOJ Z LE-SA! PO-TKA-LA JSEM JEŽ-KA. MĚL HOU-BU.', suvenyr: 'siska' },
  { kam: 'na hory', obr: '⛰️🏔️🐐', text: 'A-HOJ Z HOR! VY-LEZ-LA JSEM AŽ NA-HO-RU.', suvenyr: 'krystal' },
  { kam: 'do pouště', obr: '🏜️🐪🌞', text: 'A-HOJ Z POU-ŠTĚ! JE TU HOR-KO. JE-LA JSEM NA VEL-BLOU-DU.', suvenyr: 'pyramida' },
  { kam: 'na sever', obr: '❄️🐧🧊', text: 'A-HOJ ZE SE-VE-RU! JE TU SNÍH A TUČ-ŇÁ-CI.', suvenyr: 'tucnak' },
  { kam: 'do vesmíru', obr: '🚀🌙✨', text: 'A-HOJ Z VES-MÍ-RU! LE-TĚ-LA JSEM RA-KE-TOU NA MĚ-SÍC.', suvenyr: 'mesic' },
];

export const onTrip = a => !!(a && a.vylet);
export const minutesLeft = a => Math.max(1, Math.ceil((a.vylet.zpet - Date.now()) / 60000));
export const tripWhere = a => VYLETY[a.vylet.kam].kam;

// sends the album entry away; returns the words for the bubble
export function sendOnTrip(a) {
  // places not visited yet first, so every souvenir comes eventually
  const seen = new Set(S.album.flatMap(x => x.vylety || []));
  const fresh = VYLETY.map((_, i) => i).filter(i => !seen.has(i));
  const pool = fresh.length ? fresh : VYLETY.map((_, i) => i);
  const kam = pool[Math.floor(Math.random() * pool.length)];
  a.vylet = { kam, zpet: Date.now() + TRIP_MIN * 60000 };
  saveAlbum();
  return `${a.name} jede ${VYLETY[kam].kam}! Vrátí se za ${TRIP_MIN} minut a přiveze ti pohlednici.`;
}

// a monster back from its trip: the postcard and the souvenir
function comeBack(a) {
  const v = VYLETY[a.vylet.kam];
  delete a.vylet;
  a.vylety = [...new Set([...(a.vylety || []), VYLETY.indexOf(v)])];
  saveAlbum();
  const o = ozdobaById(v.suvenyr);
  let gift;
  if (!pokoj.ozdoby.includes(v.suvenyr)) { pokoj.ozdoby.push(v.suvenyr); savePokoj(); gift = `Suvenýr: ${o.ikona} ${o.nazev}. Postav si ho v pokojíčku!`; }
  else { addBoost(1); gift = `${o.ikona} ${o.nazev} už máš, tak ti přivezla 🌟 Laser Boost!`; }
  showPostcard(a, v, gift);
}
function showPostcard(a, v, gift) {
  $('pohlednice-obr').textContent = v.obr;
  $('pohlednice-text').innerHTML = syllableHTML(v.text, readLower, true);
  $('pohlednice-text').querySelectorAll('.slabika').forEach(el => el.addEventListener('click', () => { initAudio(); flashSyl(el); speak(el.dataset.s.toLowerCase()); }));
  $('pohlednice-podpis').textContent = `Tvoje ${a.name} 💜`;
  $('pohlednice-dar').textContent = gift;
  $('pohlednice').hidden = false;
  play('giggle');
  const t = `${a.name} se vrátila z výletu! Přivezla ti pohlednici.`;
  showBubble('🎒 ' + t); speak(t + ' ' + v.text.replace(/-/g, '').toLowerCase());
}

// called now and then: who is back?
export function checkTrips(force = false) {
  for (const a of S.album) if (a.vylet && (force || Date.now() >= a.vylet.zpet)) { comeBack(a); return true; } // one postcard at a time
  return false;
}
export function initVylety() {
  setInterval(() => { if ($('pohlednice').hidden && !S.busy) checkTrips(); }, 30000);
  if (!params.has('demo')) setTimeout(() => checkTrips(), 4000);
}
$('pohlednice-ok').addEventListener('click', () => { initAudio(); play('tap'); $('pohlednice').hidden = true; setTimeout(() => checkTrips(), 1500); });
