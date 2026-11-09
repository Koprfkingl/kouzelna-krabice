// Reading with the monster.
import * as THREE from 'three';
import { syllableHTML, newRound, hodnost, afterResult, statKey, dalsiHodnost } from './cteni.js';
import { DOPLNKY, byIdD, wear } from './doplnky.js';
import { hasSantaHat } from './advent.js';
import { initAudio, play } from './audio.js';
import { a as rod, hrac } from './hrac.js';
import { S } from './stav.js';
import { hideBubble, saveAlbum, setPhase, showBubble, showStep, speak, tabs, tapThing, tile } from './main.js';
import { $, animate, centerOf, pickOne, store, wait } from './util.js';
import { sparkles } from './scena.js';
import { NEEDS, ageCare, albumEntry, doCare, floatUp, hop, pet } from './pece.js';
import { dayEvent } from './den.js';

// Systematic phonics in small steps: letter → syllable → word → a short message. Syllables are coloured
// like in a Czech first-grade reader and can be tapped to hear them. A star for every task solved on the first try.
const READ_LEVELS = [{ id: 1, label: 'Písmenka', icon: 'A' }, { id: 2, label: 'Slabiky', icon: 'MA' }, { id: 3, label: 'Slova', icon: 'PES' }, { id: 4, label: 'Vzkazy', icon: '💌' }];
let readLevel = store.get('kk-cteni-uroven', 1), readLower = store.get('kk-cteni-mala', false);
let round = null, roundHelp = false, roundMiss = false, roundDone = false, spokenTask = 0;
let readStats = store.get('kk-cteni-stat', {}), readHist = store.get('kk-cteni-hist', { 1: [], 2: [], 3: [], 4: [] });
const suggested = {};
const PRAISE = () => ['Výborně!', 'Super!', 'Paráda!', 'Bravo!', 'Skvělé čtení!', rod('Jsi šikulka!', 'Jsi šikula!')];
const AGAIN = ['Ještě jednou!', 'Zkus to znovu.', 'Skoro! Zkus jiný.'];

