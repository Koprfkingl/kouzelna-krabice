// The player: their name (for greetings) and whether texts talk to a girl or a boy.
const KEY = 'kk-hrac';
const DEFAULT = { jmeno: 'Maruška', kluk: false };

export let hrac = (() => { try { return { ...DEFAULT, ...JSON.parse(localStorage.getItem(KEY)) }; } catch { return { ...DEFAULT }; } })();
export const known = () => { try { return !!localStorage.getItem(KEY); } catch { return true; } };
export function setHrac(h) {
  hrac = { jmeno: (h.jmeno || '').trim() || DEFAULT.jmeno, kluk: !!h.kluk };
  try { localStorage.setItem(KEY, JSON.stringify(hrac)); } catch {}
}

// Czech vocative (5th case) for the greeting: Maruško, Petře, Tomáši, Jakube, Lucie…
export function vokativ(jmeno) {
  const n = jmeno.trim();
  if (!n) return n;
  const low = n.toLowerCase();
  const keep = s => n.slice(0, n.length - s);
  const IRR = { 'petr': 'Petře', 'pavel': 'Pavle', 'karel': 'Karle', 'marek': 'Marku', 'kuba': 'Kubo', 'mikuláš': 'Mikuláši', 'jiří': 'Jiří', 'sára': 'Sáro' };
  if (IRR[low]) return IRR[low];
  if (/a$/.test(low)) return keep(1) + 'o';
  if (/[eiyíéoů]$/.test(low)) return n;
  if (/ek$/.test(low)) return keep(2) + 'ku';
  if (/[šžčřjcť]$/.test(low)) return n + 'i';
  if (/(k|h|g|ch)$/.test(low)) return n + 'u';
  if (/[bcdfghjklmnpqrstvwxz]r$/.test(low)) return keep(1) + 'ře';
  return n + 'e';
}

// a(holka, kluk) picks the right ending: `vyfotil${a('a', '')}`
export const a = (holka, kluk) => (hrac.kluk ? kluk : holka);
