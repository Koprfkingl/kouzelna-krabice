// Two things in the box: the Book of Spells.
import * as THREE from 'three';
import { byId } from './catalog.js';
import { play } from './audio.js';
import { KOUZLA } from './kouzla.js';
import { S } from './stav.js';
import { ICONS, buildFor, choose, hidePanel, renderAlbum, setPhase, showBubble, speak, tile } from './main.js';
import { $, animate, disposeObj, ease, store } from './util.js';
import { boxSlot, sparkles } from './scena.js';

let kniha = store.get('kk-kniha', {});    // discovered secret spells: id → picture
async function addSecond(src) {
  S.busy = true;
  hidePanel(true);
  try {
    const s = await buildFor(src);
    s.where = 'box';
    boxSlot.add(s.holder);
    s.holder.position.set(0.22, 0.6, 0.02);
    s.holder.scale.setScalar(s.fit * 0.72);
    S.second = s;
    const c = S.current, p0 = c.holder.position.clone(), s0 = c.holder.scale.x, to = new THREE.Vector3(-0.2, 0, 0);
    play('whoosh');
    await animate(0.8, k => {
      const e = ease.inOut(k);
      c.holder.position.lerpVectors(p0, to, e);
      c.holder.scale.setScalar(s0 + (c.fit * 0.72 - s0) * e);
      s.dis.uDis.value = 1 - e;
      s.holder.position.y = 0.6 * (1 - e);
    });
    s.dis.uDis.value = 0;
    play('place');
    sparkles.userData.emit(s.holder.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.3, 0)), 30, 1, 0.3);
  } finally { S.busy = false; }
  setPhase('inside');
}
function dropSecond() {
  if (!S.second) return;
  const s = S.second;
  S.second = null;
  play('poof');
  animate(0.4, k => { s.dis.uDis.value = k; }).then(() => { s.holder.removeFromParent(); disposeObj(s.holder); });
  if (S.current && S.current.where === 'box') { S.current.holder.position.set(0, 0, 0); S.current.holder.scale.setScalar(S.current.fit); }
}

let albumTab = 'sbirka';
$('album-zalozky').querySelectorAll('button').forEach(b => b.addEventListener('click', () => { play('tap'); albumTab = b.dataset.tab; renderAlbumTabs(); }));
function renderAlbumTabs() {
  $('album-zalozky').querySelectorAll('button').forEach(b => b.classList.toggle('aktivni', b.dataset.tab === albumTab));
  $('sbirka').hidden = albumTab !== 'sbirka';
  $('kniha').hidden = albumTab !== 'kniha';
  $('album-nadpis').firstChild.textContent = albumTab === 'kniha' ? 'Kniha kouzel ' : 'Moje příšerky ';
  $('album-stav').hidden = albumTab === 'kniha';
  if (albumTab === 'kniha') renderKniha(); else renderAlbum();
}
function renderKniha() {
  const grid = $('kniha-mrizka');
  grid.innerHTML = '';
  const found = KOUZLA.filter(k => k.id in kniha).length;
  $('kniha-napoveda').textContent = `Objeveno ${found} z ${KOUZLA.length} tajných kouzel. Dej do krabice dvě věci najednou (tlačítko ➕ Přidat druhou věc) a vystřel laser!`;
  for (const k of KOUZLA) {
    if (k.id in kniha) grid.append(tile({ label: k.name, img: kniha[k.id] || null, icon: k.icon, onClick: () => { $('album').hidden = true; choose({ type: 'combo', id: k.id }); } }));
    else grid.append(tile({ label: '???', icon: `${ICONS[k.a] || '❓'}+❓`, cls: 'tajne', onClick: () => {
      play('tap');
      const t = `Zkus dát do krabice ${byId(k.a).acc} a ještě něco.`;
      showBubble('📕 ' + t); speak(t);
    } }));
  }
}

export { addSecond, dropSecond, kniha, renderAlbumTabs };