const readRound = () => round; // for tests
function openReading() {
  S.phase = 'cteni';
  S.shot = 'care';
  S.tapHook = k => k === 'stroke' ? pet() : tapThing(S.current);
  hideBubble();
  $('pece').hidden = true;
  showStep('cteni');
  tabs($('zalozky-cteni'), readLevel, id => { readLevel = id; store.set('kk-cteni-uroven', id); spokenTask = 0; openReading(); }, READ_LEVELS);
  $('cteni-velikost').textContent = readLower ? 'ABC' : 'abc';
  renderRank();
  nextRound();
}
function renderCard() {
  const k = $('cteni-karta');
  k.classList.toggle('velke-pismeno', round.level <= 2);
  k.innerHTML = syllableHTML(round.text, readLower, round.level === 4) + (round.level === 4 ? `<span class="podpis">${S.current.monster.name}</span>` : '');
  k.querySelectorAll('.slabika').forEach(el => el.addEventListener('click', () => {
    initAudio();
    if (round.level <= 2) roundHelp = true; // hearing the letter itself gives the answer away
    flashSyl(el);
    speak(el.dataset.s.toLowerCase());
  }));
}
function flashSyl(el) { el.classList.add('cte'); setTimeout(() => el.classList.remove('cte'), 700); }
function nextRound() {
  if (S.phase !== 'cteni' || !S.current) return;
  round = newRound(readLevel, readStats);
  roundHelp = roundMiss = roundDone = false;
  renderCard();
  $('cteni-ukol').textContent = round.task;
  if (spokenTask !== readLevel) { spokenTask = readLevel; speak(round.task); }
  const grid = $('cteni-volby');
  grid.innerHTML = '';
  if (round.need) {
    const others = NEEDS.filter(n => n.id !== round.need).sort(() => Math.random() - 0.5).slice(0, 2);
    for (const n of [NEEDS.find(n => n.id === round.need), ...others].sort(() => Math.random() - 0.5)) {
      grid.append(tile({ label: n.label, icon: n.icon, onClick: el => answer(n.id === round.need, el, n) }));
    }
  } else {
    for (const ch of round.choices) grid.append(tile({ label: '', icon: ch.e, onClick: el => answer(ch === round.answer, el) }));
    grid.querySelectorAll('.jmeno').forEach(j => j.remove());
  }
}
// One star for reading; returns news about a new rank or reward.
function giveStar(pos) {
  const before = hodnost(S.stars);
  S.stars++;
  store.set('kk-hvezdy', S.stars);
  floatUp('⭐', pos.clone().add(new THREE.Vector3(0, 0.3, 0.2)), { n: 3, spread: 0.5, size: 0.2 });
  const after = hodnost(S.stars), unlocked = DOPLNKY.find(d => d.hvezdy === S.stars);
  let news = null;
  if (after.nazev !== before.nazev) news = `Nová hodnost: ${after.ikona} ${after.nazev}! Na poličce v pokojíčku máš nový pohár.`;
  if (unlocked) news = (news ? news + ' ' : '') + `Nová odměna: ${unlocked.ikona} ${unlocked.nazev}! Najdeš ji v šatníku.`;
  return news;
}
async function answer(ok, el, need) {
  if (roundDone || S.busy) return;
  const c = S.current;
  if (!ok) {
    roundMiss = true;
    el.classList.add('spatne');
    play('boing');
    speak(pickOne(AGAIN));
    animate(0.5, k => { c.bounce.rotation.y = Math.sin(k * Math.PI * 4) * 0.25 * (1 - k); }).then(() => { c.bounce.rotation.y = 0; });
    return;
  }
  roundDone = true;
  el.classList.add('dobre');
  const star = !roundHelp && !roundMiss;
  recordResult(round, star);
  afterResult(round, star, readStats);
  let news = null;
  dayEvent('cteni');
  if (star) {
    news = giveStar(centerOf(c.obj).c);
    renderRank();
  }
  if (news) {
    showBubble('🎉 ' + news);
    for (const ch of ['🎉', '⭐', '✨', '🏅']) floatUp(ch, centerOf(c.obj).c, { n: 3, spread: 0.9, rise: 0.9, life: 2.4 });
    play('poof');
  }
  play('giggle');
  sparkles.userData.emit(centerOf(c.obj).c, 40, 1.2, 0.3);
  const word = round.answer ? ' ' + round.answer.plain.toLowerCase() : '';
  speak(pickOne(PRAISE()) + word + (news ? '. ' + news.replace(/[^\p{L}\p{N}\s!?.,]/gu, '') : ''));
  suggestLevel();
  const a = albumEntry(c);
  if (need) {
    await wait(1.2);
    if (S.phase !== 'cteni') return;
    await doCare(need);
  } else {
    if (a) { ageCare(a); a.pece.hra = Math.min(100, a.pece.hra + 6); saveAlbum(); }
    await hop(c.bounce, 0.22, 0.5);
    await wait(1.4);
  }
  nextRound();
}
function recordResult(r, firstTry) {
  const k = statKey(r.level, r.key);
  const st = readStats[k] || (readStats[k] = { ok: 0, miss: 0, streak: 0 });
  if (firstTry) { st.ok++; st.streak++; } else { st.miss++; st.streak = 0; }
  const h = readHist[r.level] || (readHist[r.level] = []);
  h.push(firstTry ? 1 : 0);
  if (h.length > 30) h.shift();
  store.set('kk-cteni-stat', readStats);
  store.set('kk-cteni-hist', readHist);
}
// When the last ten tasks of a level went well, the next level's tab starts to wiggle.
function suggestLevel() {
  const h = readHist[readLevel] || [];
  const recent = h.slice(-10);
  if (readLevel >= 4 || recent.length < 10 || recent.reduce((a, b) => a + b, 0) < 9 || suggested[readLevel]) return;
  suggested[readLevel] = true;
  const next = READ_LEVELS[readLevel];
  setTimeout(() => { showBubble(`Jde ti to skvěle! Zkusíš ${next.label.toLowerCase()}? ${next.icon}`); speak(`Jde ti to skvěle! Zkusíš ${next.label.toLowerCase()}?`); }, 2600);
  const tab = $('zalozky-cteni').children[readLevel];
  if (tab) tab.classList.add('chce');
}
function renderRank() {
  const h = hodnost(S.stars), n = dalsiHodnost(S.stars);
  $('cteni-hvezdy').textContent = '⭐ ' + S.stars;
  $('cteni-hodnost').innerHTML = `${h.ikona} ${h.nazev}` + (n ? ` <small>· do hodnosti ${n.ikona} zbývá ${n.od - S.stars} ⭐</small>` : '');
}

// Wardrobe: accessories unlocked by reading stars.
function openWardrobe() {
  const e = albumEntry(S.current);
  if (!e) return;
  $('satnik-hvezdy').textContent = `⭐ ${S.stars}`;
  const grid = $('satnik-mrizka');
  grid.innerHTML = '';
  e.doplnky ||= [];
  for (const d of DOPLNKY) {
    const open = d.vanoce ? hasSantaHat() : S.stars >= d.hvezdy;
    const t = tile({ label: open ? d.nazev : `${d.hvezdy} ⭐`, icon: open ? d.ikona : '🔒', cls: open ? '' : 'zamceno', onClick: () => {
      if (!open) { speak(`Na ${d.nazev.toLowerCase()} potřebuješ ${d.hvezdy} hvězdiček. Čti s příšerkou!`); return; }
      const on = e.doplnky.includes(d.id);
      e.doplnky = e.doplnky.filter(id => byIdD(id).slot !== d.slot); // one per slot
      if (!on) e.doplnky.push(d.id);
      saveAlbum();
      wear(S.current.obj, e.doplnky);
      play(on ? 'hide' : 'poof');
      if (!on) sparkles.userData.emit(centerOf(S.current.obj).c.add(new THREE.Vector3(0, 0.3, 0)), 50, 1.2, 0.3);
      openWardrobe();
    } });
    if (e.doplnky.includes(d.id)) t.classList.add('vybrano');
    grid.append(t);
  }
  $('satnik').hidden = false;
}
$('satnik-zavrit').addEventListener('click', () => { $('satnik').hidden = true; });
$('satnik').addEventListener('click', ev => { if (ev.target.id === 'satnik') $('satnik').hidden = true; });

