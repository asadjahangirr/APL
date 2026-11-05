import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { unzipSync } from 'fflate';

const kind = process.argv[2];
if (!['northline', 'ellis'].includes(kind)) throw new Error('Choose northline or ellis.');
const root = fileURLToPath(new URL('../', import.meta.url));
const accepted = path.join(root, '.artifacts', 'phase-1', 'accepted-' + kind + '-export');
const zip = unzipSync(await readFile(accepted + '.zip'));
const manifest = JSON.parse(new TextDecoder().decode(zip['export-manifest.json']));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const checksums = {};
for (const file of Object.keys(manifest.files).sort()) {
  if (!zip[file] || hash(zip[file]) !== manifest.files[file]) throw new Error('ZIP differs from manifest: ' + file);
  checksums[file] = hash(zip[file]);
}
if (hash(JSON.stringify(checksums)) !== manifest.contentHash) throw new Error('Manifest content hash differs.');
if (Object.keys(zip).length !== Object.keys(checksums).length + 1) throw new Error('ZIP contains unexpected files.');
const reportSource = kind === 'northline' ? path.join(root, '.artifacts', 'phase-1', 'northline-export') : accepted;
const reportBytes = await readFile(path.join(reportSource, 'verification-report.json'));
const report = JSON.parse(reportBytes);
if (report.status !== 'passed' || report.contentHash !== manifest.contentHash) throw new Error('Passing report does not match the accepted ZIP.');
await writeFile(path.join(accepted, 'verification-report.json'), reportBytes);
await writeFile(path.join(root, 'docs', 'verification', 'studio-' + kind + '-2026-10-01.json'), reportBytes);
console.log(JSON.stringify({ example: kind, status: report.status, contentHash: manifest.contentHash, manifestFiles: Object.keys(checksums).length, checkedAt: report.checkedAt, checks: report.checks?.length }));
