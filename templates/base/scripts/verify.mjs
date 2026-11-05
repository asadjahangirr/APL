import { spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, statfs, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { checkDockerRuntime, SetupError } from './docker-runtime.mjs';
import { isolateServices } from './isolate-services.mjs';
import { redactCommandOutput } from './command-output.mjs';
import { safeManifestPath } from './manifest-path.mjs';
const root = process.cwd();
const hash = value => createHash('sha256').update(value).digest('hex');
const reportPath = path.join(root, 'verification-report.json');
let manifest; let work; let network; let setupNetwork; let image; let runtime; let started = false;
function run(command, args, options = {}) {
  const result = spawnSync(command === 'docker' ? runtime.command : command, args, { cwd: work || root, encoding: 'utf8', windowsHide: true, env: runtime?.env || process.env, stdio: options.capture ? 'pipe' : 'inherit', ...options });
  if (result.error || result.status !== 0) {
    if (options.capture) console.error(redactCommandOutput((result.stdout || '') + '\n' + (result.stderr || '')).slice(-4000));
    throw new Error('Command failed: ' + command + ' ' + args[0]);
  }
  return result.stdout?.trim();
}
function cli(args, capture = false) {
  if (!process.env.npm_execpath) throw new Error('Run this verifier through npm run verify.');
  // A pinned CLI operates ONLY against the unique local proof project.
  const env = { ...runtime.env };
  for (const key of Object.keys(env)) if (/^(SUPABASE_|NEXT_PUBLIC_SUPABASE_|BREVO_|ADMIN_)/i.test(key)) delete env[key];
  const output = run(process.execPath, [process.env.npm_execpath, 'exec', '--cache', path.join(tmpdir(), 'apl-npm-cache'), '--prefer-offline', '--yes', '--package=supabase@2.118.0', '--', 'supabase', ...args], { capture: true, env, maxBuffer: 8_000_000 });
  if (!capture && output) console.log(redactCommandOutput(output));
  return output;
}
try {
  manifest = JSON.parse(await readFile(path.join(root,'export-manifest.json'),'utf8'));
  // Check the actual temporary-files volume before creating networks or pulling
  // images. This is minimum headroom, not a guarantee for cold Docker downloads.
  let space;
  try { space = await statfs(tmpdir(), { bigint: true }); }
  catch { throw new SetupError('TEMP_DISK_CHECK_FAILED', 'Could not measure free space for verification temporary files.', 'Check that your system temporary folder is accessible, then retry.'); }
  const available = space.bavail * space.bsize;
  if (available < 10n * 1024n ** 3n) throw new SetupError('TEMP_DISK_SPACE_LOW', 'Verification needs at least 10 GiB free on the temporary-files volume.', 'Free space on ' + tmpdir() + ' before retrying. This minimum is headroom, not a guarantee; Docker images may use a separate drive that also needs free space. No caches were deleted.');
  console.log('Temporary volume has ' + (Number(available) / 1024 ** 3).toFixed(1) + ' GiB free. Docker image storage may need additional space.');
  runtime = checkDockerRuntime();
  const checksums = {};
  work = await mkdtemp(path.join(tmpdir(), 'apl-proof-'));
  for (const file of Object.keys(manifest.files).sort()) {
    if (!safeManifestPath(file)) throw new Error('Unsafe file in manifest.');
    const bytes = await readFile(path.join(root,file)); checksums[file] = hash(bytes);
    if (checksums[file] !== manifest.files[file]) throw new Error('Export changed: ' + file + '. Verify an untouched download.');
    const destination = path.join(work,file); await mkdir(path.dirname(destination), { recursive:true }); await writeFile(destination,bytes);
  }
  if (hash(JSON.stringify(checksums)) !== manifest.contentHash) throw new Error('Manifest checksum mismatch.');
  await writeFile(path.join(work,'export-manifest.json'), JSON.stringify(manifest));
  const id = 'proof' + randomUUID().replaceAll('-','').slice(0,12);
  network = 'apl-' + id; image = 'apl-verify:' + id;
  run('docker',['network','create','--internal',network],{capture:true});
  const internal = run('docker',['network','inspect',network,'--format','{{.Internal}}'],{capture:true});
  if (internal !== 'true') throw new Error('Runtime network must deny external access.');
  const environment = { SITE_URL:'http://127.0.0.1:3000', CONTACT_HASH_SECRET:randomUUID()+randomUUID(), VERIFY_RUN:'isolated', NEXT_PUBLIC_SUPABASE_URL:'', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'' };
  if (manifest.modules.some(module => ['contact', 'services-cms', 'portfolio-cms', 'articles-cms'].includes(module))) {
    const configPath = path.join(work,'supabase','config.toml');
    await writeFile(configPath, (await readFile(configPath,'utf8')).replace('apl-export',id));
    // Docker Desktop cannot publish localhost ports from an internal-only
    // network. The local CLI needs them to initialize schema and test keys.
    setupNetwork = network + '-setup';
    run('docker',['network','create',setupNetwork],{capture:true});
    started = true;
    console.log('Initializing disposable local services on ports 54321, 54322 and 54324. Use a trusted computer/network; setup ports may bind beyond localhost. First-run images may take time.');
    cli(['start','--network-id',setupNetwork]);
    // This fresh project is never linked to a remote database. Migrations run at start.
    const status = JSON.parse(cli(['status','--output','json'],true));
    if (!status.ANON_KEY || !status.SERVICE_ROLE_KEY) throw new Error('Local Supabase keys unavailable.');
    environment.NEXT_PUBLIC_SUPABASE_URL = 'http://verification-backend:8000';
    environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = status.ANON_KEY;
    environment.SUPABASE_SECRET_KEY = status.SERVICE_ROLE_KEY;
    isolateServices(run, setupNetwork, network, id);
    run('docker',['network','rm',setupNetwork],{capture:true}); setupNetwork = undefined;
    console.log('All test services now use only the internal network.');
  }
  const buildArgs = ['build','-f','Dockerfile.verify','-t',image];
  for (const key of ['NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY']) buildArgs.push('--build-arg',key+'='+environment[key]);
  run('docker',[...buildArgs,'.']);
  const envFile = path.join(work,'verify.env');
  await writeFile(envFile,Object.entries(environment).map(([key,value])=>key+'='+value).join('\n'),{mode:0o600});
  const out = path.join(work,'report'); await mkdir(out);
  run('docker',['run','--rm','--network',network,'--env-file',envFile,'--mount','type=bind,source='+out+',target=/report',image]);
  const report = JSON.parse(await readFile(path.join(out,'verification-report.json'),'utf8'));
  if (report.status !== 'passed' || report.contentHash !== manifest.contentHash) throw new Error('Verification report mismatch.');
  await writeFile(reportPath,JSON.stringify(report,null,2));
  console.log('PASS: independent runtime verified. Read verification-report.json.');
} catch(error) {
  await writeFile(reportPath,JSON.stringify({status:'not-verified',contentHash:manifest?.contentHash,code:error.code || 'VERIFICATION_FAILED',reason:error.message,hint:error.hint,checkedAt:new Date().toISOString()},null,2));
  console.error('NOT VERIFIED: '+error.message+'\n'+(error.hint || 'Read the command output above and SETUP.md. No production credentials are used.'));
  process.exitCode = 1;
} finally {
  if (started) { try { cli(['stop','--no-backup']); } catch { console.error('Could not stop proof containers; inspect Docker.'); } }
  if (setupNetwork) { try { run('docker',['network','rm',setupNetwork],{capture:true}); } catch {} }
  if (network) { try { run('docker',['network','rm',network],{capture:true}); } catch {} }
  if (image) { try { run('docker',['image','rm',image],{capture:true}); } catch {} }
  if (work) console.log('Proof workspace retained for inspection: '+work);
}
