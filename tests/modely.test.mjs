// Checks every model of the game for the kind of glitches that are easy to miss by eye:
// - a part that does not vanish with the rest (a hat floating in the air during hide and seek),
// - a cartoon outline that does not move with the model (the parrot's black "wing shadows"),
// - flat pictures (sprites) inside a model, which the dissolve effect cannot hide.
// Every thing (catalogue items, secret spells, gift decorations, a monster with each accessory, also one put on
// later in the wardrobe) is built, rendered alone while fully dissolved (nothing may be left) and while whole
// (something must be there), and its outlines are compared with the meshes they follow.
// Usage: npm run test:modely   (needs `npm run vendor` first)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const ROOT = path.resolve('www');
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
const T = 300000;

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 400, height: 860 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errors.push(m.text()); });

await page.goto(`http://localhost:${server.address().port}/?demo&okamzite`, { waitUntil: 'domcontentloaded' });
await page.evaluate(() => { localStorage.clear(); localStorage.setItem('kk-hrac', '{"jmeno":"Test"}'); });
await page.reload({ waitUntil: 'load' });
await page.waitForSelector('#start:not([hidden])', { timeout: T });
await page.click('#start');
await page.waitForSelector('#panel:not(.schovany)', { timeout: T });

// The list of things to check, built in the page.
const list = await page.evaluate(async () => {
  const { KOUZLA } = await import('/js/kouzla.js');
  const { OZDOBY } = await import('/js/ozdoby.js');
  const { DOPLNKY } = await import('/js/doplnky.js');
  const k = window.__kk;
  return [
    ...k.ITEMS.map(i => ({ name: i.name, src: { type: 'item', id: i.id } })),
    ...KOUZLA.map(x => ({ name: x.name, src: { type: 'combo', id: x.id } })),
    ...(OZDOBY || []).map(o => ({ name: o.nazev, src: { type: 'ozdoba', id: o.id } })),
    { name: 'Příšerka', src: { type: 'monster' } },
    ...DOPLNKY.map(d => ({ name: `Příšerka s doplňkem ${d.nazev}`, src: { type: 'monster' }, wear: d.id })),
    ...DOPLNKY.map(d => ({ name: `Příšerka, ${d.nazev} oblečený v šatníku`, src: { type: 'monster' }, wear: d.id, later: true })),
  ];
});

const failures = [];
for (const t of list) {
  const r = await page.evaluate(async t => {
    const THREE = await import('three');
    const { buildFor } = await import('/js/main.js');
    const { wear } = await import('/js/doplnky.js');
    const k = window.__kk;
    const src = t.src.type === 'item' ? { type: 'item', item: k.ITEMS.find(i => i.id === t.src.id) }
      : t.src.type === 'monster' ? { type: 'monster', monster: { seed: 4242, name: 'Test', tint: null, gen: 2 } } : t.src;
    // an accessory is either part of the saved monster (built with it) or put on afterwards in the wardrobe
    const album = k.album();
    if (t.wear && !t.later) k.setAlbum([{ seed: 4242, name: 'Test', tint: null, gen: 2, thumb: '', doplnky: [t.wear] }]);
    let c;
    try { c = await buildFor(src, { decor: true }); } finally { if (t.wear && !t.later) k.setAlbum(album); }
    if (t.later) wear(c.obj, [t.wear]);
    const problems = [];

    // outlines must follow their mesh: bones for skinned models, morph targets for shape-animated ones
    c.holder.traverse(o => {
      if (o.isSprite || o.isPoints) problems.push(`plochý obrázek ${o.type} ${o.name} nejde rozpustit`);
      if (!o.userData.outline) return;
      const m = o.parent;
      if (m.isSkinnedMesh && !(o.isSkinnedMesh && o.skeleton === m.skeleton)) problems.push(`obrys ${m.name} se nehýbe s kostmi`);
      if (m.morphTargetInfluences && o.morphTargetInfluences !== m.morphTargetInfluences) problems.push(`obrys ${m.name} nesleduje změny tvaru (morph)`);
    });

    // render it alone: fully dissolved nothing may be left, whole there must be something
    const renderer = k.renderer, size = 96;
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0x888888, 2));
    scene.add(c.holder);
    c.holder.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(c.holder, true), ctr = box.getCenter(new THREE.Vector3());
    const rad = Math.max(box.getSize(new THREE.Vector3()).length() / 2, 0.05);
    const cam = new THREE.PerspectiveCamera(40, 1, rad * 0.1, rad * 10);
    cam.position.copy(ctr).add(new THREE.Vector3(0.3, 0.4, 1).normalize().multiplyScalar(rad * 3.2));
    cam.lookAt(ctr);
    const rt = new THREE.WebGLRenderTarget(size, size);
    const buf = new Uint8Array(size * size * 4);
    const count = () => {
      const prevTarget = renderer.getRenderTarget(), prevColor = renderer.getClearColor(new THREE.Color()), prevAlpha = renderer.getClearAlpha();
      renderer.setRenderTarget(rt);
      renderer.setClearColor(0x000000, 0);
      renderer.clear();
      renderer.render(scene, cam);
      renderer.readRenderTargetPixels(rt, 0, 0, size, size, buf);
      renderer.setRenderTarget(prevTarget);
      renderer.setClearColor(prevColor, prevAlpha);
      let n = 0;
      for (let i = 3; i < buf.length; i += 4) if (buf[i] > 8) n++;
      return n;
    };
    c.dis.uDis.value = 0;
    const whole = count();
    c.dis.uDis.value = 1;
    const left = count();
    if (whole < 20) problems.push(`celý model skoro není vidět (${whole} bodů)`);
    if (left > 3) problems.push(`po rozpuštění zůstalo vidět ${left} bodů z ${whole}`);
    rt.dispose();
    c.holder.removeFromParent();
    return problems;
  }, t).catch(e => [`spadlo: ${e.message.split('\n')[0]}`]);
  console.log(`${r.length ? '  ✗' : '  ✓'} ${t.name}${r.length ? ': ' + r.join('; ') : ''}`);
  for (const p of r) failures.push(`${t.name}: ${p}`);
}
if (errors.length) failures.push(...errors.map(e => 'chyba na stránce: ' + e));

await browser.close();
server.close();
console.log(failures.length ? `\n${failures.length} chyb:\n- ${failures.join('\n- ')}` : '\nVšechny modely jsou v pořádku.');
process.exit(failures.length ? 1 : 0);
