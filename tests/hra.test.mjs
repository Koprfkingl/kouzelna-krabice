// End-to-end test of the game in a headless browser (software WebGL, so it is slow but runs anywhere).
// Usage: npm test        (needs `npm run vendor` first; screenshots go to tests/out/)
// It plays through the main parts: name dialog, magic with the laser, the Book of Spells, reading,
// caring, the room, hide and seek and the tasks of the day. Any page error fails the test.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const ROOT = path.resolve('www');
const OUT = path.resolve('tests/out');
fs.mkdirSync(OUT, { recursive: true });
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.glb': 'model/gltf-binary', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.webp': 'image/webp' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!p.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
  const f = fs.existsSync(p) && fs.statSync(p).isDirectory() ? path.join(p, 'index.html') : p;
  fs.readFile(f, (err, data) => {
    if (err) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
    res.end(data);
  });
});
await new Promise(r => server.listen(0, r));
const URL0 = `http://localhost:${server.address().port}/?demo&okamzite&datum=2026-12-07`; // in Advent, so the calendar and the tree are tested too

const failures = [];
let step = '';
const check = (ok, what) => { console.log(`${ok ? '  ✓' : '  ✗'} ${what}`); if (!ok) failures.push(`${step}: ${what}`); };

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 400, height: 860 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('dialog', d => d.accept()); // "Opravdu pustit…?" and similar questions
page.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errors.push(m.text()); });
const T = 300000;
const kk = (fn, arg) => page.evaluate(fn, arg);
const ready = async (extra = 800) => { await page.waitForSelector('#panel:not(.schovany)', { timeout: T }); await page.waitForTimeout(extra); };
const shot = name => page.screenshot({ path: path.join(OUT, name + '.png'), timeout: T });
const text = sel => page.textContent(sel);
// clicks the tile showing this text inside the page (the grids are re-drawn often, so no handles are kept)
const clickTile = (grid, txt) => page.evaluate(([g, t]) => {
  const el = [...document.querySelectorAll(g + ' .dlazdice')].find(e => e.textContent.includes(t));
  if (el) el.click();
  return !!el;
}, [grid, txt]);
// every text the bubble showed since watchBubble() (a later message, like a finished daily task, can replace it quickly)
const watchBubble = () => page.evaluate(() => {
  window.__bub = [];
  (window.__bubObs ||= new MutationObserver(() => window.__bub.push(document.getElementById('bublina').textContent))).observe(document.getElementById('bublina'), { childList: true, characterData: true, subtree: true });
});
const sawBubble = re => page.evaluate(src => window.__bub.some(t => new RegExp(src).test(t)), re.source);
const extras = async () => Promise.all((await page.$$('#akce-dalsi button')).map(async b => ({ b, t: (await b.textContent()).trim() })));

async function run(name, fn) {
  step = name;
  console.log(name);
  const before = errors.length;
  try { await fn(); } catch (e) { check(false, 'spadlo: ' + e.message.split('\n')[0]); await shot('chyba-' + name.replace(/\W+/g, '-')).catch(() => {}); }
  check(errors.length === before, 'bez chyb na stránce' + (errors.length > before ? ': ' + errors.slice(before).join(' | ') : ''));
}

