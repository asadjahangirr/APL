import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

export class SetupError extends Error {
  constructor(code, message, hint) { super(message); this.name = 'SetupError'; this.code = code; this.hint = hint; }
}

export function isLocalDockerEndpoint(endpoint) {
  return typeof endpoint === 'string' && !/[\r\n\0]/.test(endpoint) &&
    (/^unix:\/\/\/[^/].+/.test(endpoint) || /^npipe:\/{4}\.\/pipe\/[a-zA-Z0-9_.-]+$/.test(endpoint));
}

/** Read-only preflight. Never change the owner's Docker context or configuration. */
export function checkDockerRuntime({ env = process.env, platform = process.platform, run = spawnSync, exists = existsSync } = {}) {
  const normalizeKey = key => platform === 'win32' ? key.toUpperCase() : key;
  const getEnv = name => Object.entries(env).find(([key]) => normalizeKey(key) === name)?.[1];
  const candidates = ['docker'];
  if (platform === 'win32') {
    if (getEnv('LOCALAPPDATA')) candidates.push(path.join(getEnv('LOCALAPPDATA'), 'Programs', 'DockerDesktop', 'resources', 'bin', 'docker.exe'));
    if (getEnv('PROGRAMFILES')) candidates.push(path.join(getEnv('PROGRAMFILES'), 'Docker', 'Docker', 'resources', 'bin', 'docker.exe'));
  }
  const options = { encoding: 'utf8', timeout: 30_000, maxBuffer: 1_000_000, windowsHide: true, env };
  let command;
  for (const candidate of candidates) {
    if (candidate !== 'docker' && !exists(candidate)) continue;
    const result = run(candidate, ['--version'], options);
    if (!result.error && result.status === 0) { command = candidate; break; }
  }
  if (!command) throw new SetupError('DOCKER_NOT_INSTALLED', 'Docker CLI was not found.', 'Install Docker Desktop, start its Linux engine, then run npm run doctor again. See SETUP.md.');

  // DOCKER_CONTEXT takes precedence over DOCKER_HOST. Inspect context metadata
  // before contacting any daemon so a remote context cannot receive the export.
  const context = getEnv('DOCKER_CONTEXT');
  let endpoint = context ? undefined : getEnv('DOCKER_HOST');
  if (!endpoint) {
    const args = ['context', 'inspect'];
    if (context) args.push(context);
    const result = run(command, args, options);
    try { if (!result.error && result.status === 0) endpoint = JSON.parse(result.stdout)[0]?.Endpoints?.docker?.Host; } catch { /* Fail closed below. */ }
  }
  if (!isLocalDockerEndpoint(endpoint)) throw new SetupError('DOCKER_TARGET_NOT_LOCAL', 'Verification requires a local Docker socket.', 'Choose a local Docker Desktop or Linux context and remove remote DOCKER_HOST/DOCKER_CONTEXT overrides. No files were sent to a daemon.');

  // Pin every subsequent process to this checked endpoint, including Supabase's
  // CLI. An unrelated change to the active Docker context cannot redirect a run.
  const runtimeEnv = Object.fromEntries(Object.entries(env).filter(([key]) => !['DOCKER_HOST','DOCKER_CONTEXT','BUILDX_BUILDER'].includes(normalizeKey(key))));
  runtimeEnv.DOCKER_HOST = endpoint;
  // Prevent a user-selected remote Buildx builder from receiving build context.
  runtimeEnv.BUILDX_BUILDER = 'default';
  // A newly installed Windows CLI may not be in this terminal's inherited PATH.
  // Supabase launches `docker` itself, so propagate the discovered directory.
  if (command !== 'docker') {
    for (const key of Object.keys(runtimeEnv)) if (normalizeKey(key) === 'PATH') delete runtimeEnv[key];
    runtimeEnv.PATH = path.dirname(command) + path.delimiter + (getEnv('PATH') || '');
  }
  // `info` also collects client/plugin diagnostics and can be slow while an
  // image builds on Windows. Version queries the server facts we actually need.
  const result = run(command, ['version', '--format', '{{json .Server}}'], { ...options, env: runtimeEnv });
  if (result.error || result.status !== 0) throw new SetupError('DOCKER_NOT_RUNNING', 'The local Docker engine did not respond.', 'Start Docker Desktop and wait for its engine to be running. Complete any WSL update or Windows restart it requests, then retry.');
  let info;
  try { info = JSON.parse(result.stdout); } catch { throw new SetupError('DOCKER_INFO_INVALID', 'Docker returned an unreadable engine status.', 'Run docker version in your terminal and resolve its error before retrying.'); }
  if (!info || typeof info.Version !== 'string' || typeof info.Os !== 'string') throw new SetupError('DOCKER_INFO_INVALID', 'Docker returned an incomplete engine status.', 'Run docker version and confirm its Server section is present.');
  if (info.Os !== 'linux') throw new SetupError('DOCKER_WRONG_ENGINE', 'Docker is using Windows containers.', 'Switch Docker Desktop to Linux containers and retry.');
  return { command, env: runtimeEnv, version: info.Version };
}
