const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const mustExist = [
  'index.js',
  'electron-main.js',
  'public/index.html',
  'public/host-strategic/start.html',
  'public/host-strategic/pick.html',
  'public/host-strategic/wait.html',
  'public/host-strategic/order.html',
  'public/host-strategic/result.html',
  'public/anime/host-strategic/start.html',
  'public/anime/host-strategic/pick.html',
  'public/anime/host-strategic/wait.html',
  'public/anime/host-strategic/order.html',
  'public/anime/host-strategic/result.html',
];

let failed = false;
console.log('QG14 CARDCLASH desktop check\n');

for (const rel of mustExist) {
  const full = path.join(root, rel);
  const ok = fs.existsSync(full);
  console.log(`${ok ? 'OK ' : 'MISS'} ${rel}`);
  if (!ok) failed = true;
}

function countMedia(rel) {
  const dir = path.join(root, rel);
  if (!fs.existsSync(dir)) return null;
  return fs.readdirSync(dir).filter((name) => /\.(png|jpe?g|webp|gif|avif|webm|mp4|ogg)$/i.test(name)).length;
}

console.log('\nCard folders in the source project (they will be excluded from the EXE):');
for (const rel of [
  'public/images/normal',
  'public/images/legendary',
  'public/images/fullscreen',
  'public/anime/images/normal',
  'public/anime/images/legendary',
  'public/anime/images/fullscreen',
]) {
  const count = countMedia(rel);
  console.log(`${count === null ? 'N/A' : String(count).padStart(4)} ${rel}`);
}

if (failed) {
  console.error('\nSome required project files are missing. Extract/copy the PC patch into the ROOT of the complete QG14 project, not into an empty folder.');
  process.exitCode = 1;
} else {
  console.log('\nDesktop source structure looks ready.');
}