// A short overview for parents: how each level goes, what is still hard, what is mastered.
function openOverview() {
  const names = { 1: 'Písmenka', 2: 'Slabiky', 3: 'Slova', 4: 'Vzkazy' };
  let html = `<p>Hvězdiček: <b>${S.stars}</b>, hodnost: <b>${hodnost(S.stars).ikona} ${hodnost(S.stars).nazev}</b>.<br>Když něco nejde, hra hned přidá schůdky: nejdřív písmenko nebo slabiku z toho slova, pak lehčí slovo se stejným začátkem a nakonec to původní. Těžké úkoly se míchají s tím, co už jde, a po dvou chybách přijde něco, co ${hrac.jmeno} umí. Co přečte třikrát po sobě napoprvé, chodí už jen občas.</p>`;
  html += '<table><tr><th>Úroveň</th><th class="c">Úkolů</th><th class="c">Napoprvé</th><th class="c">Posledních 10</th></tr>';
  for (const l of [1, 2, 3, 4]) {
    const entries = Object.entries(readStats).filter(([k]) => k.startsWith(l + ':')).map(([, v]) => v);
    const ok = entries.reduce((a, v) => a + v.ok, 0), miss = entries.reduce((a, v) => a + v.miss, 0);
    const recent = (readHist[l] || []).slice(-10);
    const pct = n => (n === null ? '–' : Math.round(n * 100) + ' %');
    html += `<tr><td>${names[l]}</td><td class="c">${ok + miss}</td><td class="c">${pct(ok + miss ? ok / (ok + miss) : null)}</td><td class="c">${pct(recent.length ? recent.reduce((a, b) => a + b, 0) / recent.length : null)}</td></tr>`;
  }
  html += '</table>';
  const all = Object.entries(readStats).map(([k, v]) => ({ level: Number(k.split(':')[0]), text: k.slice(k.indexOf(':') + 1).replace(/-/g, ''), ...v }));
  const hard = all.filter(x => x.miss > 0 && x.streak < 3).sort((a, b) => b.miss / (b.ok + b.miss) - a.miss / (a.ok + a.miss) || b.miss - a.miss).slice(0, 14);
  const mastered = all.filter(x => x.streak >= 3);
  html += '<h3>Zatím to jde hůř</h3>' + (hard.length ? '<div class="stitky">' + hard.map(x => `<span title="${names[x.level]}">${x.text} <small>${x.ok}/${x.ok + x.miss}</small></span>`).join('') + '</div>' : '<p>Zatím nic, nebo se ještě nehrálo.</p>');
  html += `<h3>Už to umí (${mastered.length})</h3>` + (mastered.length ? '<div class="stitky umi">' + mastered.slice(0, 40).map(x => `<span>${x.text}</span>`).join('') + '</div>' : '<p>Až něco přečte třikrát po sobě napoprvé, objeví se to tady.</p>');
  $('prehled-obsah').innerHTML = html;
  $('prehled').hidden = false;
}
$('cteni-prehled').addEventListener('click', () => { play('tap'); openOverview(); });
$('prehled-zavrit').addEventListener('click', () => { $('prehled').hidden = true; });
$('prehled').addEventListener('click', ev => { if (ev.target.id === 'prehled') $('prehled').hidden = true; });

$('cteni-napoveda').addEventListener('click', () => {
  if (!round) return;
  initAudio(); play('tap');
  roundHelp = true;
  // syllables light up one after another while they are read, then the whole thing
  const els = [...$('cteni-karta').querySelectorAll('.slabika')];
  els.forEach((el, i) => setTimeout(() => flashSyl(el), i * 650));
  speak(round.hint.toLowerCase());
});
$('cteni-velikost').addEventListener('click', () => {
  play('tap');
  readLower = !readLower;
  store.set('kk-cteni-mala', readLower);
  $('cteni-velikost').textContent = readLower ? 'ABC' : 'abc';
  if (round) renderCard();
});
$('cteni-zpet').addEventListener('click', () => { play('tap'); round = null; setPhase(albumEntry(S.current) ? 'care' : 'stage'); });

export { readRound, flashSyl, giveStar, openReading, openWardrobe, readLower, renderRank };
