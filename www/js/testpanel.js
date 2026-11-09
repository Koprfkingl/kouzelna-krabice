// The test panel (🧪) of the test build: try out things that otherwise take hours or days,
// like a mess from the monsters, the Advent calendar, letters, trips or room makeovers.
import { isTest, testDate } from './testbuild.js';
import { S } from './stav.js';
import { showBubble, saveAlbum } from './main.js';
import { $, store } from './util.js';
import { play, initAudio } from './audio.js';
import { addBoost } from './boost.js';
import { makeMess } from './neporadek.js';
import { novyDopis } from './dopisy.js';
import { checkTrips } from './vylety.js';
import { grow } from './mimi.js';

const DATE_KEY = 'kk-test-datum';

const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const say = t => { showBubble('🧪 ' + t); };
function setDate(d) { if (d) store.set(DATE_KEY, d); else localStorage.removeItem(DATE_KEY); location.reload(); }

const ACTIONS = [
  ['⭐ +10 hvězdiček', () => { S.stars += 10; store.set('kk-hvezdy', S.stars); say(`Máš ${S.stars} hvězdiček.`); }],
  ['⭐ +50 hvězdiček', () => { S.stars += 50; store.set('kk-hvezdy', S.stars); say(`Máš ${S.stars} hvězdiček.`); }],
  ['🌟 +3 Laser Boost', () => { addBoost(3); say('Tři Laser Boosty jsou u zavřené krabice.'); }],
  ['🧹 Nepořádek hned', () => { const m = makeMess(); say(m ? `${m.name} udělala nepořádek. Mrkni do pokojíčku (🏠).` : 'Nepořádek nejde: chybí příšerka ve sbírce, nebo je už všechno rozházené.'); }],
  ['✉️ Dopis hned', () => { say(novyDopis() ? 'Přišel dopis, klepni na ✉️ nahoře.' : 'Nejdřív potřebuješ příšerku ve sbírce.'); }],
  ['🎒 Vrátit výlet hned', () => { if (!checkTrips(true)) say('Nikdo není na výletě. Pošli příšerku přes 🎒 u příšerky.'); }],
  ['👶 Miminko povyroste', () => {
    const c = S.current, a = c && c.type === 'monster' && S.album.find(x => x.seed === c.monster.seed);
    if (!a || !a.baby) { say('Postav před krabici miminko ze sbírky (🍼).'); return; }
    const t = grow(c, a); saveAlbum(); say(t || `${a.name} povyrostla (${Math.round(a.rust * 100)} %).`);
  }],
  ['🎄 Advent: 1. prosince', () => setDate(`${new Date().getFullYear()}-12-01`)],
  ['🎄 Advent: další den', () => { const d = new Date((testDate() || `${new Date().getFullYear()}-11-30`) + 'T12:00:00'); d.setDate(d.getDate() + 1); setDate(iso(d)); }],
  ['🎄 Advent: Štědrý den', () => setDate(`${new Date().getFullYear()}-12-24`)],
  ['📅 Zpátky na dnešek', () => setDate(null)],
  ['🗑️ Smazat celou hru', () => { if (confirm('Opravdu smazat všechno a začít znovu?')) { localStorage.clear(); location.reload(); } }],
];

function render() {
  const g = $('test-akce');
  g.innerHTML = '';
  for (const [label, fn] of ACTIONS) {
    const b = document.createElement('button');
    b.className = 'velke druhe test-tlacitko';
    b.textContent = label;
    b.onclick = () => { initAudio(); play('tap'); $('test').hidden = true; fn(); };
    g.append(b);
  }
  const d = testDate();
  $('test-stav').textContent = `Datum pro advent: ${d ? d.split('-').reverse().join('. ') : 'dnešek'} · hvězdičky: ${S.stars}`;
}

export function initTest() {
  if (!isTest) return;
  $('btn-test').hidden = false;
  document.title = 'Krabice TEST';
  $('btn-test').addEventListener('click', () => { initAudio(); play('tap'); render(); $('test').hidden = false; });
  $('test-zavrit').addEventListener('click', () => { $('test').hidden = true; });
}
