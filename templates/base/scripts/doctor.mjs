import { checkDockerRuntime } from './docker-runtime.mjs';
try {
  if (Number(process.versions.node.split('.')[0]) < 24) throw new Error('Install Node.js 24 or newer before running the verifier.');
  const runtime = checkDockerRuntime();
  console.log(`READY: Node ${process.versions.node}; local Docker ${runtime.version || ''}; Linux containers.`);
  console.log('This checks prerequisites only. Run npm run verify to test the actual exported website.');
} catch (error) {
  console.error(`NOT READY${error.code ? ' [' + error.code + ']' : ''}: ${error.message}`);
  if (error.hint) console.error(error.hint);
  process.exitCode = 1;
}
