// A child's bedroom around the magic box: wallpaper, a window with curtains, a shelf with books,
// a garland, a fluffy rug and a few real furniture models from the catalog.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}

function star(g, x, y, r, n = 5) {
  g.beginPath();
  for (let i = 0; i <= n * 2; i++) {
    const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2, rr = i % 2 ? r * 0.45 : r;
    i ? g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr) : g.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  g.fill();
}

function wallpaper() {
  return canvasTex(512, 512, (g, w, h) => {
    // soft mint stripes
    g.fillStyle = '#f3e9f2'; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 64) { g.fillStyle = 'rgba(190,226,218,0.45)'; g.fillRect(x, 0, 32, h); }
    // little stars and moons
    const rnd = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
    for (let i = 0; i < 18; i++) {
      const x = rnd() * w, y = rnd() * h;
      g.fillStyle = ['#f6c85f', '#f29bc0', '#9cc7f0', '#b9a3e8'][i % 4];
      if (i % 5 === 0) { g.beginPath(); g.arc(x, y, 12, 0, Math.PI * 2); g.fill(); g.fillStyle = '#f3e9f2'; g.beginPath(); g.arc(x + 6, y - 4, 11, 0, Math.PI * 2); g.fill(); }
      else star(g, x, y, 9 + rnd() * 5);
    }
  }, [3, 2]);
}

function skyTexture() {
  return canvasTex(256, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#5fa8ff'); gr.addColorStop(0.7, '#bfe3ff'); gr.addColorStop(1, '#e8f6ff');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.9)';
    for (const [x, y, s] of [[60, 70, 1], [180, 120, 0.8], [110, 180, 0.6]]) {
      for (const [dx, dy, r] of [[0, 0, 22], [22, -8, 26], [46, 2, 20], [24, 10, 22]]) { g.beginPath(); g.arc(x + dx * s, y + dy * s, r * s, 0, Math.PI * 2); g.fill(); }
    }
    // a tree top
    g.fillStyle = '#5fae5a'; g.beginPath(); g.arc(30, 250, 70, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#4c9a49'; g.beginPath(); g.arc(230, 260, 55, 0, Math.PI * 2); g.fill();
  });
}

function rugTexture() {
  return canvasTex(512, 512, (g, w) => {
    const cols = ['#f7c6d9', '#fbe3a4', '#bfe6dd', '#cdbcf0', '#f7c6d9', '#fff3f7'];
    for (let i = 0; i < cols.length; i++) {
      g.fillStyle = cols[i];
      g.beginPath(); g.arc(w / 2, w / 2, w / 2 * (1 - i / cols.length), 0, Math.PI * 2); g.fill();
    }
    // woolly noise
    const img = g.getImageData(0, 0, w, w);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (Math.random() - 0.5) * 26;
      img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
    }
    g.putImageData(img, 0, 0);
  });
}

function bookSpine(color, title) {
  return canvasTex(64, 256, (g, w, h) => {
    g.fillStyle = color; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.75)'; g.fillRect(0, 22, w, 6); g.fillRect(0, h - 28, w, 6);
    g.save(); g.translate(w / 2 + 6, h / 2); g.rotate(-Math.PI / 2);
    g.font = 'bold 26px sans-serif'; g.textAlign = 'center'; g.fillText(title, 0, 0); g.restore();
  });
}

function pictureTexture() {
  return canvasTex(256, 200, (g, w, h) => {
    g.fillStyle = '#fffaf0'; g.fillRect(0, 0, w, h);
    // a child's drawing: sun, house, flowers
    g.fillStyle = '#ffd23f'; g.beginPath(); g.arc(205, 45, 26, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#ffd23f'; g.lineWidth = 5;
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; g.beginPath(); g.moveTo(205 + Math.cos(a) * 32, 45 + Math.sin(a) * 32); g.lineTo(205 + Math.cos(a) * 44, 45 + Math.sin(a) * 44); g.stroke(); }
    g.fillStyle = '#ff7a8a'; g.fillRect(50, 95, 90, 70);
    g.fillStyle = '#7a4fd6'; g.beginPath(); g.moveTo(40, 98); g.lineTo(95, 50); g.lineTo(150, 98); g.fill();
    g.fillStyle = '#5ab0ff'; g.fillRect(70, 112, 22, 22); g.fillStyle = '#8a5a2b'; g.fillRect(105, 125, 22, 40);
    g.fillStyle = '#4caf50'; g.fillRect(0, 165, w, 35);
    for (const x of [170, 200, 230]) { g.fillStyle = '#e91e63'; g.beginPath(); g.arc(x, 155, 8, 0, Math.PI * 2); g.fill(); }
  });
}

