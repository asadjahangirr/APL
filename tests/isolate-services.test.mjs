import { describe, it, expect } from 'vitest';
import { isolateServices } from '../templates/base/scripts/isolate-services.mjs';
import { redactCommandOutput } from '../templates/base/scripts/command-output.mjs';

function fixture({ foreign = false, keepsSetup = false, internal = true } = {}) {
  const calls = []; const networks = { db: { setup: { Aliases: ['database'] } }, api: { setup: { Aliases: ['gateway'] } } };
  const run = (_, args) => {
    calls.push(args);
    if (args[0] === 'inspect') return JSON.stringify(networks[args[1]]);
    if (args[0] === 'network' && args[1] === 'inspect') return args[2] === 'internal' ? String(internal) : JSON.stringify({ db: { Name: 'supabase_db_proof123' }, api: { Name: foreign ? 'unrelated-project' : 'supabase_kong_proof123' } });
    const id = args.at(-1);
    if (args[1] === 'connect') networks[id].internal = { Aliases: [] };
    if (args[1] === 'disconnect' && !keepsSetup) delete networks[id].setup;
    return '';
  };
  return { calls, run, networks };
}
describe('runtime service isolation after Windows-compatible setup', () => {
  it('preserves service aliases and removes all setup connectivity', () => {
    const f = fixture(); isolateServices(f.run, 'setup', 'internal', 'proof123');
    expect(f.calls).toContainEqual(['network', 'connect', '--alias', 'gateway', '--alias', 'verification-backend', 'internal', 'api']);
    expect(Object.keys(f.networks.db)).toEqual(['internal']);
    expect(Object.keys(f.networks.api)).toEqual(['internal']);
  });
  it('does not touch a network containing unrelated containers', () => {
    const f = fixture({ foreign: true });
    expect(() => isolateServices(f.run, 'setup', 'internal', 'proof123')).toThrow('unexpected containers');
    expect(f.calls.some(c => c[1] === 'connect' || c[1] === 'disconnect')).toBe(false);
  });
  it('fails closed if setup connectivity remains', () => {
    const f = fixture({ keepsSetup: true });
    expect(() => isolateServices(f.run, 'setup', 'internal', 'proof123')).toThrow('non-isolated network');
  });
  it('rejects a runtime network that permits external access', () => {
    const f = fixture({ internal: false });
    expect(() => isolateServices(f.run, 'setup', 'internal', 'proof123')).toThrow('does not block external access');
  });
  it('redacts local CLI credentials while retaining useful setup messages', () => {
    const output = redactCommandOutput('{"JWT_SECRET":"test-only-secret","DB_URL":"postgresql://postgres:password@localhost/db","message":"Started"}\nsb_secret_test-key eyJtest.payload.signature');
    expect(output).toContain('Started');
    for (const secret of ['test-only-secret', 'password', 'sb_secret_test-key', 'eyJtest.payload.signature']) expect(output).not.toContain(secret);
  });
  it('redacts storage credentials from JSON, environment output and human labels', () => {
    const values = {
      S3_PROTOCOL_ACCESS_KEY_ID: 'synthetic-storage-id',
      S3_PROTOCOL_ACCESS_KEY_SECRET: 'synthetic-storage-secret-with-"quote',
      AWS_ACCESS_KEY_ID: 'synthetic-aws-id',
      AWS_SECRET_ACCESS_KEY: 'synthetic-aws-secret',
      AWS_SESSION_TOKEN: 'synthetic-session-token',
    };
    const json=redactCommandOutput(JSON.stringify({...values,message:'Storage started'}));
    expect(JSON.parse(json)).toEqual(Object.fromEntries([...Object.keys(values).map(key=>[key,'[redacted]']),['message','Storage started']]));
    const lines=redactCommandOutput(Object.entries(values).map(([key,value])=>'export '+key+'='+JSON.stringify(value)).join('\n')+'\nAccess Key: synthetic-human-id\nSecret Key: synthetic-human-secret\nStorage started');
    for(const secret of [...Object.values(values),'synthetic-human-id','synthetic-human-secret']) expect(lines).not.toContain(secret);
    expect(lines).toContain('Storage started'); expect(lines.match(/\[redacted\]/g)).toHaveLength(7);
  });
});
