import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';

export async function verifyPortfolio({ origin, page, db, anon, ownerToken, ordinaryToken, checks, importContent, signInToAdmin, contact, services, site }) {
  const headers = { Origin: origin, Authorization: 'Bearer ' + ownerToken, 'Content-Type': 'application/json' };
  const endpoint = origin + '/api/admin/portfolio';
  const request = (body, extra = {}) => fetch(endpoint, { method: 'POST', headers: { ...headers, ...extra }, body: JSON.stringify(body) });
  async function mutate(body, status = 200) {
    const response = await request(body);
    assert.equal(response.status, status, 'Portfolio ' + body.action + ' returned ' + response.status);
    const result = await response.json(); assert.ok(result.portfolio);
    return result.portfolio;
  }
  async function records() {
    const response = await fetch(endpoint, { headers }); assert.equal(response.status, 200);
    const result = await response.json(); assert.ok(Array.isArray(result.portfolio)); return result.portfolio;
  }
  async function current(id) {
    const entry = (await records()).find(record => record.id === id); assert.ok(entry); return entry;
  }
  async function snapshot(table) {
    const result = await db.from(table).select('*').order('id'); assert.equal(result.error, null); return result.data;
  }
  const walk = nodes => nodes.flatMap(node => [node, ...walk(node.children || [])]);
  const collectionPages = site.pages.filter(entry => walk(entry.nodes).some(node => node.type === 'PortfolioCollection'));
  assert.ok(collectionPages.length, 'Selected portfolio module needs a collection');
  const listing = origin + collectionPages[0].path;
  const seed = JSON.parse(await readFile('portfolio-seed.json', 'utf8'));
  for (const file of ['portfolio-seed.json', 'project.apl.json', 'site-data.json', '.env.local']) {
    assert.equal((await fetch(origin + '/' + file)).status, 404, 'Private source must not be served: ' + file);
  }
  checks.push('portfolio-private-seed-and-source-not-served');
  const imported = await records();
  for (const entry of seed) {
    assert.ok(imported.some(record => record.id === entry.id), 'Portfolio seed record missing');
    if (!entry.published) assert.equal((await fetch(origin + '/api/portfolio/' + entry.id + '/image')).status, 404);
  }
  for (const width of [390, 768, 1280]) for (const route of collectionPages) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal((await page.goto(origin + route.path)).status(), 200);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, 'Portfolio listing overflow');
    const settings = walk(route.nodes).find(node => node.type === 'PortfolioCollection').props;
    for (const collection of await page.locator('.portfolio-collection').all()) {
      assert.equal(await collection.getAttribute('data-design'), settings.design);
      assert.deepEqual(await collection.locator('[data-portfolio-id]').evaluateAll(elements => elements.map(element => element.getAttribute('data-portfolio-id'))), seed.filter(entry => entry.published).map(entry => entry.id).sort(), 'Published portfolio ordering must match the editor');
      if (seed.some(entry => entry.published)) {
        const grid = collection.locator('.portfolio-grid');
        const columns = await grid.evaluate(element => getComputedStyle(element).gridTemplateColumns.split(' ').length);
        const expectedColumns = settings.design === 'index' ? 1 : width >= 1024 ? settings.desktop ?? settings.tablet ?? settings.mobile : width >= 768 ? settings.tablet ?? settings.mobile : settings.mobile;
        assert.equal(columns, expectedColumns, 'Portfolio responsive columns for ' + settings.design + ' at ' + width);
      }
      for (const entry of seed) {
        const card = collection.locator('[data-portfolio-id="' + entry.id + '"]');
        assert.equal(await card.count(), entry.published ? 1 : 0, 'Only published portfolio entries are visible');
        if (entry.published) {
          const link = card.locator('a.portfolio-card-link');
          if (entry.published.target) {
            const destination = site.pages.find(page => page.id === entry.published.target.pageId);
            assert.ok(destination, 'Portfolio case-study page is included');
            const href = destination.path + (entry.published.target.anchor === '#top' ? '' : entry.published.target.anchor);
            assert.equal(await link.getAttribute('href'), href);
            assert.equal(await link.getAttribute('target'), null);
          } else {
            assert.equal(await link.getAttribute('href'), new URL(entry.published.externalUrl).href);
            assert.equal(await link.getAttribute('target'), '_blank');
            assert.match(await link.getAttribute('rel'), /\bnoopener\b/);
            assert.match(await link.getAttribute('rel'), /\bnoreferrer\b/);
          }
          if (entry.published.image) {
            const image = card.locator('img'); await image.scrollIntoViewIfNeeded();
            await image.evaluate(element => element.decode());
            assert.equal(await image.evaluate(element => element.naturalWidth > 0), true);
          }
        }
      }
    }
  }
  checks.push('portfolio-seed-drafts-private', 'portfolio-responsive-card-destinations');
  for (const entry of seed.filter(entry => entry.published?.target)) {
    await page.goto(listing);
    const destination = site.pages.find(page => page.id === entry.published.target.pageId);
    const href = destination.path + (entry.published.target.anchor === '#top' ? '' : entry.published.target.anchor);
    await page.locator('[data-portfolio-id="' + entry.id + '"] a.portfolio-card-link').first().click();
    await page.waitForURL(origin + href);
    assert.equal((await fetch(origin + destination.path)).status, 200);
  }
  if (seed.some(entry => entry.published?.target)) checks.push('portfolio-seed-case-study-navigation');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const route of collectionPages) {
    await page.goto(origin + route.path);
    for (const card of await page.locator('.portfolio-card').all()) {
      await card.hover();
      const motion = await card.evaluate(element => [element, ...element.querySelectorAll('*')].map(item => {
        const style = getComputedStyle(item);
        return { transform: style.transform, durations: [style.animationDuration, style.transitionDuration].flatMap(value => value.split(',').map(time => parseFloat(time) * (time.trim().endsWith('ms') ? 0.001 : 1))) };
      }));
      assert.ok(motion.every(item => item.transform === 'none' && item.durations.every(value => value <= 0.001)), 'Portfolio animations must respect reduced motion');
    }
  }
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  checks.push('portfolio-reduced-motion-respected');
  assert.equal((await fetch(endpoint)).status, 401);
  assert.equal((await fetch(endpoint, { headers: { Authorization: 'Bearer ' + ordinaryToken } })).status, 401);
  const anonymousDraft = await anon.from('cms_portfolio').select('*');
  assert.ok(anonymousDraft.error || anonymousDraft.data.length === 0);
  const ordinaryDraft = await fetch(process.env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/cms_portfolio?select=*', {
    headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, Authorization: 'Bearer ' + ordinaryToken },
  });
  if (ordinaryDraft.ok) assert.deepEqual(await ordinaryDraft.json(), []); else assert.ok([401, 403].includes(ordinaryDraft.status));
  assert.equal((await request({ action: 'create', id: randomUUID(), draft: {} }, { Origin: 'https://untrusted.example' })).status, 403);
  assert.equal((await request({ action: 'save', id: 'bad-id', expectedRevision: 1, draft: {} })).status, 400);
  assert.equal((await request({ action: 'create', id: randomUUID(), draft: { title: 'x'.repeat(100_000) } })).status, 413);
  checks.push('portfolio-authorization-and-draft-isolation', 'portfolio-origin-validation-and-payload-limits');

  const id = randomUUID(), originalTitle = 'Independent portfolio project ' + id;
  const externalUrl = 'https://portfolio-proof.example/projects/' + id;
  const draft = { title: originalTitle, summary: 'Original public portfolio summary.', category: 'Identity design', externalUrl, image: '', imageAlt: '' };
  let entry = await mutate({ action: 'create', id, draft }, 201);
  assert.equal(entry.published, null); assert.equal(entry.revision, 1);
  assert.ok(!(await (await fetch(listing)).text()).includes(originalTitle));
  assert.equal((await fetch(origin + '/api/portfolio/' + id + '/image')).status, 404);
  for (const invalidUrl of ['javascript:alert(1)', 'data:text/html,test', '//example.test/path', 'https://user:password@example.test', 'https://@example.test', 'https://%65xample.test', 'https://example.test:65536', 'https://example.test/\npath', 'https:\\\\example.test', 'https://']) {
    assert.equal((await request({ action: 'save', id, expectedRevision: entry.revision, draft: { ...draft, externalUrl: invalidUrl } })).status, 400, 'Unsafe URL must be rejected');
    const bypass = await db.rpc('cms_mutate_portfolio', { p_action: 'save', p_id: id, p_expected_revision: entry.revision, p_draft: { ...draft, externalUrl: invalidUrl } });
    assert.ok(bypass.error, 'Database payload checks must independently reject unsafe external URLs');
  }
  const unprivilegedMutation = await anon.rpc('cms_mutate_portfolio', { p_action: 'publish', p_id: id, p_expected_revision: entry.revision, p_draft: null });
  assert.ok(unprivilegedMutation.error, 'Anonymous visitors must not execute portfolio mutations');
  entry = await mutate({ action: 'save', id, expectedRevision: entry.revision, draft: { ...draft, externalUrl: '' } });
  assert.equal((await request({ action: 'publish', id, expectedRevision: entry.revision })).status, 400, 'Publication requires a destination URL');
  entry = await mutate({ action: 'save', id, expectedRevision: entry.revision, draft });
  entry = await mutate({ action: 'publish', id, expectedRevision: entry.revision });
  assert.equal(entry.published.externalUrl, externalUrl); assert.equal(entry.publishedRevision, entry.revision);
  assert.ok((await (await fetch(listing)).text()).includes(originalTitle));
  checks.push('portfolio-safe-external-url-validation');

  // Exercise the real card click while the Docker network remains isolated.
  // This exact synthetic destination is fulfilled locally; no website is called.
  await page.goto(listing);
  const context = page.context();
  const fulfilDestination = route => route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Controlled external destination</title><link rel="icon" href="data:,"><h1>Project destination</h1>' });
  await context.route(externalUrl, fulfilDestination);
  let popup;
  try {
    [popup] = await Promise.all([
      context.waitForEvent('page'),
      page.locator('[data-portfolio-id="' + id + '"] a.portfolio-card-link').first().click(),
    ]);
    await popup.waitForURL(externalUrl);
    await popup.getByRole('heading', { name: 'Project destination' }).waitFor();
    assert.equal(await popup.evaluate(() => window.opener === null), true, 'External destination must not receive an opener');
    assert.equal(page.url(), listing, 'Opening a project must keep the portfolio website open');
  } finally {
    await popup?.close();
    await context.unroute(externalUrl, fulfilDestination);
  }
  checks.push('portfolio-external-navigation-isolated-test');

  // The owner can switch a real CMS card to an internal destination. Unknown
  // pages and malformed targets must never become published navigation.
  const destination = site.pages.find(page => page.path !== '/') || site.pages[0];
  const internalDraft = { ...entry.draft, externalUrl: '', target: { pageId: destination.id, anchor: '#top' } };
  assert.equal((await request({ action: 'save', id, expectedRevision: entry.revision, draft: { ...internalDraft, target: { pageId: 'missing-page', anchor: '#top' } } })).status, 400);
  for (const target of [null, { pageId: destination.id }, { pageId: '../bad', anchor: '#top' }, { pageId: destination.id, anchor: 'javascript:bad' }]) {
    assert.equal((await request({ action: 'save', id, expectedRevision: entry.revision, draft: { ...internalDraft, target } })).status, 400);
    const bypass = await db.rpc('cms_mutate_portfolio', { p_action: 'save', p_id: id, p_expected_revision: entry.revision, p_draft: { ...internalDraft, target } });
    assert.ok(bypass.error, 'Database independently rejects malformed page targets');
  }
  entry = await mutate({ action: 'save', id, expectedRevision: entry.revision, draft: internalDraft });
  entry = await mutate({ action: 'publish', id, expectedRevision: entry.revision });
  await page.goto(listing);
  const internalCard = page.locator('[data-portfolio-id="' + id + '"] a.portfolio-card-link').first();
  assert.equal(await internalCard.getAttribute('href'), destination.path);
  assert.equal(await internalCard.getAttribute('target'), null);
  await internalCard.click(); await page.waitForURL(origin + destination.path);
  const rebound = await fetch(origin + '/api/portfolio/' + id + '/link', { redirect: 'manual' });
  assert.equal(rebound.status, 307);
  assert.equal(rebound.headers.get('location'), destination.path);
  checks.push('portfolio-admin-internal-destinations', 'portfolio-invalid-page-target-rejected');

  await page.setViewportSize({ width: 1280, height: 900 });
  await signInToAdmin();
  const tab = page.getByRole('button', { name: 'Portfolio', exact: true }); if (await tab.isVisible()) await tab.click();
  await page.getByRole('button').filter({ hasText: originalTitle }).click();
  const updatedTitle = 'Unpublished portfolio revision ' + id;
  await page.getByLabel('Title', { exact: true }).fill(updatedTitle);
  await page.getByLabel('Summary', { exact: true }).fill('<script>window.aplPortfolioInjected=true</script> Owner supplied summary.');
  await page.getByLabel('Category', { exact: true }).fill('Brand systems');
  async function dismissDiscard(button) {
    let confirmation;
    const dismiss = async dialog => { confirmation = dialog.type(); await dialog.dismiss(); };
    page.once('dialog', dismiss);
    try { await button.click(); assert.equal(confirmation, 'confirm'); }
    finally { page.off('dialog', dismiss); }
    assert.equal(await page.getByLabel('Title', { exact: true }).inputValue(), updatedTitle);
    assert.equal(await page.getByRole('button', { name: 'Sign out', exact: true }).isVisible(), true);
  }
  await dismissDiscard(page.getByRole('button', { name: 'Sign out', exact: true }));
  if (contact) await dismissDiscard(page.getByRole('button', { name: 'Inbox', exact: true }));
  if (services) await dismissDiscard(page.getByRole('button', { name: 'Services', exact: true }));
  checks.push('portfolio-unsaved-edit-guards');
  const saved = page.waitForResponse(response => response.url() === endpoint && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Save draft', exact: true }).click(); assert.equal((await saved).status(), 200);
  entry = await current(id); assert.equal(entry.draft.title, updatedTitle); assert.equal(entry.published.title, originalTitle);
  const unchanged = await (await fetch(listing)).text(); assert.ok(unchanged.includes(originalTitle)); assert.ok(!unchanged.includes(updatedTitle));
  const published = page.waitForResponse(response => response.url() === endpoint && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Publish', exact: true }).click(); assert.equal((await published).status(), 200);
  entry = await current(id); assert.equal(entry.published.title, updatedTitle);
  await page.goto(listing);
  assert.equal(await page.evaluate(() => window.aplPortfolioInjected), undefined);
  const updatedCard = page.locator('[data-portfolio-id="' + id + '"]').first();
  assert.ok((await updatedCard.textContent()).includes(updatedTitle));
  assert.ok((await (await fetch(listing)).text()).includes('&lt;script&gt;'));
  checks.push('portfolio-admin-save-preserves-publication', 'portfolio-admin-publish-updates-cards', 'portfolio-safe-text-rendering');

  const concurrent = await Promise.all([
    request({ action: 'save', id, expectedRevision: entry.revision, draft: { ...entry.draft, category: 'First writer' } }),
    request({ action: 'save', id, expectedRevision: entry.revision, draft: { ...entry.draft, category: 'Second writer' } }),
  ]);
  assert.deepEqual(concurrent.map(response => response.status).sort(), [200, 409]); entry = await current(id);
  checks.push('portfolio-atomic-revision-conflicts');

  const imageEndpoint = origin + '/api/admin/portfolio/image?portfolioId=' + id;
  const uploadHeaders = { Origin: origin, Authorization: 'Bearer ' + ownerToken, 'Content-Type': 'image/png' };
  const raster = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
  assert.equal((await fetch(imageEndpoint, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'image/png' }, body: raster })).status, 401);
  assert.equal((await fetch(imageEndpoint, { method: 'POST', headers: uploadHeaders, body: Buffer.from('<svg onload="alert(1)"></svg>') })).status, 400);
  assert.equal((await fetch(imageEndpoint, { method: 'POST', headers: uploadHeaders, body: Buffer.alloc(2 * 1024 * 1024 + 1) })).status, 413);
  const uploaded = await fetch(imageEndpoint, { method: 'POST', headers: uploadHeaders, body: raster }); assert.equal(uploaded.status, 201);
  const image = (await uploaded.json()).image; assert.match(image, new RegExp('^' + id + '/[a-f0-9-]+\\.webp$'));
  assert.ok((await anon.storage.from('cms-portfolio-media').download(image)).error);
  const adminImage = origin + '/api/admin/portfolio/image?image=' + encodeURIComponent(image);
  assert.equal((await fetch(adminImage)).status, 401);
  assert.equal((await fetch(adminImage, { headers: { Authorization: 'Bearer ' + ordinaryToken } })).status, 401);
  const privatePreview = await fetch(adminImage, { headers: { Authorization: 'Bearer ' + ownerToken } }); assert.equal(privatePreview.status, 200);
  entry = await mutate({ action: 'save', id, expectedRevision: entry.revision, draft: { ...entry.draft, image, imageAlt: 'Private portfolio preview' } });
  await signInToAdmin();
  const portfolioTab = page.getByRole('button', { name: 'Portfolio', exact: true }); if (await portfolioTab.isVisible()) await portfolioTab.click();
  await page.getByRole('button').filter({ hasText: updatedTitle }).click();
  const preview = page.getByAltText('Private portfolio preview', { exact: true });
  await preview.waitFor(); await preview.evaluate(element => element.decode());
  assert.equal(await preview.evaluate(element => element.naturalWidth > 0), true);
  const publicImage = origin + '/api/portfolio/' + id + '/image';
  assert.equal((await fetch(publicImage)).status, 404);
  entry = await mutate({ action: 'publish', id, expectedRevision: entry.revision });
  const visible = await fetch(publicImage); assert.equal(visible.status, 200); assert.match(visible.headers.get('content-type'), /image\/webp/);
  assert.match(visible.headers.get('cache-control'), /no-store/);
  const bytes = Buffer.from(await visible.arrayBuffer()); assert.ok(bytes.length);
  entry = await mutate({ action: 'save', id, expectedRevision: entry.revision, draft: { ...entry.draft, image: '', imageAlt: '' } });
  assert.deepEqual(Buffer.from(await (await fetch(publicImage)).arrayBuffer()), bytes);
  checks.push('portfolio-private-image-upload-validation', 'portfolio-only-published-images-public');

  if (seed.length) {
    let importedEntry = await current(seed[0].id);
    const source = importedEntry.published || importedEntry.draft;
    importedEntry = await mutate({ action: 'save', id: importedEntry.id, expectedRevision: importedEntry.revision, draft: { ...source, title: 'Owner edited imported portfolio ' + id } });
    if (importedEntry.published) {
      importedEntry = await mutate({ action: 'publish', id: importedEntry.id, expectedRevision: importedEntry.revision });
      await mutate({ action: 'save', id: importedEntry.id, expectedRevision: importedEntry.revision, draft: { ...importedEntry.draft, title: 'Private owner portfolio revision ' + id, externalUrl: '' } });
    }
  }
  const tables = ['cms_portfolio', 'cms_portfolio_publications', ...(services ? ['cms_services', 'cms_service_publications'] : []), ...(contact ? ['contact_submissions'] : [])];
  const snapshots = await Promise.all(tables.map(snapshot));
  importContent();
  for (const [index, table] of tables.entries()) assert.deepEqual(await snapshot(table), snapshots[index], 'Repeat import must preserve owner data: ' + table);
  checks.push('portfolio-reimport-preserves-all-owner-content');

  entry = await current(id);
  entry = await mutate({ action: 'unpublish', id, expectedRevision: entry.revision });
  assert.equal((await fetch(origin + '/api/portfolio/' + id + '/link', { redirect: 'manual' })).status, 404);
  assert.equal(entry.published, null); assert.equal((await fetch(publicImage)).status, 404);
  assert.ok(!(await (await fetch(listing)).text()).includes(updatedTitle));
  assert.equal((await current(id)).draft.title, updatedTitle);
  checks.push('portfolio-unpublish-hides-card-retains-draft');

  const incompleteOrigin = 'http://127.0.0.1:3003';
  const incompleteServer = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '0.0.0.0', '--port', '3003'], {
    stdio: 'inherit', env: { ...process.env, SITE_URL: incompleteOrigin, SUPABASE_SECRET_KEY: '' },
  });
  try {
    let ready = false;
    for (let attempt = 0; attempt < 120; attempt++) {
      try { await fetch(incompleteOrigin + '/api/admin/portfolio'); ready = true; break; } catch {}
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    assert.equal(ready, true);
    const unavailable = await fetch(incompleteOrigin + '/api/admin/portfolio', { headers: { Authorization: 'Bearer ' + ownerToken } });
    assert.equal(unavailable.status, 503);
    assert.match((await unavailable.json()).error, /setup|configuration|configured|unavailable/i);
    checks.push('portfolio-missing-credentials-setup-error');
  } finally { incompleteServer.kill(); }
  return collectionPages.map(entry => entry.path);
}
