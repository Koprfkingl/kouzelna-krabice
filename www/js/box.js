// The magic box: walnut wood, brass corners, glowing star inlays and a crystal laser lens on the front.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

function starShape(r1, r2, n = 5) {
  const s = new THREE.Shape();
  for (let i = 0; i <= n * 2; i++) {
    const a = (i / (n * 2)) * Math.PI * 2 + Math.PI / 2;
    const r = i % 2 ? r2 : r1;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    i ? s.lineTo(x, y) : s.moveTo(x, y);
  }
  return s;
}

export function makeBox(tex) {
  const box = new THREE.Group();
  const W = 1.6, H = 0.72, D = 1.05, T = 0.06, B = 0.06; // width, wall height, depth, wall thickness, feet height
  const TOP = B + H;

  const wood = new THREE.MeshPhysicalMaterial({
    map: tex.wood, roughnessMap: tex.woodRough, bumpMap: tex.woodBump, bumpScale: 1.2,
    color: 0x5e4030, roughness: 0.55, clearcoat: 0.7, clearcoatRoughness: 0.18,
  });
  const brass = new THREE.MeshPhysicalMaterial({ color: 0xd9a84e, metalness: 1, roughness: 0.28, clearcoat: 0.3 });
  const darkBrass = new THREE.MeshPhysicalMaterial({ color: 0x8a6a33, metalness: 1, roughness: 0.4 });
  const velvet = new THREE.MeshPhysicalMaterial({ color: 0x3a1858, roughness: 0.9, sheen: 1, sheenColor: 0xb07cff, sheenRoughness: 0.45 });
  const add = (m, x, y, z, parent = box) => { m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent.add(m); return m; };

  // Hollow body: floor and four walls, lined with velvet inside.
  // Walls stop 12 mm under the rim top so the brass rim fully covers their upper edge.
  const WH = H - 0.012;
  add(new THREE.Mesh(new RoundedBoxGeometry(W, WH, T, 4, 0.025), wood), 0, B + WH / 2, D / 2 - T / 2);
  add(new THREE.Mesh(new RoundedBoxGeometry(W, WH, T, 4, 0.025), wood), 0, B + WH / 2, -D / 2 + T / 2);
  for (const s of [-1, 1]) add(new THREE.Mesh(new RoundedBoxGeometry(T, WH, D - 0.02, 4, 0.025), wood), s * (W / 2 - T / 2), B + WH / 2, 0);
  add(new THREE.Mesh(new THREE.BoxGeometry(W - 0.02, T, D - 0.02), wood), 0, B + T / 2, 0);
  const IW = W - 2 * T, ID = D - 2 * T, IH = H - T - 0.012;
  add(new THREE.Mesh(new THREE.BoxGeometry(IW, 0.02, ID), velvet), 0, B + T + 0.01, 0);
  for (const s of [-1, 1]) {
    const fb = add(new THREE.Mesh(new THREE.PlaneGeometry(IW, IH), velvet), 0, B + T + IH / 2, s * (ID / 2 - 0.002));
    fb.rotation.y = s > 0 ? Math.PI : 0;
    const lr = add(new THREE.Mesh(new THREE.PlaneGeometry(ID, IH), velvet), s * (IW / 2 - 0.002), B + T + IH / 2, 0);
    lr.rotation.y = -s * Math.PI / 2;
  }
  // Brass rim around the opening
  for (const s of [-1, 1]) {
    // Sits a few mm above the wood (coplanar faces flickered) and the side bars stop where the
    // front/back bars begin, so no two brass faces share a plane at the corners either.
    add(new THREE.Mesh(new THREE.BoxGeometry(W + 0.02, 0.034, T + 0.02), brass), 0, TOP - 0.012, s * (D / 2 - T / 2));
    add(new THREE.Mesh(new THREE.BoxGeometry(T + 0.02, 0.032, D - 2 * T - 0.02), brass), s * (W / 2 - T / 2), TOP - 0.013, 0);
  }
  // A thin glowing seam between body and lid: dark when calm, laser-bright while zapping.
  const seamMat = new THREE.MeshBasicMaterial({ color: 0xff60e0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  for (const s of [-1, 1]) {
    const a = new THREE.Mesh(new THREE.BoxGeometry(W + 0.05, 0.02, 0.02), seamMat); a.position.set(0, TOP + 0.005, s * (D / 2 + 0.015)); box.add(a);
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, D + 0.05), seamMat); b.position.set(s * (W / 2 + 0.015), TOP + 0.005, 0); box.add(b);
  }

  // Feet
  for (const x of [-1, 1]) for (const z of [-1, 1]) {
    const f = add(new THREE.Mesh(new THREE.SphereGeometry(0.07, 32, 16), brass), x * (W / 2 - 0.09), 0.055, z * (D / 2 - 0.09));
    f.scale.y = 0.85;
  }
  // Brass corner caps at the bottom corners
  const cap = new THREE.SphereGeometry(0.055, 24, 16);
  for (const x of [-1, 1]) for (const z of [-1, 1]) add(new THREE.Mesh(cap, brass), x * (W / 2 + 0.005), B + 0.03, z * (D / 2 + 0.005));

  // Lid on a hinge at the back edge
  const lidPivot = new THREE.Group();
  lidPivot.position.set(0, TOP, -D / 2);
  box.add(lidPivot);
  const LT = 0.13;
  add(new THREE.Mesh(new RoundedBoxGeometry(W + 0.05, LT, D + 0.05, 5, 0.045), wood), 0, LT / 2 + 0.008, D / 2, lidPivot);
  add(new THREE.Mesh(new THREE.BoxGeometry(W + 0.065, 0.03, D + 0.065), brass), 0, 0.022, D / 2, lidPivot);
  const under = add(new THREE.Mesh(new THREE.PlaneGeometry(IW, ID), velvet), 0, 0.006, D / 2, lidPivot);
  under.rotation.x = Math.PI / 2;
  for (const x of [-1, 1]) for (const z of [0, 1]) add(new THREE.Mesh(cap, brass), x * (W / 2 + 0.01), LT + 0.005, z * D + (z ? 0.01 : -0.01), lidPivot);
  // Hinges
  for (const x of [-0.5, 0.5]) {
    const h = add(new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.16, 16), darkBrass), x, 0.0, -0.01, lidPivot);
    h.rotation.z = Math.PI / 2;
  }
  // Keyhole plate at the front of the lid
  const plate = add(new THREE.Mesh(new RoundedBoxGeometry(0.16, 0.1, 0.02, 2, 0.008), brass), 0, 0.03, D + 0.035, lidPivot);
  const keyMat = new THREE.MeshBasicMaterial({ color: 0x120818 });
  const kh = new THREE.Mesh(new THREE.CircleGeometry(0.014, 16), keyMat); kh.position.set(0, 0.008, 0.011); plate.add(kh);

  // Glowing stars on the lid and the front
  const starMat = new THREE.MeshStandardMaterial({ color: 0x2a1840, emissive: 0xb07cff, emissiveIntensity: 0.25, roughness: 0.3, metalness: 0.2 });
  const starGeo = new THREE.ExtrudeGeometry(starShape(0.07, 0.03), { depth: 0.012, bevelEnabled: true, bevelSize: 0.006, bevelThickness: 0.006, bevelSegments: 2 });
  for (const [x, z, sc] of [[-0.5, 0.3, 1.1], [0.5, 0.3, 1.1], [0, 0.55, 1.6], [-0.25, 0.8, 0.8], [0.25, 0.8, 0.8], [-0.6, 0.78, 0.7], [0.6, 0.78, 0.7]]) {
    const st = new THREE.Mesh(starGeo, starMat);
    st.position.set(x, LT + 0.01, z);
    st.rotation.x = -Math.PI / 2;
    st.rotation.z = x;
    st.scale.setScalar(sc);
    lidPivot.add(st);
  }
  for (const [x, y] of [[-0.6, 0.62], [0.6, 0.62], [-0.62, 0.22], [0.62, 0.22], [-0.36, 0.68], [0.36, 0.68]]) {
    const st = new THREE.Mesh(starGeo, starMat);
    st.position.set(x, y, D / 2 + 0.002);
    st.scale.setScalar(0.6 + Math.abs(x) * 0.5);
    st.rotation.z = x * 0.6;
    box.add(st);
  }

  // Lens housing on the front: brass ring, dark tube, crystal.
  const LY = B + H * 0.52;
  const lensGroup = new THREE.Group();
  lensGroup.position.set(0, LY, D / 2);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.032, 24, 64), brass);
  ring.position.z = 0.05;
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.1, 48, 1, true), darkBrass);
  tube.rotation.x = Math.PI / 2;
  tube.position.z = 0.035;
  const crystalMat = new THREE.MeshPhysicalMaterial({ color: 0xe6c8ff, emissive: 0xc070ff, emissiveIntensity: 0.4, roughness: 0.05, clearcoat: 1 });
  const crystal = new THREE.Mesh(new THREE.SphereGeometry(0.13, 48, 32), crystalMat);
  crystal.scale.z = 0.45;
  crystal.position.z = 0.05;
  for (const m of [ring, tube, crystal]) m.castShadow = true;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const sc = new THREE.Mesh(new THREE.SphereGeometry(0.013, 12, 8), darkBrass);
    sc.position.set(Math.cos(a) * 0.15, Math.sin(a) * 0.15, 0.083);
    lensGroup.add(sc);
  }
  lensGroup.add(ring, tube, crystal);
  box.add(lensGroup);

  const glowTex = radialTexture('rgba(255,230,255,1)', 'rgba(230,120,255,0.55)', 'rgba(160,60,255,0)');
  const glowMat = new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.3 });
  const glow = new THREE.Sprite(glowMat);
  glow.position.set(0, LY, D / 2 + 0.11);
  glow.scale.setScalar(0.5);
  box.add(glow);

  const lensLight = new THREE.PointLight(0xc070ff, 0, 2.5, 2);
  lensLight.position.set(0, LY, D / 2 + 0.3);
  box.add(lensLight);

  // Light and mist inside
  const innerLight = new THREE.PointLight(0xffd0ff, 0, 2.2, 1.5);
  innerLight.position.set(0, TOP + 0.1, 0.1);
  box.add(innerLight);
  const inside = new THREE.Group();
  inside.position.set(0, B + T + 0.02, 0.02);
  box.add(inside);

  const cloudTex = radialTexture('rgba(255,250,255,0.9)', 'rgba(235,215,255,0.45)', 'rgba(220,200,255,0)');
  const mist = new THREE.Group();
  const puffs = [];
  for (let i = 0; i < 14; i++) {
    const m = new THREE.SpriteMaterial({ map: cloudTex, transparent: true, depthWrite: false, opacity: 0 });
    const sp = new THREE.Sprite(m);
    sp.userData = { x: (Math.random() - 0.5) * IW * 0.9, z: (Math.random() - 0.5) * ID * 0.8, y: Math.random(), sp: 0.04 + Math.random() * 0.06, ph: Math.random() * 6, sc: 0.45 + Math.random() * 0.45 };
    mist.add(sp); puffs.push(sp);
  }
  box.add(mist);

  // Laser light leaking through the seam while the lid is shut
  const beamGeo = new THREE.CylinderGeometry(0.008, 0.008, 1, 8, 1, true);
  beamGeo.translate(0, 0.5, 0);
  const beams = [];
  for (let i = 0; i < 10; i++) {
    const m = new THREE.MeshBasicMaterial({ color: i % 2 ? 0xff70e8 : 0xb890ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    const b = new THREE.Mesh(beamGeo, m);
    b.visible = false;
    b.userData = { life: 0 };
    box.add(b);
    beams.push(b);
  }
  const up = new THREE.Vector3(0, 1, 0);

  let mistLevel = 0;
  box.userData = {
    top: TOP,
    inside,
    insideFit: 0.62,
    lid: lidPivot,
    lensLocal: new THREE.Vector3(0, LY, D / 2 + 0.08),
    setCharge(k) {
      crystalMat.emissiveIntensity = 0.4 + k * 5;
      starMat.emissiveIntensity = 0.25 + k * 4;
      lensLight.intensity = k * 6;
      glowMat.opacity = 0.3 + k * 0.7;
      glow.scale.setScalar(0.5 + k * 0.8);
    },
    setLid(k) { lidPivot.rotation.x = -1.95 * k; },   // 0 shut, 1 wide open
    setSeam(k) { seamMat.opacity = k; },
    setInnerLight(k) { innerLight.intensity = k * 2.2; },
    setMist(k) { mistLevel = k; },
    update(t, dt, zapping) {
      for (const p of puffs) {
        const u = p.userData;
        u.y = (u.y + dt * u.sp) % 1;
        p.position.set(u.x + Math.sin(t * 0.7 + u.ph) * 0.05, B + T + 0.05 + u.y * 0.75, u.z + Math.cos(t * 0.6 + u.ph) * 0.05);
        const fade = Math.sin(u.y * Math.PI);
        p.material.opacity = mistLevel * 0.28 * fade;
        p.scale.setScalar(u.sc * (0.7 + u.y * 0.6));
        p.visible = mistLevel > 0.01;
      }
      for (const b of beams) {
        if (b.userData.life > 0) {
          b.userData.life -= dt;
          b.material.opacity = Math.max(0, b.userData.life * 6);
          if (b.userData.life <= 0) b.visible = false;
        } else if (zapping && Math.random() < dt * 9) {
          // start at a random point of the seam and shoot outwards and up
          const side = Math.floor(Math.random() * 4);
          const r = Math.random() - 0.5;
          const p = side < 2 ? new THREE.Vector3(r * W, TOP, (side ? 1 : -1) * (D / 2 + 0.02)) : new THREE.Vector3((side === 2 ? 1 : -1) * (W / 2 + 0.02), TOP, r * D);
          const out = new THREE.Vector3(p.x, 0, p.z).normalize().multiplyScalar(0.8).add(new THREE.Vector3((Math.random() - 0.5) * 0.6, 0.4 + Math.random() * 0.9, (Math.random() - 0.5) * 0.6)).normalize();
          b.position.copy(p);
          b.quaternion.setFromUnitVectors(up, out);
          b.scale.set(1 + Math.random(), 1.2 + Math.random() * 1.8, 1 + Math.random());
          b.userData.life = 0.12 + Math.random() * 0.22;
          b.visible = true;
        }
      }
    },
  };
  return box;
}

function radialTexture(c0, c1, c2) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, c0); gr.addColorStop(0.3, c1); gr.addColorStop(1, c2);
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

