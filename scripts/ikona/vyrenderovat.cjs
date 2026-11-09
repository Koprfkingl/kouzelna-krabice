const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 400, height: 860 }, deviceScaleFactor: 1 });
  p.on('pageerror', e => console.log('PAGEERROR', e.message));
  p.on('console', m => { if (m.type() === 'log') console.log(m.text()); });
  await p.goto('http://localhost:8123/?demo&okamzite', { waitUntil: 'domcontentloaded' });
  await p.evaluate(() => { localStorage.clear(); localStorage.setItem('kk-hrac', '{"jmeno":"Maruška"}'); });
  await p.reload({ waitUntil: 'load' });
  await p.waitForSelector('#start:not([hidden])', { timeout: 300000 });
  await p.click('#start');
  await p.waitForSelector('#panel:not(.schovany)', { timeout: 300000 });
  const seeds = JSON.parse(process.argv[2] || '[]');
  const out = await p.evaluate(async ([seeds, cam]) => {
    const THREE = await import('three');
    const { makeMonster } = await import('/js/monster.js');
    const { toonify } = await import('/js/vzhled.js');
    const { monsterStyle } = await import('/js/monster2.js');
    const k = window.__kk;
    const m = await import('/js/main.js'); await m.removeCurrent(true);
    window.__camLock = true;
    k.room.visible = false;
    const sc = k.scene;
    for (const o of sc.children) if (!o.isLight && o !== k.box) o.visible = false;
    const bg = sc.background; sc.background = null; const fog = sc.fog; sc.fog = null;
    k.box.userData.setLid(1); k.box.userData.setInnerLight(1.2); k.box.userData.setMist(0);
    const res = [];
    for (const seed of seeds) {
      const mon = makeMonster(seed, { size: 1.25, gen: 3 }); toonify(mon);
      const slot = k.box.userData.inside;
      mon.position.set(0, k.box.userData.top - slot.position.y - 0.05, 0.05);
      slot.add(mon);
      for (let i = 0; i < 30; i++) mon.userData.monster?.update?.(1.2, k.camera.position);
      k.camera.position.set(...cam.pos); k.camera.lookAt(...cam.look); k.camera.fov = cam.fov; k.camera.aspect = 1; k.camera.updateProjectionMatrix();
      const rt = new THREE.WebGLRenderTarget(1024, 1024, { samples: 4, colorSpace: THREE.SRGBColorSpace });
      const r = k.renderer; r.setRenderTarget(rt); r.setClearColor(0x000000, 0); r.clear(); r.render(sc, k.camera); 
      const buf = new Uint8Array(1024 * 1024 * 4); r.readRenderTargetPixels(rt, 0, 0, 1024, 1024, buf); r.setRenderTarget(null);
      const c = document.createElement('canvas'); c.width = c.height = 1024; const g = c.getContext('2d'); const img = g.createImageData(1024, 1024);
      for (let y = 0; y < 1024; y++) img.data.set(buf.subarray((1023 - y) * 4096, (1024 - y) * 4096), y * 4096);
      g.putImageData(img, 0, 0);
      res.push([seed, monsterStyle(seed, 3), c.toDataURL('image/png')]);
      slot.remove(mon);
    }
    return res;
  }, [seeds, JSON.parse(process.argv[3])]);
  const fs = require('fs');
  for (const [s, st, d] of out) { fs.writeFileSync(`shots/icon_${s}.png`, Buffer.from(d.split(',')[1], 'base64')); console.log(s, st); }
  await b.close();
})();
