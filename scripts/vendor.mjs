// Copies the parts of three.js the game uses into www/vendor, so the app works offline.
import { cpSync, mkdirSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
const src = 'node_modules/three';
const dst = 'www/vendor/three';
rmSync(dst, { recursive: true, force: true });
mkdirSync(dst, { recursive: true });
cpSync(`${src}/build`, `${dst}/build`, { recursive: true, filter: p => !p.endsWith('.cjs') && !p.includes('webgpu') && !p.includes('tsl') });
cpSync(`${src}/examples/jsm`, `${dst}/examples/jsm`, { recursive: true, filter: p => !/\/(libs\/(ammo|draco|basis|rhino3dm|meshopt_decoder\.module\.js$)|offscreen|inspector|webxr)/.test(p) });
cpSync(`${src}/LICENSE`, `${dst}/LICENSE`);
console.log('three.js zkopírováno do', dst);

// The app's own version, so it can tell when GitHub has a newer one.
const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
writeFileSync('www/js/verze.js', `// Vytvořeno skriptem scripts/vendor.mjs z package.json\nexport const VERZE = '${version}';\n`);
console.log('verze', version);