// The laser beam: a glowing core with a wider soft halo, both additive.
export function makeLaser() {
  const mk = (radius, color, opacity) => new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, 1, 24, 1, true),
    new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(color) }, uOpacity: { value: opacity } },
      vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vView;
        void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix*normal); vView = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
      fragmentShader: `uniform float uTime; uniform vec3 uColor; uniform float uOpacity; varying vec2 vUv; varying vec3 vN; varying vec3 vView;
        void main(){ float rim = pow(abs(dot(vN, vView)), 1.5);
          float flick = 0.75 + 0.25*sin(vUv.y*80.0 - uTime*60.0) * sin(vUv.y*23.0 + uTime*31.0);
          gl_FragColor = vec4(uColor * rim * flick * uOpacity, 1.0); }`,
    })
  );
  const g = new THREE.Group();
  const core = mk(0.012, 0xffffff, 3.0);
  const glow = mk(0.05, 0xff40c8, 1.6);
  const halo = mk(0.12, 0x9a40ff, 0.6);
  g.add(core, glow, halo);
  g.visible = false;
  const up = new THREE.Vector3(0, 1, 0);
  g.userData = {
    aim(from, to, t, width = 1) {
      const d = to.clone().sub(from);
      const len = d.length();
      g.position.copy(from).addScaledVector(d, 0.5);
      g.quaternion.setFromUnitVectors(up, d.normalize());
      for (const m of [core, glow, halo]) {
        m.scale.set(width, len, width);
        m.material.uniforms.uTime.value = t;
      }
    },
  };
  return g;
}

