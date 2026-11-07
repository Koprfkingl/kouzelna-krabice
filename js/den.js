// Tasks of the day and the chest.
import { play, initAudio } from './audio.js';
import { a as rod } from './hrac.js';
import { ozdobaById } from './ozdoby.js';
import * as Ukoly from './ukoly.js';
import { S } from './stav.js';
import { showBubble, speak } from './main.js';
import { $ } from './util.js';
import { openRoom, pokoj, savePokoj } from './pokojicek.js';

let den = Ukoly.loadDay(S.album.length > 0);
function dayEvent(ev, detail = {}) {
  if (den.date !== Ukoly.today()) den = Ukoly.loadDay(S.album.length > 0);
  const done = Ukoly.progress(den, ev, detail);
  done.forEach((t, i) => setTimeout(() => { showBubble(`✅ Úkol dne splněn: ${t.text}!`); play('place'); }, 3000 + i * 2500));
  if (done.length && Ukoly.allDone(den)) {
    Ukoly.markDay(den.date);
    setTimeout(() => { const t = 'Všechny úkoly dne jsou hotové! Otevři dárek v kalendáři.'; showBubble('🎁 ' + t + ' 📅'); speak(t); }, 3000 + done.length * 2500);
  }
  renderDenBtn();
}
function renderDenBtn() {
  const n = den.tasks.filter(t => t.n >= t.goal).length;
  $('den-stav').textContent = den.opened ? '✓' : `${n}/3`;
  $('btn-den').classList.toggle('ceka', Ukoly.allDone(den) && !den.opened);
}
const dnu = n => (n >= 2 && n <= 4 ? 'dny' : 'dní');
function openDen() {
  if (den.date !== Ukoly.today()) den = Ukoly.loadDay(S.album.length > 0);
  const cal = $('den-kalendar');
  cal.innerHTML = '';
  for (const d of Ukoly.lastDays(7)) { const el = document.createElement('div'); el.className = 'dennik' + (d.today ? ' dnes' : ''); el.innerHTML = `${d.name}<b>${d.done ? '⭐' : '·'}</b>`; cal.append(el); }
  const st = Ukoly.streak();
  if (st >= 2) { const r = document.createElement('div'); r.className = 'rada'; r.textContent = `🔥 ${st} ${dnu(st)} v řadě!`; cal.append(r); }
  const list = $('den-ukoly');
  list.innerHTML = '';
  for (const t of den.tasks) {
    const b = document.createElement('button');
    const ok = t.n >= t.goal;
    b.className = 'ukol' + (ok ? ' hotovo' : '');
    b.innerHTML = `<span class="ikona">${t.icon}</span><span class="text">${t.text}</span><span class="stav">${ok ? '✅' : `${t.n} / ${t.goal}`}</span>`;
    b.onclick = () => { play('tap'); speak(t.text); };
    list.append(b);
  }
  const tr = $('den-truhla'), ready = Ukoly.allDone(den), od = $('den-odmena');
  tr.className = 'truhla' + (den.opened ? ' otevrena' : ready ? ' pripravena' : '');
  od.hidden = false;
  if (den.opened) {
    const o = ozdobaById(den.opened);
    tr.textContent = o.ikona;
    od.textContent = `Dnes jsi ${rod('dostala', 'dostal')} ${o.nazev.toLowerCase()}. Zítra budou nové úkoly a nový dárek!`;
  } else {
    tr.textContent = '🎁';
    od.textContent = ready ? 'Klepni na dárek!' : 'Splň všechny tři úkoly a dárek se otevře. Je v něm ozdoba do pokojíčku.';
  }
  $('den').hidden = false;
}
$('den-truhla').addEventListener('click', () => {
  if (den.opened) { $('den').hidden = true; if (!S.busy && S.current?.where !== 'schovka') openRoom(); return; }
  if (!Ukoly.allDone(den)) { play('boing'); speak('Ještě nejsou hotové všechny úkoly.'); return; }
  const o = Ukoly.chestReward(pokoj.ozdoby);
  pokoj.ozdoby.push(o.id);
  den.opened = o.id;
  Ukoly.saveDay(den);
  savePokoj();
  play('poof'); setTimeout(() => play('giggle'), 300);
  openDen();
  $('den-odmena').textContent = `Máš novou ozdobu: ${o.ikona} ${o.nazev}! Klepni na ni a postav ji v pokojíčku na místo se ✨.`;
  speak(`Máš novou ozdobu: ${o.nazev}!`);
  renderDenBtn();
});
$('btn-den').addEventListener('click', () => { initAudio(); play('tap'); openDen(); });
$('den-zavrit').addEventListener('click', () => { $('den').hidden = true; });
$('den').addEventListener('click', e => { if (e.target.id === 'den') $('den').hidden = true; });

export { dayEvent, den, openDen, renderDenBtn };
