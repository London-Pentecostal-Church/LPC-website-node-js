import { readFile, writeFile, mkdir, cp, rm, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const CONFIG_NAMES = [
  'home-hero', 'hero-images', 'pastor-thought', 'site-settings',
  'pastors', 'branches', 'image-framing', 'page-images',
];
const SERVER_FILES = [
  'account-mail.mjs', 'calendar.mjs', 'ical.js', 'ICAL-LICENSE.txt',
  'volunteers.mjs', 'planner-report.mjs', 'volunteer-store.mjs', 'demo-state.mjs',
];
const MEDIA_FILE = /\.(jpe?g|png|webp|svg|mp4|webm|mov|m4v)$/i;
const VIDEO_FILE = /\.(mp4|webm|mov|m4v)$/i;
const BUNDLE_MARKER = '/* BUNDLED_DATA */';
const readText = file => readFile(file, 'utf8');
const readJson = async file => JSON.parse(await readText(file));

async function collectAssets(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      result.push(...await collectAssets(file));
    } else if (MEDIA_FILE.test(file)) {
      const metadata = await stat(file);
      result.push({
        name: entry.name,
        path: './' + file.replaceAll('\\', '/'),
        type: VIDEO_FILE.test(file) ? 'video' : 'image',
        source: 'asset',
        size: metadata.size,
        modified: metadata.mtimeMs,
      });
    }
  }
  return result;
}

function collectReferences(source, html, css) {
  // Seed profiles are replaced by saved configuration at runtime.
  const withoutSeeds = source
    .replace(/let branchCards = \[[\s\S]*?\n\];/, '')
    .replace(/let branchConfig = .*;\r?\n/, '')
    .replace(/let pastors = \[[\s\S]*?\n\];/, '')
    .replace(/let pastorConfig = .*;\r?\n/, '');
  const references = new Set(
    `${withoutSeeds} ${html} ${css}`.match(/\.\/assets\/(?:images|videos)\/[^"'`<>\s)]+/g) || [],
  );
  // Kept for the saved public pastor profile even when absent from the seed list.
  references.add('./assets/images/team/sam-john-hero.png');
  return [...references];
}

// Read and validate inputs before replacing the previous build.
const [configEntries, imageAssets, videoAssets, backupNames, source, html, css, worker] = await Promise.all([
  Promise.all(CONFIG_NAMES.map(async name => [name, await readJson(`assets/data/${name}.json`)])),
  collectAssets('assets/images'),
  collectAssets('assets/videos'),
  readdir('assets/data/backups'),
  readText('assets/js/site.js'),
  readText('index.html'),
  readText('assets/css/styles.css'),
  readText('worker/index.js'),
]);
if (!worker.includes(BUNDLE_MARKER)) throw new Error('Worker bundle marker is missing.');
await Promise.all(SERVER_FILES.map(file => stat(`worker/${file}`)));
const backups = Object.fromEntries(await Promise.all(
  backupNames.filter(name => name.endsWith('.json')).map(async name => [name, await readJson(`assets/data/backups/${name}`)]),
));
const bundle = {
  defaults: Object.fromEntries(configEntries),
  bundledAssets: [...imageAssets, ...videoAssets],
  bundledBackups: backups,
  bundledReferences: collectReferences(source, html, css),
  bundledUploadPaths: (await collectAssets('assets/data/uploads')).map(asset => asset.path.replace('./assets/data/', '/')),
};
const declarations = Object.entries(bundle).map(([name, value]) => `const ${name}=${JSON.stringify(value)};`).join('');

await rm('dist', { recursive: true, force: true });
await Promise.all(['dist/server', 'dist/client', 'dist/.openai'].map(directory => mkdir(directory, { recursive: true })));
await Promise.all([
  cp('assets', 'dist/client/assets', { recursive: true }),
  cp('index.html', 'dist/client/index.html'),
  writeFile('dist/server/index.js', worker.replace(BUNDLE_MARKER, declarations)),
  ...SERVER_FILES.map(file => cp(`worker/${file}`, `dist/server/${file}`)),
]);
console.log('Built website, admin server and existing configuration assets');