// Sparkles: a pool of additive points that fly from where the laser hits.
export function makeSparkles(count = 400) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3), vel = new Float32Array(count * 3), life = new Float32Array(count), col = new Float32Array(count * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  const mat = new THREE.PointsMaterial({ size: 0.06, map: tex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  let next = 0;
  const colors = [new THREE.Color(3, 1, 2.6), new THREE.Color(1.2, 1.6, 3), new THREE.Color(3, 2.6, 1), new THREE.Color(2.5, 2.5, 2.5)];
  for (let i = 0; i < count; i++) pos[i * 3 + 1] = -100;
  pts.userData = {
    emit(at, n, speed = 1.5, spread = 0.1) {
      for (let k = 0; k < n; k++) {
        const i = next; next = (next + 1) % count;
        pos[i * 3] = at.x + (Math.random() - 0.5) * spread; pos[i * 3 + 1] = at.y + (Math.random() - 0.5) * spread; pos[i * 3 + 2] = at.z + (Math.random() - 0.5) * spread;
        const v = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.9, Math.random() - 0.5).normalize().multiplyScalar(speed * (0.3 + Math.random()));
        vel[i * 3] = v.x; vel[i * 3 + 1] = v.y; vel[i * 3 + 2] = v.z;
        life[i] = 0.6 + Math.random() * 0.9;
        const cc = colors[Math.floor(Math.random() * colors.length)];
        col[i * 3] = cc.r; col[i * 3 + 1] = cc.g; col[i * 3 + 2] = cc.b;
      }
    },
    update(dt) {
      for (let i = 0; i < count; i++) {
        if (life[i] <= 0) continue;
        life[i] -= dt;
        vel[i * 3 + 1] -= 1.6 * dt;
        pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
        if (pos[i * 3 + 1] < 0.02) { pos[i * 3 + 1] = 0.02; vel[i * 3 + 1] *= -0.4; }
        const f = Math.max(0, Math.min(1, life[i] * 1.5));
        col[i * 3] *= 0.985; col[i * 3 + 1] *= 0.985; col[i * 3 + 2] *= 0.985;
        if (life[i] <= 0) pos[i * 3 + 1] = -100;
        else if (f < 0.05) pos[i * 3 + 1] = -100;
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
    },
  };
  return pts;
}
