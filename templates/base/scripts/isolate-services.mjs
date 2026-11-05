/** Remove temporary host connectivity before any website/runtime tests run. */
export function isolateServices(run, setupNetwork, internalNetwork, projectId) {
  const inspectNetworks = id => JSON.parse(run('docker', ['inspect', id, '--format', '{{json .NetworkSettings.Networks}}'], { capture: true }));
  const containers = JSON.parse(run('docker', ['network', 'inspect', setupNetwork, '--format', '{{json .Containers}}'], { capture: true }));
  const entries = Object.entries(containers);
  if (!entries.length || entries.some(([, c]) => !c.Name.startsWith('supabase_') || !c.Name.endsWith('_' + projectId))) {
    throw new Error('Setup network contains unexpected containers; refusing to alter them.');
  }
  // Validate the whole set before changing any connection.
  const services = entries.map(([id, container]) => {
    const networks = inspectNetworks(id);
    if (Object.keys(networks).length !== 1 || !networks[setupNetwork]) throw new Error('Unexpected service network attachment.');
    // Docker's underscore-containing container names are not valid CSP host
    // sources. Give the browser-facing API a DNS-safe name on this network.
    const aliases = [...(networks[setupNetwork].Aliases || [])];
    if (container.Name === 'supabase_kong_' + projectId) aliases.push('verification-backend');
    return { id, aliases: [...new Set(aliases)] };
  });
  for (const { id, aliases } of services) {
    run('docker', ['network', 'connect', ...aliases.flatMap(alias => ['--alias', alias]), internalNetwork, id]);
    run('docker', ['network', 'disconnect', setupNetwork, id]);
  }
  for (const { id } of services) {
    const networks = inspectNetworks(id);
    if (Object.keys(networks).length !== 1 || !networks[internalNetwork]) throw new Error('Service still has a non-isolated network; tests must not run.');
  }
  if (run('docker', ['network', 'inspect', internalNetwork, '--format', '{{.Internal}}'], { capture: true }) !== 'true') {
    throw new Error('Runtime network does not block external access.');
  }
}
