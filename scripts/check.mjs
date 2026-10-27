import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

async function sources(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await sources(file));
    else if (/\.(m?js)$/.test(file)) files.push(file);
  }
  return files;
}

const files = ['preview-server.mjs', ...(await Promise.all(
  ['assets/js', 'scripts', 'worker'].map(sources),
)).flat()];
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.error || result.status !== 0) {
    throw new Error(`Syntax check failed for ${file}: ${result.stderr || result.error?.message}`);
  }
}
console.log(`PASS: ${files.length} JavaScript source files parse successfully.`);
