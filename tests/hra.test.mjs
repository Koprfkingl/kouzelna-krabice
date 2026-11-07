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
const URL0 = `http://localhost:${server.address().port}/?demo&okamzite`;

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
    await kk(() => window.__kk.LID_STEPS.stage()); await ready();
    check(await phase() === 'stageOpen', 'víko se otevřelo');
    await main();
    check(await phase() === 'inside', 'věc je v krabici');
    await main();
    check(await phase() === 'closed', 'víko je zavřené');
    await main();                                               // laser
    check(await phase() === 'done', 'laser proměnil věc');
    await main(3500);                                           // open
    check(await phase() === 'result', 'nová věc vyjela z krabice');
    check(/proměnil/.test(await text('#bublina')), 'bublina hlásí proměnu');
    await shot('1-promena');
  });

  await run('Kniha kouzel', async () => {
    await kk(async () => { const k = window.__kk; await k.choose({ type: 'item', item: k.ITEMS.find(i => i.id === 'liska') }); });
    await ready();
    await kk(() => window.__kk.LID_STEPS.stage()); await ready();
    await main();
    const add = (await extras()).find(e => /druhou/i.test(e.t));
    check(!!add, 'nabízí přidat druhou věc');
    await add.b.click(); await page.waitForTimeout(600);
    await kk(() => { const k = window.__kk; k.choose({ type: 'item', item: k.ITEMS.find(i => i.id === 'kytka') }); });
    await ready();
    check(!!(await kk(() => window.__kk.second())), 'v krabici jsou dvě věci');
    await main(); await main(); await main(3500);
    check(Object.keys(await kk(() => window.__kk.kniha())).includes('kvetouci-liska'), 'tajné kouzlo je v Knize kouzel');
    check(/Tajné kouzlo/.test(await text('#bublina')), 'bublina hlásí tajné kouzlo');
    await shot('2-kniha');
  });

  const albumMonster = async () => {
    await page.click('#btn-album'); await page.waitForTimeout(400);
    await page.click('#album-zalozky [data-tab="sbirka"]'); await page.waitForTimeout(300);
    await page.click('#album-mrizka .dlazdice'); await ready();
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
