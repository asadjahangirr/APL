import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { unzipSync } from 'fflate';

const kind = process.argv[2];
if (!['meridian', 'mira', 'icon'].includes(kind)) throw new Error('Choose meridian, mira, or icon.');
const root = fileURLToPath(new URL('../', import.meta.url));
const folder = path.join(root, '.artifacts', 'phase-4', kind + '-export');
const zipBytes = await readFile(folder + '.zip');
const files = unzipSync(zipBytes);
const decode = bytes => new TextDecoder().decode(bytes);
const manifest = JSON.parse(decode(files['export-manifest.json']));
if (manifest.generatorVersion !== '0.9.1') throw new Error('Generate a patched Phase 4 acceptance export first.');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const hashes = {};
for (const name of Object.keys(manifest.files).sort()) {
  if (!files[name] || hash(files[name]) !== manifest.files[name]) throw new Error('ZIP checksum differs: ' + name);
  if (hash(await readFile(path.join(folder, name))) !== manifest.files[name]) throw new Error('Extracted source differs: ' + name);
  hashes[name] = hash(files[name]);
}
if (hash(JSON.stringify(hashes)) !== manifest.contentHash) throw new Error('Manifest checksum differs.');
if (Object.keys(files).length !== Object.keys(hashes).length + 1) throw new Error('Unexpected ZIP files.');
const reportBytes = await readFile(path.join(folder, 'verification-report.json'));
const report = JSON.parse(decode(reportBytes));
if (report.status !== 'passed' || report.contentHash !== manifest.contentHash) throw new Error('No passing report for this exact ZIP.');
await writeFile(path.join(root, 'docs', 'verification', 'studio-phase4-' + kind + '.json'), reportBytes);
const integrity = { template: kind, generatorVersion: manifest.generatorVersion, status: report.status, contentHash: manifest.contentHash, zipSha256: hash(zipBytes), manifestFiles: Object.keys(hashes).length, checks: report.checks.length, checkedAt: report.checkedAt };
await writeFile(path.join(root, '.artifacts', 'phase-4', kind + '-integrity.json'), JSON.stringify(integrity, null, 2));
console.log(JSON.stringify(integrity, null, 2));
