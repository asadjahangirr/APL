import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { checkDockerRuntime, isLocalDockerEndpoint } from '../templates/base/scripts/docker-runtime.mjs';
const ok = stdout => ({ status: 0, stdout, stderr: '' });
function fixture({ endpoint = 'unix:///var/run/docker.sock', type = 'linux', running = true } = {}) {
  const calls = [];
  const run = (command, args, options) => {
    calls.push({ command, args, env: options.env });
    if (args[0] === '--version') return ok('Docker version test');
    if (args[0] === 'context') return ok(JSON.stringify([{ Endpoints: { docker: { Host: endpoint } } }]));
    if (args[0] === 'version') return running ? ok(JSON.stringify({ Os: type, Version: 'test' })) : { status: 1, stderr: 'not running' };
    throw new Error('Unexpected command');
  };
  return { run, calls };
}
describe('local Docker prerequisite checks', () => {
  it('accepts local sockets and rejects remote named pipes, TCP, SSH and malformed targets', () => {
    for (const target of ['unix:///var/run/docker.sock', 'npipe:////./pipe/dockerDesktopLinuxEngine']) expect(isLocalDockerEndpoint(target)).toBe(true);
    for (const target of ['tcp://127.0.0.1:2375', 'ssh://host', 'npipe:////remote/pipe/docker_engine', 'unix://host/socket', 'unix:///socket\n', undefined]) expect(isLocalDockerEndpoint(target)).toBe(false);
  });
  it('refuses a remote context before connecting to any daemon', () => {
    const f = fixture({ endpoint: 'ssh://production' });
    expect(() => checkDockerRuntime({ env: {}, platform: 'linux', run: f.run })).toThrow('local Docker socket');
    expect(f.calls.some(c => c.args[0] === 'version')).toBe(false);
  });
  it('honors context precedence and pins subsequent commands to the verified local engine', () => {
    const f = fixture();
    const runtime = checkDockerRuntime({ env: { DOCKER_HOST: 'ssh://ignored', DOCKER_CONTEXT: 'desktop-linux', BUILDX_BUILDER: 'remote-builder' }, platform: 'linux', run: f.run });
    expect(f.calls[1].args).toEqual(['context', 'inspect', 'desktop-linux']);
    expect(runtime.env.DOCKER_CONTEXT).toBeUndefined();
    expect(runtime.env.DOCKER_HOST).toBe('unix:///var/run/docker.sock');
    expect(runtime.env.BUILDX_BUILDER).toBe('default');
  });
  it('rejects a remote DOCKER_HOST without probing it', () => {
    const f = fixture();
    expect(() => checkDockerRuntime({ env: { DOCKER_HOST: 'tcp://remote:2375' }, platform: 'linux', run: f.run })).toThrow('local Docker socket');
    expect(f.calls).toHaveLength(1);
  });
  it('handles Windows environment-variable casing without leaving remote overrides behind', () => {
    const f = fixture({ endpoint: 'npipe:////./pipe/dockerDesktopLinuxEngine' });
    const runtime = checkDockerRuntime({ env: { docker_context: 'desktop-linux', docker_host: 'ssh://ignored', buildx_builder: 'remote' }, platform: 'win32', run: f.run });
    expect(f.calls[1].args).toEqual(['context', 'inspect', 'desktop-linux']);
    expect(runtime.env).toEqual({ DOCKER_HOST: 'npipe:////./pipe/dockerDesktopLinuxEngine', BUILDX_BUILDER: 'default' });
  });
  it('distinguishes missing CLI, stopped engine, and Windows containers', () => {
    expect(() => checkDockerRuntime({ env: {}, platform: 'linux', run: () => ({ error: { code: 'ENOENT' } }) })).toThrow('CLI was not found');
    expect(() => checkDockerRuntime({ env: {}, platform: 'linux', run: fixture({ running: false }).run })).toThrow('did not respond');
    expect(() => checkDockerRuntime({ env: {}, platform: 'linux', run: fixture({ type: 'windows' }).run })).toThrow('Windows containers');
  });
  it('makes a newly discovered Windows installation available to Supabase subprocesses', () => {
    const f = fixture({ endpoint: 'npipe:////./pipe/dockerDesktopLinuxEngine' });
    const env = { LOCALAPPDATA: 'C:\\Users\\Owner\\AppData\\Local', Path: 'C:\\Windows\\System32' };
    const runtime = checkDockerRuntime({ env, platform: 'win32', exists: () => true,
      run: (command,args,options) => command === 'docker' ? { error: { code: 'ENOENT' } } : f.run(command,args,options)
    });
    expect(runtime.command).toContain('DockerDesktop');
    expect(runtime.env.PATH).toBe(path.dirname(runtime.command)+path.delimiter+env.Path);
    expect(runtime.env.Path).toBeUndefined();
    expect(env.Path).toBe('C:\\Windows\\System32');
  });
});
