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
  const W = 1.5, H = 0.85, D = 0.9;

  const wood = new THREE.MeshPhysicalMaterial({
    map: tex.wood, roughnessMap: tex.woodRough, bumpMap: tex.woodBump, bumpScale: 1.2,
    color: 0x5e4030, roughness: 0.55, clearcoat: 0.7, clearcoatRoughness: 0.18,
  });
  const brass = new THREE.MeshPhysicalMaterial({ color: 0xd9a84e, metalness: 1, roughness: 0.28, clearcoat: 0.3 });
  const darkBrass = new THREE.MeshPhysicalMaterial({ color: 0x8a6a33, metalness: 1, roughness: 0.4 });

  const body = new THREE.Mesh(new RoundedBoxGeometry(W, H, D, 6, 0.05), wood);
  body.position.y = H / 2 + 0.06;
  body.castShadow = body.receiveShadow = true;
  box.add(body);

  // Lid, a little thicker, with a brass band.
  const lid = new THREE.Mesh(new RoundedBoxGeometry(W + 0.06, 0.16, D + 0.06, 6, 0.05), wood);
  lid.position.y = H + 0.06 + 0.08;
  lid.castShadow = lid.receiveShadow = true;
  box.add(lid);
  const band = new THREE.Mesh(new THREE.BoxGeometry(W + 0.075, 0.035, D + 0.075), brass);
  band.position.y = H + 0.06 + 0.01;
  band.castShadow = true;
  box.add(band);

  // Feet
  for (const x of [-1, 1]) for (const z of [-1, 1]) {
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.07, 32, 16), brass);
    f.scale.y = 0.85;
    f.position.set(x * (W / 2 - 0.08), 0.055, z * (D / 2 - 0.08));
    f.castShadow = true;
    box.add(f);
  }

  // Brass corner caps
  const cap = new THREE.SphereGeometry(0.06, 24, 16);
  for (const x of [-1, 1]) for (const y of [0, 1]) for (const z of [-1, 1]) {
    const c = new THREE.Mesh(cap, brass);
    c.position.set(x * (W / 2 + 0.01), 0.08 + y * (H + 0.08), z * (D / 2 + 0.01));
    c.castShadow = true;
    box.add(c);
  }

  // Glowing stars on the front and sides
  const starMat = new THREE.MeshStandardMaterial({ color: 0x2a1840, emissive: 0xb07cff, emissiveIntensity: 0.25, roughness: 0.3, metalness: 0.2 });
  const starGeo = new THREE.ExtrudeGeometry(starShape(0.07, 0.03), { depth: 0.012, bevelEnabled: true, bevelSize: 0.006, bevelThickness: 0.006, bevelSegments: 2 });
  const stars = [];
  const spots = [[-0.55, 0.72], [0.55, 0.72], [-0.6, 0.25], [0.6, 0.25], [-0.32, 0.82], [0.32, 0.82]];
  for (const [x, y] of spots) {
    const s = new THREE.Mesh(starGeo, starMat);
    s.position.set(x, y, D / 2 + 0.002);
    s.scale.setScalar(0.6 + Math.abs(x) * 0.5);
    s.rotation.z = x * 0.6;
    box.add(s);
    stars.push(s);
  }
  for (const side of [-1, 1]) {
    const s = new THREE.Mesh(starGeo, starMat);
    s.position.set(side * (W / 2 + 0.002), 0.5, 0);
    s.rotation.y = side * Math.PI / 2;
    s.scale.setScalar(1.4);
    box.add(s);
  }

  // Lens housing on the front: brass ring, dark tube, crystal.
  const lensGroup = new THREE.Group();
  lensGroup.position.set(0, 0.48, D / 2);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.035, 24, 64), brass);
  ring.position.z = 0.06;
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.12, 48, 1, true), darkBrass);
  tube.rotation.x = Math.PI / 2;
  tube.position.z = 0.04;
  const crystalMat = new THREE.MeshPhysicalMaterial({
    color: 0xe6c8ff, emissive: 0xc070ff, emissiveIntensity: 0.4, roughness: 0.05, transmission: 0.6, thickness: 0.2, ior: 1.6, clearcoat: 1,
  });
  const crystal = new THREE.Mesh(new THREE.SphereGeometry(0.15, 48, 32), crystalMat);
  crystal.scale.z = 0.45;
  crystal.position.z = 0.06;
  for (const m of [ring, tube, crystal]) m.castShadow = true;
  // Screws around the ring
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const sc = new THREE.Mesh(new THREE.SphereGeometry(0.014, 12, 8), darkBrass);
    sc.position.set(Math.cos(a) * 0.17, Math.sin(a) * 0.17, 0.095);
    lensGroup.add(sc);
  }
  lensGroup.add(ring, tube, crystal);
  box.add(lensGroup);

  // Lens light for the charge-up
  const lensLight = new THREE.PointLight(0xc070ff, 0, 2.5, 2);
  lensLight.position.set(0, 0.48, D / 2 + 0.3);
  box.add(lensLight);

  // Keyhole on the lid band (pure decoration)
  const key = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.02, 24), darkBrass);
  key.rotation.x = Math.PI / 2;
  key.position.set(0, H + 0.06 + 0.01, D / 2 + 0.045);
  box.add(key);

  box.userData = {
    lensLocal: new THREE.Vector3(0, 0.48, D / 2 + 0.08),
    setCharge(k) {
      // k: 0 calm, 1 full power
      crystalMat.emissiveIntensity = 0.4 + k * 5;
      starMat.emissiveIntensity = 0.25 + k * 4;
      lensLight.intensity = k * 6;
    },
    lid,
  };
  return box;
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
