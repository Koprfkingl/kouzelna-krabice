// Tasks of the day: three small things (reading, magic, care or the room). All three open a chest
// with a decoration for the room. A calendar remembers the days when everything was done.
import { ITEMS } from './catalog.js';
import { OZDOBY } from './ozdoby.js';

const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* full */ } },
};
export const today = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// on: which game event counts; test: an extra check of the event's detail
const CTENI = [
  { id: 'cti5', icon: '🔤', text: 'Přečti správně 5 úkolů', goal: 5, on: 'cteni' },
  { id: 'cti8', icon: '📖', text: 'Přečti správně 8 úkolů', goal: 8, on: 'cteni' },
  { id: 'schovka', icon: '🙈', text: 'Najdi schovanou příšerku', goal: 1, on: 'schovka' },
  { id: 'schovka2', icon: '🙈', text: 'Najdi příšerku dvakrát', goal: 2, on: 'schovka' },
];
const PECE = [
  { id: 'nakrm', icon: '🍎', text: 'Nakrm příšerku', goal: 1, on: 'pece', need: 'jidlo' },
  { id: 'napoj', icon: '🥤', text: 'Dej příšerce napít', goal: 1, on: 'pece', need: 'piti' },
  { id: 'uspi', icon: '😴', text: 'Uspi příšerku', goal: 1, on: 'pece', need: 'spanek' },
  { id: 'pomazli', icon: '💗', text: 'Pomazli se s příšerkou', goal: 2, on: 'pece', need: 'mazleni' },
  { id: 'hraj', icon: '⚽', text: 'Pohraj si s příšerkou', goal: 1, on: 'pece', need: 'hra' },
];
const POKOJ = [
  { id: 'pokoj', icon: '🏠', text: 'Postav něco do pokojíčku', goal: 1, on: 'pokoj' },
];
function kouzloTasks() {
  const its = ITEMS.filter(i => !['kytka', 'lednice'].includes(i.id));
  return [
    { id: 'priserka', icon: '👾', text: 'Vyčaruj novou příšerku', goal: 1, on: 'promena', kind: 'monster' },
    { id: 'dvojice', icon: '📕', text: 'Dej do krabice dvě věci najednou', goal: 1, on: 'promena', kind: 'dvojice' },
    { id: 'kouzla3', icon: '⚡', text: 'Třikrát kouzli laserem', goal: 3, on: 'promena' },
    ...its.map(i => ({ id: 'na-' + i.id, icon: '✨', text: `Proměň něco na ${i.acc}`, goal: 1, on: 'promena', kind: 'item', item: i.id })),
  ];
}

// a fixed random choice for each day
function dayRand(seed) { let s = 0; for (const ch of seed) s = (s * 31 + ch.charCodeAt(0)) >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32); }
const pick = (a, r) => a[Math.floor(r() * a.length)];

export function loadDay(hasMonsters) {
  const d = today();
  let den = store.get('kk-den', null);
  if (!den || den.date !== d) {
    const r = dayRand(d);
    const tasks = [pick(CTENI, r), pick(kouzloTasks(), r), hasMonsters && r() < 0.8 ? pick(PECE, r) : POKOJ[0]];
    den = { date: d, tasks: tasks.map(t => ({ ...t, n: 0 })), opened: false };
    store.set('kk-den', den);
  }
  return den;
}
export const saveDay = den => store.set('kk-den', den);
export const allDone = den => den.tasks.every(t => t.n >= t.goal);

// Returns the tasks that this event has just completed.
export function progress(den, ev, detail = {}) {
  const done = [];
  for (const t of den.tasks) {
    if (t.n >= t.goal || t.on !== ev) continue;
    if (t.need && t.need !== detail.need) continue;
    if (t.kind === 'monster' && detail.type !== 'monster') continue;
    if (t.kind === 'dvojice' && !detail.dvojice) continue;
    if (t.kind === 'item' && !(detail.type === 'item' && detail.item === t.item)) continue;
    t.n++;
    if (t.n >= t.goal) done.push(t);
  }
  saveDay(den);
  return done;
}

// Calendar: days with all tasks done.
export const calendar = () => store.get('kk-kalendar', []);
export function markDay(date) { const c = calendar(); if (!c.includes(date)) { c.push(date); store.set('kk-kalendar', c.slice(-400)); } }
export function streak() {
  const c = new Set(calendar());
  let n = 0;
  const d = new Date();
  if (!c.has(today(d))) d.setDate(d.getDate() - 1); // today not finished yet: the streak still counts up to yesterday
  while (c.has(today(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
export function lastDays(n = 7) {
  const c = new Set(calendar()), out = [], d = new Date();
  d.setDate(d.getDate() - (n - 1));
  const names = ['Ne', 'Po', 'Út', 'St', 'Čt', 'Pá', 'So'];
  for (let i = 0; i < n; i++) { out.push({ name: names[d.getDay()], done: c.has(today(d)), today: i === n - 1 }); d.setDate(d.getDate() + 1); }
  return out;
}

// The chest gives the decorations in order, then repeats random ones the child does not have placed twice.
export function chestReward(owned) {
  const next = OZDOBY.find(o => !owned.includes(o.id));
  return next || OZDOBY[Math.floor(Math.random() * OZDOBY.length)];
}
