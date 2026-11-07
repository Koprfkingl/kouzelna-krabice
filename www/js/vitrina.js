// The cabinet of secret spells in the room: every discovered spell stands in one of its four compartments
// (fochy), undiscovered ones are a question mark. Tapping the cabinet zooms in; arrows go from compartment
// to compartment and tapping a spell puts it in front of the box.
import * as THREE from 'three';
import { S } from './stav.js';
import { room, camera } from './scena.js';
import { KOUZLA } from './kouzla.js';
import { kniha } from './kniha.js';
import { emojiSprite } from './pece.js';
import { CARTOON } from './util.js';
import { toonify } from './vzhled.js';
import { buildFor, choose, setPhase, showBubble, speak } from './main.js';

const SIZE = 0.15;          // a spell in the cabinet
let built = {};              // spell id → the object standing in the cabinet (or a question mark)
let building = null;
let foch = 0;                // which compartment the close view shows

const slotOf = i => { const v = room.userData.vitrina; return v.fochy[Math.floor(i / 4)].slots[i % 4]; };

// Puts what is missing into the cabinet (models load the first time the room opens, not at start).
function fillVitrina() {
  if (building) return building;
  building = (async () => {
    for (let i = 0; i < KOUZLA.length && i < 16; i++) {
      const k = KOUZLA[i], have = k.id in kniha, old = built[k.id];
      if (old && old.userData.known === have) continue;
      if (old) { old.removeFromParent(); built[k.id] = null; }
      let o;
      if (have) {
        try {
          const c = await buildFor({ type: 'combo', id: k.id }, { decor: true });
          c.dis.uDis.value = 0;
          o = c.holder;
          o.scale.setScalar(SIZE / c.maxDim);
          o.rotation.y = -0.3 + (i % 4) * 0.2;
          if (CARTOON) toonify(o);
        } catch (e) { continue; }
      } else {
        o = new THREE.Group();
        const q = emojiSprite('❓', 0.09);
        q.position.y = 0.07;
        o.add(q);
      }
      o.userData.known = have;
      o.userData.pokoj = { kind: 'kouzlo', id: k.id, known: have, i };
      o.position.copy(slotOf(i));
      room.add(o);
      built[k.id] = o;
    }
    building = null;
  })();
  return building;
}

function vitrinaTarget() {
  const f = room.userData.vitrina.fochy[foch];
  const look = f.center.clone();
  const half = 0.38 / Math.max(0.35, Math.min(1.6, camera.aspect));
  const d = half / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  return { pos: look.clone().add(new THREE.Vector3(0, 0.06, d)), look };
}

function openVitrina(at = 0) {
  foch = at;
  fillVitrina();
  setPhase('vitrina');
}
function moveFoch(step) {
  foch = (foch + step + 4) % 4;
  setPhase('vitrina');
}
const fochCount = () => KOUZLA.slice(foch * 4, foch * 4 + 4).filter(k => k.id in kniha).length;
const vitrinaTitle = () => `🗄️ Vitrína kouzel: polička ${foch + 1} ze 4`;
const vitrinaTip = () => fochCount() ? 'Klepni na kouzlo a postav ho před krabici.' : 'Tady ještě nic není. Dej do krabice dvě věci najednou a objev tajné kouzlo!';

// a tap on a spell in the cabinet (from pokojicek.js)
function tapKouzlo(info) {
  if (S.phase !== 'vitrina') { openVitrina(Math.floor(info.i / 4)); return; }
  const k = KOUZLA[info.i];
  if (!info.known) { const t = 'Tohle kouzlo ještě neznáš. Zkus dát do krabice dvě věci najednou!'; showBubble('❓ ' + t); speak(t); return; }
  if (S.current && S.current.where === 'box') { showBubble('Krabice je zabraná. Nejdřív z ní vyndej, co je uvnitř.'); return; }
  choose({ type: 'combo', id: k.id });
}

export { fillVitrina, moveFoch, openVitrina, tapKouzlo, vitrinaTarget, vitrinaTip, vitrinaTitle };
