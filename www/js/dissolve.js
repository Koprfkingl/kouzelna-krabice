// Adds a laser "dissolve" to any standard three.js material: noise eats the surface away
// and the edge of the hole glows. uniforms.uDis goes 0 (whole) to 1 (gone).
import * as THREE from 'three';

const NOISE = /* glsl */`
varying vec3 vDisPos;
uniform float uDis;
uniform vec3 uDisColor;
float dHash(vec3 p){ p = fract(p*0.3183099+.1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float dNoise(vec3 x){
  vec3 i = floor(x); vec3 f = fract(x); f = f*f*(3.0-2.0*f);
  return mix(mix(mix(dHash(i+vec3(0,0,0)),dHash(i+vec3(1,0,0)),f.x),mix(dHash(i+vec3(0,1,0)),dHash(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(dHash(i+vec3(0,0,1)),dHash(i+vec3(1,0,1)),f.x),mix(dHash(i+vec3(0,1,1)),dHash(i+vec3(1,1,1)),f.x),f.y),f.z);
}
float dFbm(vec3 p){ return 0.55*dNoise(p*6.0)+0.3*dNoise(p*13.0)+0.15*dNoise(p*27.0); }
`;

export function makeDissolveUniforms() {
  return { uDis: { value: 0 }, uDisColor: { value: new THREE.Color(1.0, 0.25, 0.85) } };
}

export function addDissolve(material, uniforms) {
  const prev = material.onBeforeCompile;
  const prevKey = material.customProgramCacheKey();
  material.onBeforeCompile = (shader, renderer) => {
    if (prev) prev(shader, renderer);
    shader.uniforms.uDis = uniforms.uDis;
    shader.uniforms.uDisColor = uniforms.uDisColor;
    shader.vertexShader = 'varying vec3 vDisPos;\n' + shader.vertexShader.replace(
      '#include <project_vertex>',
      '#include <project_vertex>\n vDisPos = (modelMatrix * vec4(transformed, 1.0)).xyz;'
    );
    shader.fragmentShader = NOISE + shader.fragmentShader
      .replace('#include <clipping_planes_fragment>',
        '#include <clipping_planes_fragment>\n float dN = dFbm(vDisPos); if (uDis > 0.001 && dN < uDis * 1.08) discard;')
      .replace('#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\n if (uDis > 0.001) { float dE = 1.0 - smoothstep(uDis * 1.08, uDis * 1.08 + 0.09, dN); totalEmissiveRadiance += dE * uDisColor * 6.0; }');
  };
  material.customProgramCacheKey = () => prevKey + '|dis';
  material.needsUpdate = true;
  return material;
}

// Clones every material of an object (so each copy dissolves on its own) and hooks the dissolve in.
export function prepareDissolve(root) {
  const uniforms = makeDissolveUniforms();
  joinDissolve(root, uniforms);
  root.userData.dissolve = uniforms;
  return uniforms;
}
// Hooks a part added later (an accessory) into the dissolve of the object it belongs to.
export function joinDissolve(root, uniforms) {
  root.traverse(o => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
    const fix = m => {
      if (m.userData.noDissolve) return m;
      const c = m.clone();
      c.onBeforeCompile = m.onBeforeCompile;
      if (Object.prototype.hasOwnProperty.call(m, 'customProgramCacheKey')) c.customProgramCacheKey = m.customProgramCacheKey;
      addDissolve(c, uniforms);
      return c;
    };
    o.material = Array.isArray(o.material) ? o.material.map(fix) : fix(o.material);
  });
}