export function makeRoom(tex) {
  const room = new THREE.Group();
  const BACK = -2.6, SIDE = 3.2, HEIGHT = 3.4;

  // Floor: warm parquet
  const floorTex = {};
  for (const [k, t] of Object.entries(tex)) { floorTex[k] = t.clone(); floorTex[k].repeat.set(4, 4); floorTex[k].needsUpdate = true; }
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(SIDE * 2, 8), new THREE.MeshStandardMaterial({
    map: floorTex.wood, roughnessMap: floorTex.woodRough, bumpMap: floorTex.woodBump, bumpScale: 0.5, color: 0xdcb48c, roughness: 0.55,
  }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.z = 1.2;
  floor.receiveShadow = true;
  room.add(floor);

  // Walls with wallpaper
  const wallMat = new THREE.MeshStandardMaterial({ map: wallpaper(), roughness: 0.92 });
  const back = new THREE.Mesh(new THREE.PlaneGeometry(SIDE * 2, HEIGHT), wallMat);
  back.position.set(0, HEIGHT / 2, BACK);
  back.receiveShadow = true;
  room.add(back);
  for (const s of [-1, 1]) {
    const side = new THREE.Mesh(new THREE.PlaneGeometry(8, HEIGHT), wallMat);
    side.position.set(s * SIDE, HEIGHT / 2, 1.4);
    side.rotation.y = -s * Math.PI / 2;
    side.receiveShadow = true;
    room.add(side);
  }
  // Skirting board
  const white = new THREE.MeshStandardMaterial({ color: 0xfbf8f4, roughness: 0.45 });
  const skirt = new THREE.Mesh(new THREE.BoxGeometry(SIDE * 2, 0.12, 0.03), white);
  skirt.position.set(0, 0.06, BACK + 0.015);
  room.add(skirt);

  // Window on the left with sky, frame and curtains
  const win = new THREE.Group();
  win.position.set(-1.45, 1.85, BACK + 0.01);
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.3), new THREE.MeshBasicMaterial({ map: skyTexture() }));
  sky.position.z = -0.005;
  win.add(sky);
  const frameParts = [[1.32, 0.08, 0, 0.69], [1.32, 0.08, 0, -0.69], [0.08, 1.46, -0.62, 0], [0.08, 1.46, 0.62, 0], [0.04, 1.3, 0, 0], [1.2, 0.04, 0, 0.1]];
  for (const [w, h, x, y] of frameParts) {
    const f = new THREE.Mesh(new RoundedBoxGeometry(w, h, 0.08, 2, 0.015), white);
    f.position.set(x, y, 0.03);
    f.castShadow = true;
    win.add(f);
  }
  const sill = new THREE.Mesh(new RoundedBoxGeometry(1.5, 0.05, 0.22, 2, 0.02), white);
  sill.position.set(0, -0.75, 0.1);
  sill.castShadow = sill.receiveShadow = true;
  win.add(sill);
  // Curtains: wavy planes in pastel velvet
  const curtainGeo = new THREE.PlaneGeometry(0.42, 1.9, 24, 1);
  const cp = curtainGeo.attributes.position;
  for (let i = 0; i < cp.count; i++) cp.setZ(i, Math.sin(cp.getX(i) * 38) * 0.035);
  curtainGeo.computeVertexNormals();
  const curtainMat = new THREE.MeshPhysicalMaterial({ color: 0xf2a7c3, roughness: 0.8, sheen: 1, sheenColor: 0xffd6e6, sheenRoughness: 0.5, side: THREE.DoubleSide });
  for (const s of [-1, 1]) {
    const c = new THREE.Mesh(curtainGeo, curtainMat);
    c.position.set(s * 0.8, -0.05, 0.12);
    c.castShadow = true;
    win.add(c);
  }
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 2.1, 12), new THREE.MeshStandardMaterial({ color: 0xd9a84e, metalness: 1, roughness: 0.3 }));
  rod.rotation.z = Math.PI / 2;
  rod.position.set(0, 0.92, 0.14);
  win.add(rod);
  room.add(win);
  // Daylight from the window
  const daylight = new THREE.PointLight(0xdcefff, 3.5, 6, 1.6);
  daylight.position.set(-1.45, 1.9, BACK + 0.6);
  room.add(daylight);

  // Shelf on the right with books
  const shelf = new THREE.Group();
  shelf.position.set(1.4, 1.55, BACK + 0.13);
  const board = new THREE.Mesh(new RoundedBoxGeometry(1.3, 0.05, 0.26, 2, 0.015), white);
  board.castShadow = board.receiveShadow = true;
  shelf.add(board);
  const board2 = board.clone(); board2.position.y = 0.62; shelf.add(board2);
  const books = [['#e85d75', 'POHÁDKY'], ['#5b8def', 'ZVÍŘÁTKA'], ['#f2b134', 'ABECEDA'], ['#6cc08b', 'LES'], ['#a070e0', 'HVĚZDY'], ['#ff8a5c', 'KOČKA']];
  let bx = -0.55;
  books.forEach(([c, t], i) => {
    const h = 0.28 + (i % 3) * 0.04, w = 0.07 + (i % 2) * 0.02;
    const spine = bookSpine(c, t);
    const m = [new THREE.MeshStandardMaterial({ color: c, roughness: 0.6 }), new THREE.MeshStandardMaterial({ color: c, roughness: 0.6 }),
      new THREE.MeshStandardMaterial({ color: 0xf5f0e6, roughness: 0.9 }), new THREE.MeshStandardMaterial({ color: 0xf5f0e6, roughness: 0.9 }),
      new THREE.MeshStandardMaterial({ map: spine, roughness: 0.55 }), new THREE.MeshStandardMaterial({ color: c, roughness: 0.6 })];
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.2), m);
    b.position.set(bx + w / 2, 0.025 + h / 2, 0);
    if (i === books.length - 1) { b.rotation.z = -0.25; b.position.x += 0.04; }
    b.castShadow = true;
    shelf.add(b);
    bx += w + 0.008;
  });
  room.add(shelf);
  room.userData.shelfSpots = [new THREE.Vector3(1.75, 1.575, BACK + 0.13), new THREE.Vector3(1.3, 2.195, BACK + 0.13), new THREE.Vector3(1.8, 2.195, BACK + 0.13)];

  // A framed child's drawing
  const pic = new THREE.Group();
  pic.position.set(0.15, 2.45, BACK + 0.02);
  pic.rotation.z = 0.03;
  const pframe = new THREE.Mesh(new RoundedBoxGeometry(0.7, 0.56, 0.03, 2, 0.01), new THREE.MeshStandardMaterial({ color: 0x9ad3c8, roughness: 0.5 }));
  const pimg = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.47), new THREE.MeshStandardMaterial({ map: pictureTexture(), roughness: 0.85 }));
  pimg.position.z = 0.016;
  pic.add(pframe, pimg);
  room.add(pic);

  // Bunting garland across the wall
  const flagCols = [0xf29bc0, 0xf6c85f, 0x9cc7f0, 0xa8e0b8, 0xc7a2ff];
  const flagGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-0.09, 0, 0), new THREE.Vector3(0.09, 0, 0), new THREE.Vector3(0, -0.2, 0)]);
  flagGeo.computeVertexNormals();
  const N = 15;
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1), x = -2.6 + t * 5.2, y = 3.05 - Math.sin(t * Math.PI) * 0.35;
    const f = new THREE.Mesh(flagGeo, new THREE.MeshStandardMaterial({ color: flagCols[i % flagCols.length], roughness: 0.8, side: THREE.DoubleSide }));
    f.position.set(x, y, BACK + 0.06);
    f.rotation.z = Math.cos(t * Math.PI) * 0.3;
    f.castShadow = true;
    room.add(f);
  }

  // Fluffy round rug under the box
  const rug = new THREE.Mesh(new THREE.CircleGeometry(1.75, 96), new THREE.MeshPhysicalMaterial({
    map: rugTexture(), roughness: 1, sheen: 1, sheenColor: 0xffffff, sheenRoughness: 0.8,
  }));
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(0, 0.006, -0.25);
  rug.receiveShadow = true;
  room.add(rug);

  // Spots for real furniture models (filled in by main.js once they load)
  room.userData.props = [
    { id: 'kytka', pos: new THREE.Vector3(-2.4, 0, BACK + 0.45), size: 1.0, rot: 0.4 },
    { id: 'taburet', pos: new THREE.Vector3(2.15, 0, -1.2), size: 0.75, rot: 0.3 },
    { id: 'micek', pos: new THREE.Vector3(-1.75, 0, 0.6), size: 0.4, rot: 0 },
    { id: 'auticko', pos: new THREE.Vector3(1.55, 1.575, BACK + 0.13), size: 0.38, rot: -0.4 },
    { id: 'duhova', pos: new THREE.Vector3(1.75, 2.195, BACK + 0.13), size: 0.42, rot: 0 },
  ];
  return room;
}
