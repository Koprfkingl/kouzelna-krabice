// Small helpers shared by all modules: DOM lookup, URL switches, saved data, tweens.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const FREEZE = params.has('nahledy');
const SLOW = Number(params.get('pomalu')) || 1; // for testing on slow machines
const CARTOON = !params.has('realisticky');        // ?realisticky shows the old realistic look

const low1 = t => t[0].toLowerCase() + t.slice(1);

// ---------- Small animation helpers ----------
const tweens = [];
function animate(duration, fn) {
  return new Promise(res => {
    const start = performance.now();
    tweens.push(now => {
      const k = Math.min(1, (now - start) / (duration * 1000 * SLOW));
      fn(k);
      if (k >= 1) { res(); return false; }
      return true;
    });
  });
}
const ease = { out: k => 1 - Math.pow(1 - k, 3), inOut: k => k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2,
  elastic: k => k === 0 || k === 1 ? k : Math.pow(2, -10 * k) * Math.sin((k * 10 - 0.75) * (2 * Math.PI) / 3) + 1 };
const wait = s => new Promise(r => setTimeout(r, s * 1000 * SLOW));

function disposeObj(o) {
  o.traverse(c => {
    if (c.isMesh) for (const m of Array.isArray(c.material) ? c.material : [c.material]) m.dispose();
  });
}
function centerOf(obj) {
  const bb = new THREE.Box3().setFromObject(obj, false);
  if (bb.isEmpty()) return { c: obj.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.3, 0)), s: new THREE.Vector3(0.6, 0.6, 0.6) };
  return { c: bb.getCenter(new THREE.Vector3()), s: bb.getSize(new THREE.Vector3()) };
}

// ---------- Saved data ----------
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
};
const pickOne = a => a[Math.floor(Math.random() * a.length)];
// Merges geometries of different kinds (indexed or not) into one, keeping position, normal and uv.
function mergeAll(geos) {
  return mergeGeometries(geos.map(g => {
    const n = g.index ? g.toNonIndexed() : g;
    for (const k of Object.keys(n.attributes)) if (!['position', 'normal', 'uv'].includes(k)) n.deleteAttribute(k);
    n.clearGroups();
    return n;
  }));
}

export { $, CARTOON, FREEZE, animate, centerOf, disposeObj, ease, low1, mergeAll, params, pickOne, store, tweens, wait };
