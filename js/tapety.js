// Room makeover: wallpapers and rugs unlock with stars (like the wardrobe; stars are not spent).
import { play, initAudio } from './audio.js';
import { S } from './stav.js';
import { showBubble, speak } from './main.js';
import { $, store } from './util.js';
import { room } from './scena.js';

export const TAPETY = [
  { id: 'zakladni', nazev: 'Hvězdičky a měsíčky', hvezdy: 0 },
  { id: 'srdicka', nazev: 'Srdíčka', hvezdy: 8 },
  { id: 'oblacky', nazev: 'Obláčky', hvezdy: 16 },
  { id: 'sliz', nazev: 'Sliz', hvezdy: 25 },
  { id: 'lesik', nazev: 'Lesík', hvezdy: 40 },
  { id: 'vesmir', nazev: 'Vesmír', hvezdy: 60 },
];
export const KOBERCE = [
  { id: 'zakladni', nazev: 'Pastelový', hvezdy: 0 },
  { id: 'duha', nazev: 'Duhový', hvezdy: 12 },
  { id: 'kytka', nazev: 'Kytička', hvezdy: 20 },
  { id: 'sliz', nazev: 'Slizový', hvezdy: 30 },
  { id: 'kocka', nazev: 'Kočička', hvezdy: 50 },
];

let st = { zed: 'zakladni', koberec: 'zakladni', ...store.get('kk-tapety', {}) };
const save = () => store.set('kk-tapety', st);
const previews = {};
function preview(kind, id) {
  const k = kind + id;
  if (!previews[k]) previews[k] = (kind === 'zed' ? room.userData.wallTex(id) : room.userData.rugTex(id)).toDataURL('image/png');
  return previews[k];
}

function render() {
  for (const [kind, list, grid] of [['zed', TAPETY, 'tapety-zed'], ['koberec', KOBERCE, 'tapety-koberec']]) {
    const g = $(grid);
    g.innerHTML = '';
    for (const t of list) {
      const open = S.stars >= t.hvezdy, b = document.createElement('button');
      b.className = 'dlazdice tapeta' + (st[kind] === t.id ? ' vybrano' : '') + (open ? '' : ' zamceno');
      b.innerHTML = `<img alt="" src="${preview(kind, t.id)}"><span class="jmeno">${open ? t.nazev : `🔒 ${t.hvezdy} ⭐`}</span>`;
      b.onclick = () => pick(kind, t, open);
      g.append(b);
    }
  }
  $('tapety-stav').textContent = `Máš ${S.stars} ⭐`;
}
function pick(kind, t, open) {
  initAudio();
  if (!open) {
    play('boing');
    const t2 = `${t.nazev} se odemkne za ${t.hvezdy} hvězdiček. Teď máš ${S.stars}. Hvězdičky dostaneš za čtení!`;
    showBubble('🔒 ' + t2); speak(t2);
    return;
  }
  play('place');
  st[kind] = t.id;
  save();
  apply();
  render();
  speak(t.nazev);
}
function apply() {
  room.userData.setWall(st.zed);
  room.userData.setRug(st.koberec);
}

export function openTapety() { render(); $('tapety').hidden = false; }
export const roomLook = () => ({ ...st });
export function initTapety() { if (st.zed !== 'zakladni' || st.koberec !== 'zakladni') apply(); }
$('tapety-zavrit').addEventListener('click', () => { $('tapety').hidden = true; });
$('tapety').addEventListener('click', e => { if (e.target.id === 'tapety') $('tapety').hidden = true; });