try {
  await run('Jméno hráče', async () => {
    await page.goto(URL0, { waitUntil: 'domcontentloaded' });
    await kk(() => {
      localStorage.clear();
      // one hungry monster already in the collection, for reading, caring and hide and seek
      localStorage.setItem('kk-album', JSON.stringify([{ seed: 9001, name: 'Knoflík', tint: null, gen: 2, thumb: '',
        pece: { jidlo: 30, piti: 80, spanek: 80, mazleni: 80, hra: 80, zdravi: 100, bebi: null, cas: Date.now() } }]));
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('#start:not([hidden])', { timeout: T });
    await page.click('#start');
    await page.waitForSelector('#jmeno:not([hidden])', { timeout: 30000 });
    await page.fill('#jmeno-vstup', 'Maruška');
    await page.click('#jmeno-ok');
    await ready();
    check(JSON.parse(await kk(() => localStorage.getItem('kk-hrac'))).jmeno === 'Maruška', 'jméno je uložené');
  });

  const phase = () => kk(() => window.__kk.phase());
  // a DOM click: the pulsing button can be mid-animation, which made Playwright's click flaky in CI
  const main = async extra => { await page.waitForSelector('#btn-hlavni', { timeout: T }); await page.evaluate(() => document.querySelector('#btn-hlavni').click()); await ready(extra); };

  await run('Proměna laserem', async () => {
    check(await phase() === 'stage', 'věc čeká před krabicí');
    await main();                                               // one tap: in, lid shut
    check(await phase() === 'closed', 'věc je v zavřené krabici');
    await main();                                               // laser
    check(await phase() === 'done', 'laser proměnil věc');
    await main(3500);                                           // open
    check(await phase() === 'result', 'nová věc vyjela z krabice');
    check(/proměnil/.test(await text('#bublina')), 'bublina hlásí proměnu');
    await shot('1-promena');
  });

  await run('Miminko ze dvou příšerek', async () => {
    await kk(async () => { const k = window.__kk; await k.choose({ type: 'monster', monster: { seed: 9001, name: 'Knoflík', tint: null, gen: 2 } }); });
    await ready();
    await main(); // the monster from the collection stands in front: into the box
    await kk(() => { const k = window.__kk; k.setAlbum([...k.album(), { seed: 777, name: 'Bublinka', tint: null, gen: 3, thumb: '', pece: k.album()[0].pece }]); });
    await kk(() => [...document.querySelectorAll('#akce-dalsi button')].find(b => /druhou/.test(b.textContent)).click()); await page.waitForTimeout(600);
    // the picker offers the monsters of the collection right away
    const tabsNow = await kk(() => [...document.querySelectorAll('#zalozky-zdroj .aktivni')].map(b => b.textContent).join());
    check(/Příšerky/.test(tabsNow), 'k druhé příšerce nabídne výběr hned příšerky: ' + tabsNow);
    await kk(() => [...document.querySelectorAll('#mrizka-zdroj .dlazdice')].find(b => /Bublinka/.test(b.textContent)).click());
    await ready();
    check(await phase() === 'closed', 'obě příšerky jsou v krabici');
    await watchBubble();
    await main(); await main(3500);
    check(await sawBubble(/mají miminko/), 'bublina hlásí miminko: ' + (await kk(() => window.__bub.join(' | '))).slice(0, 300));
    await page.waitForTimeout(4000); // the baby joins the collection
    const baby = await kk(() => { const c = window.__kk.current(), e = window.__kk.album().find(a => a.seed === c.monster.seed); return e && { baby: e.baby, rust: e.rust, style: e.style, rodice: e.rodice }; });
    check(!!baby && baby.baby === true && baby.rust === 0, 'miminko je ve sbírce a je malé');
    check(!!baby && baby.rodice.join() === 'Knoflík,Bublinka' && !!baby.style, 'miminko zná rodiče a zdědilo druh');
    const fam = await kk(async () => {
      const { family } = await import('/js/mimi.js');
      const c = window.__kk.current(), al = window.__kk.album(), kid = al.find(a => a.seed === c.monster.seed);
      return { parent: family(kid, al.find(a => a.seed === 9001)), back: family(al.find(a => a.seed === 777), kid), sib: family(kid, { seed: 5, rodiceSeed: [9001, 42] }), stranger: family(kid, { seed: 6, name: 'Cizí' }) };
    });
    check(fam.parent && fam.back && fam.sib && !fam.stranger, 'rodiče, děti ani sourozenci spolu miminko mít nemůžou: ' + JSON.stringify(fam));
    // real care: the care panel shows how far the baby has grown
    if (!(await extras()).some(e => /Starat/.test(e.t))) { await kk(() => [...document.querySelectorAll('#akce-dalsi button')].find(b => /Vyndat/.test(b.textContent)).click()); await ready(1500); }
    await kk(() => [...document.querySelectorAll('#akce-dalsi button')].find(b => /Starat/.test(b.textContent)).click()); await page.waitForTimeout(800);
    check(/0 z 10/.test(await text('#pece .rust-info')), 'u péče je vidět, jak miminko roste');
    await kk(() => document.querySelectorAll('#pece .dlazdice')[0].click());
    await page.waitForFunction(() => /1 z 10/.test(document.querySelector('#pece .rust-info')?.textContent || ''), null, { timeout: 30000 }).catch(() => {});
    check(/1 z 10/.test(await text('#pece .rust-info')), 'po péči miminko povyrostlo: ' + await text('#pece .rust-info'));
    const grown = await kk(async () => {
      const { grow } = await import('/js/mimi.js');
      const c = window.__kk.current(), e = window.__kk.album().find(a => a.seed === c.monster.seed), s0 = c.obj.scale.x;
      let last = '';
      for (let i = 0; i < 9; i++) last = grow(c, e) || last;
      return { last, ratio: c.obj.scale.x / s0, baby: !!e.baby };
    });
    check(!grown.baby && /vyrostla/.test(grown.last), 'po deseti péčích miminko vyrostlo');
    check(Math.abs(grown.ratio - 1 / 0.55) < 0.01, 'a je větší');
    await shot('2a-miminko');
  });

  await run('Laser Boost', async () => {
    await kk(async () => { const b = await import('/js/boost.js'); b.addBoost(1); });
    await kk(async () => { const k = window.__kk; await k.choose({ type: 'item', item: k.ITEMS.find(i => i.id === 'auticko') }); });
    await ready();
    const boost = (await extras()).find(e => /Laser Boost/.test(e.t));
    check(!!boost, 'u zavřené krabice je tlačítko Laser Boost');
    await watchBubble();
    await kk(() => [...document.querySelectorAll('#akce-dalsi button')].find(b => /Laser Boost/.test(b.textContent)).click());
    await ready();
    check(await phase() === 'done', 'zlatý laser proměnil věc');
    await main(3500);
    check(await sawBubble(/Laser Boost/), 'bublina slaví Laser Boost');
    check(await kk(async () => (await import('/js/boost.js')).boostCount()) === 0, 'boost se spotřeboval');
    const c = await kk(() => { const c = window.__kk.current(); return c && { type: c.type, monster: c.monster && { tint: c.monster.tint } }; });
    if (c && c.type === 'monster') check(c.monster.tint === 0xffd34d, 'příšerka z boostu je zlatá');
    await shot('2b-boost');
  });

  await run('Adventní kalendář', async () => {
    check(await kk(() => !document.getElementById('btn-advent').hidden), 'v prosinci je vidět tlačítko kalendáře');
    const stars0 = await kk(() => Number(localStorage.getItem('kk-hvezdy') || 0));
    await kk(() => document.getElementById('btn-advent').click()); await page.waitForTimeout(500);
    check(await kk(() => document.querySelectorAll('#advent-mrizka .okenko').length) === 24, 'kalendář má 24 okének');
    await kk(() => document.querySelector('#advent-mrizka .okenko.zamcene').click()); await page.waitForTimeout(300);
    check(/ještě nejde/.test(await text('#advent-vzkaz')), 'budoucí okénko je zamčené');
    await kk(() => document.querySelector('#advent-mrizka .okenko.dnes').click()); await page.waitForTimeout(500);
    check(JSON.parse(await kk(() => localStorage.getItem('kk-advent'))).opened.includes(7), 'dnešní okénko je otevřené');
    check(await kk(() => Number(localStorage.getItem('kk-hvezdy') || 0)) === stars0 + 1, 'okénko dalo hvězdičku');
    check(!!(await text('#advent-vzkaz')).trim(), 'okénko ukazuje větu ke čtení');
    await shot('2c-advent');
    await kk(() => document.getElementById('advent-zavrit').click()); await page.waitForTimeout(300);
  });

  await run('Dopis od příšerky', async () => {
    check(await kk(async () => (await import('/js/dopisy.js')).novyDopis()), 'příšerka napsala dopis');
    check(await kk(() => !document.getElementById('btn-dopis').hidden), 'nahoře je obálka');
    const stars0 = await kk(() => Number(localStorage.getItem('kk-hvezdy') || 0));
    await kk(() => document.getElementById('btn-dopis').click()); await page.waitForTimeout(400);
    check(!!(await text('#dopis-text')).trim(), 'dopis jde přečíst');
    await kk(() => document.querySelector('#dopis-moznosti button').click()); await page.waitForTimeout(300);
    const word = await kk(() => [...document.querySelectorAll('#dopis-slovo .policko')].length);
    check(word >= 3, 'slovo má políčka na písmenka');
    await shot('2d-dopis');
    // wrong letters do nothing, the right ones fill the boxes one by one
    for (let i = 0; i < word; i++) {
      await kk(() => {
        // the right letter is the one that fills the next box: try each card until one sticks
        const boxes = [...document.querySelectorAll('#dopis-slovo .policko')], n = boxes.filter(b => b.textContent).length;
        for (const b of document.querySelectorAll('#dopis-pismena button:not(:disabled)')) { b.click(); if (boxes.filter(x => x.textContent).length > n) break; }
      });
      await page.waitForTimeout(150);
    }
    await page.waitForTimeout(900);
    check(await kk(() => document.getElementById('dopis').hidden), 'odpověď odešla');
    check(/dostala tvou odpověď/.test(await text('#bublina')), 'příšerka děkuje');
    check(await kk(() => Number(localStorage.getItem('kk-hvezdy') || 0)) === stars0 + 1, 'za dopis je hvězdička');
    check(await kk(() => document.getElementById('btn-dopis').hidden), 'obálka zmizela');
  });

  await run('Vaření podle receptu', async () => {
    await kk(() => window.__kk.showPicker()); await page.waitForTimeout(400);
    await kk(() => [...document.querySelectorAll('#zalozky-zdroj button')].find(b => /Vaření/.test(b.textContent)).click()); await page.waitForTimeout(300);
    check(await clickTile('#mrizka-zdroj', 'Pizza'), 'v kuchařce je pizza');
    await page.waitForTimeout(400);
    check(await kk(() => !document.getElementById('kucharka').hidden), 'recept je otevřený');
    check(/PI|pi/.test(await text('#kucharka-text')), 'recept jde přečíst');
    await kk(() => document.querySelector('#kucharka-suroviny [data-k="cokolada"]')?.click() || document.querySelector('#kucharka-suroviny button:not([data-k="mouka"]):not([data-k="rajce"]):not([data-k="syr"])').click());
    check(/není/.test(await text('#kucharka-napoveda')), 'špatná surovina se nepřidá');
    for (const k of ['mouka', 'rajce', 'syr']) { await kk(k => document.querySelector(`#kucharka-suroviny [data-k="${k}"]`).click(), k); await page.waitForTimeout(150); }
    await page.waitForTimeout(1200); await ready();
    check(await phase() === 'closed', 'miska je v krabici');
    const before = await kk(() => window.__kk.album().map(a => a.pece.jidlo));
    await watchBubble();
    await main(); await main(3500);
    check(await kk(() => { const c = window.__kk.current(); return c.type === 'jidlo' && !c.miska && c.id === 'pizza'; }), 'laser uvařil pizzu');
    check(await sawBubble(/Uvařil/), 'bublina hlásí uvařené jídlo');
    check(await kk(() => window.__kk.album().every(a => a.vylet || a.pece.jidlo === 100)) && before.length > 0, 'příšerky se najedly');
    await shot('2f-vareni');
  });

  await run('Tapety a koberce', async () => {
    await kk(() => window.__kk.setStars(30));
    await kk(() => window.__kk.openRoom()); await ready(1500);
    const btn = (await extras()).find(e => /Tapety/.test(e.t));
    check(!!btn, 'v pokojíčku je tlačítko Tapety a koberce');
    await kk(() => [...document.querySelectorAll('#akce-dalsi button')].find(b => /Tapety/.test(b.textContent)).click()); await page.waitForTimeout(500);
    check(await kk(() => document.querySelectorAll('#tapety-zed .dlazdice').length) >= 5, 'je z čeho vybírat');
    await kk(() => [...document.querySelectorAll('#tapety-zed .dlazdice')].find(b => /Sliz/.test(b.textContent)).click());
    await kk(() => [...document.querySelectorAll('#tapety-koberec .dlazdice')].find(b => /Duhový/.test(b.textContent)).click());
    await kk(() => [...document.querySelectorAll('#tapety-zed .dlazdice')].find(b => /🔒/.test(b.textContent)).click());
    const look = await kk(() => JSON.parse(localStorage.getItem('kk-tapety') || '{}'));
    check(look.zed === 'sliz' && look.koberec === 'duha', 'nová tapeta a koberec jsou uložené');
    check(/odemkne/.test(await text('#bublina')), 'zamčená tapeta řekne, kolik hvězdiček chybí');
    await kk(() => document.getElementById('tapety-zavrit').click()); await page.waitForTimeout(800);
    await shot('2g-tapety');
    await main(); // back to the box
  });

  await run('Kniha kouzel', async () => {
    await kk(async () => { const k = window.__kk; await k.choose({ type: 'item', item: k.ITEMS.find(i => i.id === 'liska') }); });
    await ready();
    check(await phase() === 'closed', 'věc z nabídky skočila rovnou do krabice');
    const add = (await extras()).find(e => /druhou/i.test(e.t));
    check(!!add, 'nabízí přidat druhou věc');
    await add.b.click(); await page.waitForTimeout(600);
    await kk(() => { const k = window.__kk; k.choose({ type: 'item', item: k.ITEMS.find(i => i.id === 'kytka') }); });
    await ready();
    check(!!(await kk(() => window.__kk.second())), 'v krabici jsou dvě věci');
    check(await phase() === 'closed', 'víko se samo zavřelo');
    await main(); await main(3500);
    check(Object.keys(await kk(() => window.__kk.kniha())).includes('kvetouci-liska'), 'tajné kouzlo je v Knize kouzel');
    check(/Tajné kouzlo/.test(await text('#bublina')), 'bublina hlásí tajné kouzlo');
    await shot('2-kniha');
  });

  const albumMonster = async () => {
    await page.click('#btn-album'); await page.waitForTimeout(400);
    await page.click('#album-zalozky [data-tab="sbirka"]'); await page.waitForTimeout(300);
    // the monster from the start (seed 9001), not the baby born earlier
    await kk(() => { const i = window.__kk.album().findIndex(a => a.seed === 9001); document.querySelectorAll('#album-mrizka .dlazdice')[i].click(); }); await ready();
  };
  const NEED_ICON = { jidlo: '🍎', piti: '🥤', spanek: '😴', mazleni: '🤗', hra: '⚽', zdravi: '🩹' };

  await run('Čtení s příšerkou', async () => {
    await albumMonster();
    check((await kk(() => window.__kk.current()?.type)) === 'monster', 'příšerka ze sbírky je na stolku');
    const read = (await extras()).find(e => /Čtení/i.test(e.t));
    check(!!read, 'příšerka nabízí čtení');
    await read.b.click(); await ready();
    const stars0 = Number(await kk(() => localStorage.getItem('kk-hvezdy') || 0));
    for (let i = 0; i < 3; i++) {
      const r = await kk(() => { const r = window.__kk.readRound(); return { need: r.need || null, icon: r.need ? null : r.answer.e }; });
      const icon = r.need ? NEED_ICON[r.need] : r.icon;
      check(await clickTile('#cteni-volby', icon), 'správná odpověď je mezi možnostmi');
      await page.waitForTimeout(3000);
    }
    const stars1 = Number(await kk(() => localStorage.getItem('kk-hvezdy') || 0));
    check(stars1 > stars0, `hvězdičky přibyly (${stars0} → ${stars1})`);
    await shot('3-cteni');
  });

  await run('Péče o příšerku', async () => {
    await kk(() => window.__kk.setPhase('stage')); await ready();
    const care = (await extras()).find(e => /Starat se/i.test(e.t));
    check(!!care, 'příšerka nabízí péči');
    await care.b.click(); await ready();
    const hunger = () => kk(() => { const k = window.__kk; return k.album().find(a => a.seed === k.current().monster.seed).pece.jidlo; });
    await kk(() => { const k = window.__kk; k.album().find(a => a.seed === k.current().monster.seed).pece.jidlo = 30; });
    const before = await hunger();
    check(await clickTile('#pece', '🍎'), 'je vidět jídlo');
    await page.waitForFunction(b => { const k = window.__kk; return k.album().find(a => a.seed === k.current().monster.seed).pece.jidlo > b; }, before, { timeout: 60000 }).catch(() => {});
    const after = await hunger();
    check(after > before, `příšerka je najedená (${Math.round(before)} → ${Math.round(after)})`);
    await page.waitForTimeout(1000);
    await shot('4-pece');
  });

  await run('Pokojíček', async () => {
    await kk(() => window.__kk.setPhase('stage')); await ready();
    await kk(async () => { const k = window.__kk; await k.openRoom(); });
    await ready();
    const spot = await kk(() => { const k = window.__kk, d = k.decor(); return k.spots().find(s => !d[s.id] && !s.id.startsWith('r')).id; });
    await kk(async id => { const k = window.__kk; await k.placeInRoom(k.spots().find(s => s.id === id)); }, spot);
    await page.waitForTimeout(2500);
    const saved = JSON.parse(await kk(() => localStorage.getItem('kk-pokoj')));
    check(!!saved.spots[spot], `příšerka sedí na místě ${spot} a je to uložené`);
    await shot('5-pokoj');
  });

  await run('Schovávaná', async () => {
    if (await kk(() => !!window.__kk.current())) { await kk(() => window.__kk.setPhase('stage')); await ready(); }
    await albumMonster();
    await kk(() => window.__kk.startSchovka()); await ready();
    check(!!(await text('#schovka-karta')).trim(), 'je vidět vzkaz od příšerky');
    const pos = await kk(() => {
      const k = window.__kk, z = { postel: [-3.7, 0.5, -1.6], kytka: [-2.4, 0.55, -2.15], okno: [-1.45, 1.8, -2.55], krabice: [0, 0.55, -1.05], taburet: [2.15, 0.2, -1.2], pohary: [2.35, 0.3, -2.25], knizky: [1.4, 1.85, -2.47] }[k.schovka().place.zone];
      return z;
    });
    // pan the room until the hiding place is on screen, then tap it
    let pt;
    for (let i = 0; i < 4; i++) {
      pt = await kk(z => { const k = window.__kk; const v = new k.camera.position.constructor(...z).project(k.camera); return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]; }, pos);
      if (pt[0] > 20 && pt[0] < 380) break;
      const dir = pt[0] < 20 ? 1 : -1;
      await page.mouse.move(200, 300); await page.mouse.down();
      await page.mouse.move(200 + dir * 120, 300, { steps: 4 }); await page.mouse.move(200 + dir * 190, 300, { steps: 4 });
      await page.mouse.up(); await page.waitForTimeout(1500);
    }
    await page.mouse.click(pt[0], pt[1]); await page.waitForTimeout(3500);
    check(await kk(() => window.__kk.schovka()?.found) === true, 'příšerka je nalezená');
    await shot('6-schovka');
    await (await extras())[0].b.click(); await ready();
  });

  await run('Nepořádek', async () => {
    check((await kk(() => window.__kk.makeMess('louze')?.kind)) === 'louze', 'příšerka vylila hrnek');
    check(await page.evaluate(() => document.getElementById('btn-pokoj').classList.contains('neporadek')), 'u pokojíčku je koště');
    await kk(() => window.__kk.openRoom()); await ready(1500);
    // the puddle can be anywhere in the room: tap its broom sign when on screen, otherwise go through the same handler
    const pt = await kk(() => { const k = window.__kk; const s = k.room.children.find(o => o.isSprite && o.userData.pokoj?.kind === 'mess'); const v = s.position.clone().project(k.camera); return { id: s.userData.pokoj.id, x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight }; });
    if (pt.x > 40 && pt.x < 360 && pt.y > 80 && pt.y < 600) await page.mouse.click(pt.x, pt.y);
    else await kk(id => window.__kk.tapMess(id), pt.id);
    await ready(1000);
    await page.waitForFunction(() => window.__kk.phase() === 'uklid', null, { timeout: 15000 }).catch(() => {}); // the culprit comes over first
    check(await phase() === 'uklid', 'viník se přiznal');
    const self = (await extras()).find(e => /sama/.test(e.t));
    await self.b.click(); await page.waitForTimeout(800); await ready(1000);
    await kk(id => window.__kk.tapMess(id), pt.id); await page.waitForTimeout(1500); await ready(1000); // the child tidies the mug up
    check((await kk(() => window.__kk.messCount())) === 0 && await phase() === 'pokoj', 'je uklizeno');
  });

  await run('Velký nepořádek', async () => {
    await kk(() => window.__kk.makeMess());
    const n = await kk(() => window.__kk.messCount());
    check(n >= 8, `v pokoji je velký nepořádek (${n} věcí)`);
    await page.waitForTimeout(800);
    await shot('7-neporadek');
    // nothing of the mess may stick into the furniture or into each other (no physics: positions are placed by hand)
    const hits = await kk(async () => {
      const THREE = await import('three');
      const r = window.__kk.room, bed = r.userData.bed, out = [];
      const box = (o, name) => { const b = new THREE.Box3().setFromObject(o, true); b.expandByScalar(-0.02); b.name = name; return b; };
      const things = window.__kk.messObjects().filter(o => o !== bed).map((o, i) => box(o, 'nepořádek ' + i));
      things.push(box(bed.userData.pillow, 'polštář'));
      const fixed = r.userData.props.filter(p => p.obj).map(p => box(p.obj, p.id));
      fixed.push(...Object.values(window.__kk.decor()).filter(c => c.holder.position.y < 0.1).map(c => box(c.holder, 'ozdoba')));
      // the box itself (its whole group also holds the beams and whatever stands on the stage)
      const krabice = new THREE.Box3(new THREE.Vector3(-0.97, 0, -1.64), new THREE.Vector3(0.87, 1.3, -0.41)); krabice.name = 'krabice'; fixed.push(krabice);
      const frame = new THREE.Box3(new THREE.Vector3(bed.position.x - 0.6, 0, bed.position.z - 0.95), new THREE.Vector3(bed.position.x + 0.6, 0.4, bed.position.z + 0.95)); frame.name = 'postel';
      fixed.push(frame);
      things.forEach((a, i) => {
        if (a.min.y < -0.03) out.push(a.name + ' pod podlahou');
        for (const b of [...fixed, ...things.slice(i + 1)]) if (a.intersectsBox(b)) out.push(a.name + ' × ' + b.name);
      });
      return out;
    });
    check(!hits.length, 'nepořádek nic neprotíná' + (hits.length ? ': ' + hits.join(', ') : ''));
    const ids = await kk(() => JSON.parse(localStorage.getItem('kk-neporadek')).list.map(m => m.id));
    await kk(id => window.__kk.tapMess(id), ids[0]); await ready(1000);
    check(/Zbývá/.test(await text('#akce-nadpis')), 'panel ukazuje, kolik věcí zbývá');
    // the child tidies two things, then the monster is asked until she does the rest
    await kk(() => [...document.querySelectorAll('#akce-dalsi button')].find(b => /sama/.test(b.textContent)).click()); await ready(600);
    for (const id of ids.slice(1, 3)) { await kk(id => window.__kk.tapMess(id), id); await page.waitForTimeout(1200); }
    check(await kk(() => window.__kk.messCount()) === n - 2, 'věci jde uklízet po jedné');
    for (let i = 0; i < 6 && await kk(() => window.__kk.messCount()); i++) { await main(); await page.waitForTimeout(1500); await ready(1000); }
    check(await kk(() => window.__kk.messCount()) === 0 && await phase() === 'pokoj', 'příšerka uklidila zbytek');
    await main();
  });

  await run('Výlet s pohlednicí', async () => {
    await albumMonster();
    const trip = (await extras()).find(e => /výlet/.test(e.t));
    check(!!trip, 'u příšerky je tlačítko Poslat na výlet');
    await kk(() => [...document.querySelectorAll('#akce-dalsi button')].find(b => /výlet/.test(b.textContent)).click());
    await page.waitForSelector('#krok-vyber:not([hidden])', { timeout: 60000 });
    check(await kk(() => !!window.__kk.album().find(a => a.seed === 9001).vylet), 'příšerka je na výletě');
    check(/jede/.test(await text('#bublina')), 'bublina říká, kam jede');
    const n0 = await kk(() => JSON.parse(localStorage.getItem('kk-pokoj') || '{}').ozdoby?.length || 0);
    await kk(async () => (await import('/js/vylety.js')).checkTrips(true)); // pretend the time is up
    await page.waitForTimeout(500);
    check(await kk(() => !document.getElementById('pohlednice').hidden), 'přišla pohlednice');
    check(!!(await text('#pohlednice-text')).trim() && /Suvenýr/.test(await text('#pohlednice-dar')), 'pohlednice jde přečíst a je u ní suvenýr');
    check(await kk(() => JSON.parse(localStorage.getItem('kk-pokoj') || '{}').ozdoby?.length || 0) === n0 + 1, 'suvenýr je v pokojíčku');
    check(await kk(() => !window.__kk.album().find(a => a.seed === 9001).vylet), 'příšerka je zpátky');
    await shot('2e-pohlednice');
    await kk(() => document.getElementById('pohlednice-ok').click()); await page.waitForTimeout(300);
  });

  await run('Úkoly dne a dárek', async () => {
    // all tasks but one are done; the last one is finished by its own game event
    await kk(() => {
      const k = window.__kk, [t, ...rest] = k.den().tasks;
      for (const r of rest) r.n = r.goal;
      t.n = t.goal - 1;
      k.dayEvent(t.on, { need: t.need, type: t.kind === 'monster' ? 'monster' : t.kind === 'item' ? 'item' : undefined, item: t.item, dvojice: t.kind === 'dvojice' });
    });
    await kk(() => document.getElementById('btn-den').click()); await page.waitForTimeout(600);
    await kk(() => document.getElementById('den-truhla').click()); await page.waitForTimeout(1000);
    check(!!(await text('#den-odmena')).trim(), 'dárek ukazuje ozdobu');
    check(JSON.parse(await kk(() => localStorage.getItem('kk-kalendar') || '[]')).length === 1, 'den je v kalendáři');
    await shot('7-darek');
  });

  await run('Pustit na svobodu', async () => {
    await kk(() => { document.getElementById('den').hidden = true; });
    await albumMonster();
    const seed = await kk(() => window.__kk.current().monster.seed);
    const n0 = await kk(() => window.__kk.album().length);
    const free = (await extras()).find(e => /svobodu/.test(e.t));
    check(!!free, 'u příšerky je tlačítko Pustit na svobodu');
    await free.b.click();
    await page.waitForSelector('#krok-vyber:not([hidden])', { timeout: 60000 });
    check(await kk(() => window.__kk.album().length) === n0 - 1, 'příšerka zmizela ze sbírky');
    check(await kk(s => !JSON.stringify(JSON.parse(localStorage.getItem('kk-pokoj') || '{}').spots || {}).includes(String(s)), seed), 'v pokojíčku taky není');
    await shot('8-svoboda');
  });
} finally {
  await browser.close();
  server.close();
}

if (failures.length) { console.log(`\n${failures.length} chyb:\n- ` + failures.join('\n- ')); process.exit(1); }
console.log('\nVšechno funguje.');
