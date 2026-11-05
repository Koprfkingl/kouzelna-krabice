// All sounds are synthesized on the fly, so the game needs no sound files.
let ctx = null, master = null;
export let muted = false;

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain();
  master.gain.value = 0.7;
  master.connect(ctx.destination);
}
export function setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : 0.7; }

function tone({ type = 'sine', f0 = 440, f1 = f0, t = 0.2, v = 0.3, at = 0, attack = 0.01, curve = 'exp' }) {
  if (!ctx) return;
  const now = ctx.currentTime + at;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, now);
  if (curve === 'exp') o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), now + t);
  else o.frequency.linearRampToValueAtTime(f1, now + t);
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(v, now + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, now + t);
  o.connect(g); g.connect(master);
  o.start(now); o.stop(now + t + 0.05);
}

function noise({ t = 0.3, v = 0.2, at = 0, freq = 2000, q = 1, type = 'bandpass', f1 }) {
  if (!ctx) return;
  const now = ctx.currentTime + at;
  const len = Math.ceil(ctx.sampleRate * t);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource(); src.buffer = buf;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, now); f.Q.value = q;
  if (f1) f.frequency.exponentialRampToValueAtTime(f1, now + t);
  const g = ctx.createGain();
  g.gain.setValueAtTime(v, now); g.gain.exponentialRampToValueAtTime(0.0001, now + t);
  src.connect(f); f.connect(g); g.connect(master);
  src.start(now);
}

export const sfx = {
  tap() { tone({ type: 'triangle', f0: 880, f1: 1320, t: 0.08, v: 0.15 }); },
  place() { tone({ type: 'sine', f0: 300, f1: 600, t: 0.18, v: 0.25 }); noise({ t: 0.12, v: 0.08, freq: 3000 }); },
  charge(d = 1.1) {
    tone({ type: 'sawtooth', f0: 80, f1: 900, t: d, v: 0.12, attack: 0.3 });
    tone({ type: 'sine', f0: 160, f1: 1800, t: d, v: 0.12, attack: 0.3 });
  },
  laser(d = 1.6) {
    for (let i = 0; i < 6; i++) tone({ type: 'square', f0: 1400 + i * 90, f1: 500, t: 0.25, v: 0.05, at: i * (d / 6) });
    tone({ type: 'sawtooth', f0: 220, f1: 240, t: d, v: 0.08, attack: 0.05, curve: 'lin' });
    noise({ t: d, v: 0.07, freq: 5000, q: 0.8 });
  },
  poof() {
    noise({ t: 0.5, v: 0.4, freq: 800, f1: 6000, q: 0.6 });
    [523, 659, 784, 1047, 1319].forEach((f, i) => tone({ type: 'triangle', f0: f, t: 0.35, v: 0.18, at: 0.05 + i * 0.07 }));
  },
  giggle() {
    for (let i = 0; i < 5; i++) tone({ type: 'sine', f0: 700 + Math.random() * 300, f1: 1100 + Math.random() * 400, t: 0.09, v: 0.22, at: i * 0.11 });
  },
  boing() { tone({ type: 'sine', f0: 180, f1: 520, t: 0.3, v: 0.3, curve: 'lin' }); },
  radio() {
    const notes = [523, 587, 659, 784, 659, 784, 1047];
    notes.forEach((f, i) => { tone({ type: 'square', f0: f, t: 0.16, v: 0.06, at: i * 0.17 }); tone({ type: 'sine', f0: f / 2, t: 0.16, v: 0.12, at: i * 0.17 }); });
  },
  fotak() { noise({ t: 0.06, v: 0.4, freq: 4000 }); noise({ t: 0.1, v: 0.3, freq: 2500, at: 0.08 }); tone({ type: 'sine', f0: 2000, f1: 4000, t: 0.4, v: 0.05, at: 0.1 }); },
  auto() { tone({ type: 'sawtooth', f0: 60, f1: 140, t: 0.7, v: 0.15, curve: 'lin' }); tone({ type: 'square', f0: 62, f1: 145, t: 0.7, v: 0.05, curve: 'lin' }); tone({ type: 'square', f0: 660, t: 0.12, v: 0.08, at: 0.75 }); tone({ type: 'square', f0: 660, t: 0.12, v: 0.08, at: 0.92 }); },
  lednice() { tone({ type: 'sawtooth', f0: 100, f1: 100, t: 1.0, v: 0.06, attack: 0.2, curve: 'lin' }); noise({ t: 0.3, v: 0.1, freq: 300, at: 0.9 }); },
  lampa() { noise({ t: 0.04, v: 0.3, freq: 3000 }); tone({ type: 'sine', f0: 3000, t: 0.05, v: 0.08 }); },
  liska() { tone({ type: 'sawtooth', f0: 900, f1: 500, t: 0.25, v: 0.12 }); tone({ type: 'sawtooth', f0: 1000, f1: 600, t: 0.2, v: 0.1, at: 0.3 }); },
  ryba() { for (let i = 0; i < 4; i++) tone({ type: 'sine', f0: 300 + i * 120, f1: 900 + i * 150, t: 0.08, v: 0.2, at: i * 0.12 }); },
  shutter() { this.fotak(); },
  kun() { [0, 0.12, 0.24, 0.36].forEach((t, i) => noise({ t: 0.06, v: 0.35, freq: 900 - i * 80, at: t })); tone({ type: 'sawtooth', f0: 700, f1: 300, t: 0.5, v: 0.08, at: 0.5 }); },
  ptak() { for (let i = 0; i < 6; i++) tone({ type: 'sine', f0: 2400 + Math.random() * 800, f1: 3400, t: 0.07, v: 0.12, at: i * 0.09 }); },
  robot() { [440, 660, 550, 880].forEach((f, i) => tone({ type: 'square', f0: f, t: 0.1, v: 0.07, at: i * 0.11 })); },
  lid() { noise({ t: 0.25, v: 0.15, freq: 400, q: 2 }); tone({ type: 'sine', f0: 180, f1: 120, t: 0.25, v: 0.15 }); },
  thump() { tone({ type: 'sine', f0: 120, f1: 50, t: 0.25, v: 0.45 }); noise({ t: 0.1, v: 0.2, freq: 300 }); },
  whoosh() { noise({ t: 0.5, v: 0.25, freq: 600, f1: 2500, q: 1.5 }); },
  hmm() { tone({ type: 'triangle', f0: 260, f1: 200, t: 0.5, v: 0.2, attack: 0.08 }); tone({ type: 'triangle', f0: 200, f1: 330, t: 0.45, v: 0.2, at: 0.55, attack: 0.08 }); },
  dizzy() { for (let i = 0; i < 8; i++) tone({ type: 'sine', f0: 900 - i * 60, f1: 600 - i * 40, t: 0.18, v: 0.12, at: i * 0.16 }); },
  prrr() { tone({ type: 'sawtooth', f0: 90, f1: 60, t: 0.8, v: 0.18, curve: 'lin' }); noise({ t: 0.8, v: 0.12, freq: 350, q: 3 }); },
  puff() { tone({ type: 'sine', f0: 120, f1: 380, t: 1.1, v: 0.15, attack: 0.2, curve: 'lin' }); },
  faint() { tone({ type: 'sine', f0: 700, f1: 120, t: 0.7, v: 0.2, curve: 'lin' }); tone({ type: 'sine', f0: 110, f1: 50, t: 0.25, v: 0.4, at: 0.65 }); },
  sneeze() { [300, 380, 470].forEach((f, i) => tone({ type: 'triangle', f0: f, f1: f * 1.15, t: 0.3, v: 0.15, at: i * 0.32 })); noise({ t: 0.35, v: 0.45, freq: 2500, q: 0.7, at: 1.05 }); tone({ type: 'square', f0: 900, f1: 300, t: 0.15, v: 0.08, at: 1.05 }); },
  run() { for (let i = 0; i < 7; i++) tone({ type: 'triangle', f0: 600 + (i % 2) * 200, t: 0.06, v: 0.14, at: i * 0.08 }); },
  hide() { tone({ type: 'sine', f0: 900, f1: 200, t: 0.35, v: 0.18 }); },
  mnam() { [0, 0.22, 0.44].forEach(t => { noise({ t: 0.09, v: 0.25, freq: 1200, q: 1.5, at: t }); tone({ type: 'sine', f0: 320, f1: 220, t: 0.12, v: 0.15, at: t + 0.03 }); }); },
  glo() { for (let i = 0; i < 4; i++) tone({ type: 'sine', f0: 250 + i * 30, f1: 520 + i * 40, t: 0.13, v: 0.22, at: i * 0.22 }); },
  zzz() { tone({ type: 'sine', f0: 140, f1: 110, t: 1.2, v: 0.12, attack: 0.5, curve: 'lin' }); noise({ t: 1.0, v: 0.05, freq: 500, q: 1, at: 0.2 }); },
  love() { [660, 880, 1100].forEach((f, i) => tone({ type: 'sine', f0: f, f1: f * 1.05, t: 0.3, v: 0.14, at: i * 0.12 })); },
  bandage() { noise({ t: 0.2, v: 0.2, freq: 3000, q: 0.8 }); tone({ type: 'triangle', f0: 523, t: 0.25, v: 0.15, at: 0.25 }); tone({ type: 'triangle', f0: 784, t: 0.35, v: 0.15, at: 0.45 }); },
  zap() { tone({ type: 'square', f0: 1800 + Math.random() * 800, f1: 300, t: 0.12, v: 0.06 }); },
};

export function play(name, ...args) { if (sfx[name]) sfx[name](...args); }
