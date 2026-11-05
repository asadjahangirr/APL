import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { chromium } from '@playwright/test';
import { redactCommandOutput } from '../scripts/command-output.mjs';
if (process.env.VERIFY_RUN !== 'isolated') throw new Error('Use npm run verify. These tests require the isolated Docker network.');
const manifest = JSON.parse(await readFile('export-manifest.json','utf8'));
const site = JSON.parse(await readFile('site-data.json','utf8'));
const backup = JSON.parse(await readFile('project.apl.json','utf8'));
const origin = 'http://127.0.0.1:3000';
const contact = manifest.modules.includes('contact');
const cms = manifest.modules.includes('services-cms');
const portfolio = manifest.modules.includes('portfolio-cms');
const articles = manifest.modules.includes('articles-cms');
const backend = contact || cms || portfolio || articles;
const layoutKinds = new Set(['Section','Columns','Column','Heading','Paragraph','Image','Button','Icon']);
const walk = nodes => nodes.flatMap(node => [node, ...walk(node.children || [])]);
const responsive = (value,width) => width >= 1024 ? value.desktop ?? value.tablet ?? value.mobile : width >= 768 ? value.tablet ?? value.mobile : value.mobile;
const proportions = { stack:[1], halves:[1,1], thirds:[1,1,1], quarters:[1,1,1,1], 'one-two':[1,2], 'two-one':[2,1], 'one-three':[1,3], 'three-one':[3,1] };
const layoutPages = site.pages.filter(entry=>walk(entry.nodes).some(node=>layoutKinds.has(node.type)));
const server = spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','0.0.0.0'],{stdio:'inherit'});
const checks = []; const diagnostics = []; let browser; let notificationServer; let page;
let db; let anon; let email; let password; let ownerToken; let ordinaryToken; let cmsPagesVerified=[]; let portfolioPagesVerified=[]; let articlePagesVerified=[]; let contactPagesVerified=[];
function importContent() {
  assert.equal(process.env.NEXT_PUBLIC_SUPABASE_URL,'http://verification-backend:8000','Seed import must use the disposable database');
  // Exercise the same selected-module dispatcher as the owner's setup command.
  // Test credentials come only from this isolated process environment.
  const result=spawnSync(process.execPath,['scripts/setup-content.mjs'],{encoding:'utf8',env:process.env});
  if(result.error || result.status!==0) throw new Error('Initial content import failed: '+redactCommandOutput((result.stderr || result.stdout || '').slice(-1200)));
}
async function signInToAdmin() {
  await page.goto(origin+'/admin');
  const login=page.getByRole('button',{name:'Sign in',exact:true});
  if(await login.isVisible()) {
    await page.getByLabel('Email',{exact:true}).fill(email);
    await page.getByLabel('Password',{exact:true}).fill(password);
    await login.click();
    await page.getByRole('button',{name:'Sign out',exact:true}).waitFor();
  }
}
try {
  for(let i=0;i<120;i++) { try { const r=await fetch(origin); if(r.ok) break; } catch {} await new Promise(r=>setTimeout(r,250)); }
  assert.equal((await fetch(origin)).status,200);
  let escaped = false;
  try { await fetch('https://example.com',{signal:AbortSignal.timeout(3000)}); escaped=true; } catch {}
  assert.equal(escaped,false,'Runtime must have no internet access'); checks.push('external-network-blocked');
  if(backend) {
    const { createClient } = await import('@supabase/supabase-js');
    assert.equal(process.env.NEXT_PUBLIC_SUPABASE_URL,'http://verification-backend:8000');
    db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false}});
    const visitorClient=()=>createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
    anon = visitorClient();
    const ownerAuth=visitorClient(), ordinaryAuth=visitorClient();
    email='owner-'+randomUUID()+'@example.test'; password=randomUUID()+randomUUID();
    const account = await db.auth.admin.createUser({email,password,email_confirm:true});
    assert.equal(account.error,null); assert.ok(account.data.user);
    const grant=await db.from('site_admins').insert({user_id:account.data.user.id}); assert.equal(grant.error,null);
    const ownerSignIn=await ownerAuth.auth.signInWithPassword({email,password}); assert.equal(ownerSignIn.error,null);
    ownerToken=ownerSignIn.data.session.access_token;
    const registration = await anon.auth.signUp({email:'uninvited-'+randomUUID()+'@example.test',password});
    assert.equal(registration.error?.code,'signup_disabled'); assert.equal(registration.data.user,null);
    checks.push('public-registration-disabled');
    const ordinary=await db.auth.admin.createUser({email:'visitor-'+randomUUID()+'@example.test',password,email_confirm:true}); assert.equal(ordinary.error,null);
    const signIn=await ordinaryAuth.auth.signInWithPassword({email:ordinary.data.user.email,password}); assert.equal(signIn.error,null);
    ordinaryToken=signIn.data.session.access_token;
    const roleAttack=await ordinaryAuth.from('site_admins').insert({user_id:ordinary.data.user.id}); assert.ok(roleAttack.error);
    // Keep these isolated test sessions alive. Signing out deletes the Auth
    // session, so getUser would reject its token before role checks could run.
    const activeOwner=await db.auth.getUser(ownerToken), activeOrdinary=await db.auth.getUser(ordinaryToken);
    assert.equal(activeOwner.error,null); assert.equal(activeOwner.data.user.id,account.data.user.id);
    assert.equal(activeOrdinary.error,null); assert.equal(activeOrdinary.data.user.id,ordinary.data.user.id);
    assert.equal((await anon.auth.getSession()).data.session,null,'Anonymous RLS checks must use an unauthenticated client');
    checks.push('active-owner-and-ordinary-test-sessions');
    checks.push('role-escalation-denied');
  }
  if(cms || portfolio || articles) { importContent(); checks.push('initial-content-import'); }
  for (const [enabled, collection, seedFile] of [[cms, 'services', 'content-seed.json'], [articles, 'articles', 'articles-seed.json'], [portfolio, 'portfolio', 'portfolio-seed.json']]) {
    if (!enabled) continue;
    const seed = JSON.parse(await readFile(seedFile, 'utf8'));
    for (const entry of seed) {
      const response = await fetch(origin + '/api/' + collection + '/' + entry.id + '/link', { redirect: 'manual' });
      assert.equal(response.status, entry.published ? 307 : 404, 'Only published CMS identities resolve');
      if (!entry.published) continue;
      const payload = entry.published;
      const expected = collection !== 'portfolio' ? '/' + collection + '/' + payload.slug
        : payload.target ? site.pages.find(page => page.id === payload.target.pageId).path + (payload.target.anchor === '#top' ? '' : payload.target.anchor) : payload.externalUrl;
      assert.equal(response.headers.get('location'), expected);
      assert.match(response.headers.get('cache-control'), /no-store/);
    }
    assert.equal((await fetch(origin + '/api/' + collection + '/invalid/link', { redirect: 'manual' })).status, 400);
    assert.equal((await fetch(origin + '/api/' + collection + '/' + randomUUID() + '/link', { redirect: 'manual' })).status, 404);
    checks.push(collection + '-stable-published-links');
  }
  browser = await chromium.launch({headless:true});
  const context = await browser.newContext();
  const allowed = new Set([origin]);
  if(backend) allowed.add(new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin);
  const unexpected = [];
  await context.route('**/*',route=>{
    const url = new URL(route.request().url());
    if (!allowed.has(url.origin)) { unexpected.push(url.origin); return route.abort(); }
    return route.continue();
  });
  page = await context.newPage();
  page.on('console', message => { if (message.type() === 'error') diagnostics.push(redactCommandOutput(message.text())); });
  page.on('pageerror', error => diagnostics.push(redactCommandOutput(error.message)));
  page.on('requestfailed', request => { const url = new URL(request.url()); diagnostics.push(url.origin + url.pathname + ': ' + request.failure()?.errorText); });
  page.on('response', response => { if (response.status() >= 400) { const url = new URL(response.url()); diagnostics.push(response.status() + ' ' + url.origin + url.pathname); } });
  for(const width of [390,768,1280]) for(const entry of site.pages) {
    await page.setViewportSize({width,height:900});
    assert.equal((await page.goto(origin + entry.path)).status(),200);
    assert.equal(await page.locator('main.site').count(),1);
    assert.equal(await page.locator('main.site').getAttribute('data-page-id'),entry.id);
    assert.equal(await page.title(),entry.title);
    if (entry.description) assert.equal(await page.locator('meta[name="description"]').getAttribute('content'),entry.description);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth <= window.innerWidth),true,'Horizontal overflow at '+width);
    for(const img of await page.locator('img').all()) {
      // Below-fold images intentionally load lazily. Trigger their real load,
      // then fail within a bounded time if the local exported asset is broken.
      await img.scrollIntoViewIfNeeded({timeout:10_000});
      const handle=await img.elementHandle(); assert.ok(handle);
      try { await page.waitForFunction(image=>image.complete && image.naturalWidth>0,handle,{timeout:10_000}); }
      finally { await handle.dispose(); }
      assert.equal(await img.evaluate(image=>image.complete && image.naturalWidth>0),true,'Exported image failed to load');
    }
    const headerVisible=site.shared.header.enabled && entry.showHeader!==false;
    const footerVisible=site.shared.footer.enabled && entry.showFooter!==false;
    assert.equal(await page.locator('.site-header').count(),headerVisible?1:0,'Page header visibility');
    if(headerVisible) assert.equal(await page.locator('.site-brand').textContent(),site.shared.header.props.brand);
    assert.equal(await page.locator('.site-footer').count(),footerVisible?1:0,'Page footer visibility');
    const layoutNodes = walk(entry.nodes).filter(node=>layoutKinds.has(node.type));
    assert.deepEqual(await page.locator('[data-layout-node]').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('data-layout-node'))),layoutNodes.map(node=>node.id),'Nested component order must match the project document');
    for(const node of layoutNodes) {
      const locator = page.locator('[data-layout-node="'+node.id+'"]');
      assert.equal(await locator.count(),1,'Missing or repeated layout node '+node.id);
      if (node.type === 'Icon') {
        const icon = locator.locator('.apl-icon'), svg = icon.locator('svg');
        const size = await svg.evaluate(element => ({ width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height }));
        assert.ok(Math.abs(size.width - responsive(node.props.size, width)) < 0.1 && Math.abs(size.height - responsive(node.props.size, width)) < 0.1, 'Responsive icon dimensions');
        assert.equal(await svg.getAttribute('aria-hidden'), 'true');
        if (node.props.target || node.props.destination) {
          const action = node.props.destination;
          const target = node.props.target && site.pages.find(page => page.id === node.props.target.pageId);
          const href = action ? 'entryId' in action ? '/api/' + (action.kind === 'service' ? 'services' : action.kind === 'article' ? 'articles' : 'portfolio') + '/' + action.entryId + '/link'
            : action.kind === 'url' ? action.value : action.kind === 'email' ? 'mailto:' + action.value : 'tel:' + action.value.replace(/[ ()-]/g, '')
            : target.path + (node.props.target.anchor === '#top' ? '' : node.props.target.anchor);
          assert.equal(await icon.getAttribute('href'), href);
          assert.equal(await icon.getAttribute('aria-label'), node.props.label);
          if (action?.kind === 'url') {
            assert.equal(await icon.getAttribute('target'), '_blank');
            assert.match(await icon.getAttribute('rel'), /noopener/);
          }
        } else if (!node.props.decorative) {
          assert.equal(await icon.getAttribute('role'), 'img');
          assert.equal(await icon.getAttribute('aria-label'), node.props.label);
        }
      }
      if(node.type==='Section') {
        const padding = await locator.evaluate(element=>({top:parseFloat(getComputedStyle(element).paddingTop),bottom:parseFloat(getComputedStyle(element).paddingBottom)}));
        const expectedPadding=responsive(node.props.appearance?.paddingY ?? node.props.padding,width);
        assert.ok(Math.abs(padding.top-expectedPadding)<0.01,'Section top padding at '+width);
        assert.ok(Math.abs(padding.bottom-expectedPadding)<0.01,'Section bottom padding at '+width);
        if(node.props.appearance?.paddingX) {
          const sides=await locator.evaluate(element=>({left:parseFloat(getComputedStyle(element).paddingLeft),right:parseFloat(getComputedStyle(element).paddingRight)}));
          const expected=responsive(node.props.appearance.paddingX,width);
          assert.ok(Math.abs(sides.left-expected)<0.01 && Math.abs(sides.right-expected)<0.01,'Authored section horizontal padding at '+width);
        }
        const bounds=await locator.evaluate(element=>{
          const style=getComputedStyle(element),outer=element.getBoundingClientRect(),inner=element.querySelector(':scope > .apl-section-content').getBoundingClientRect();
          return { available:element.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight),left:outer.left+parseFloat(style.borderLeftWidth)+parseFloat(style.paddingLeft),innerLeft:inner.left,innerWidth:inner.width };
        });
        const limit=node.props.appearance?.maxWidth?responsive(node.props.appearance.maxWidth,width):node.props.width==='content'?1120:node.props.width==='wide'?1440:Infinity;
        const contentWidth=Math.min(bounds.available,limit);
        assert.ok(Math.abs(bounds.innerWidth-contentWidth)<1,'Section content width at '+width);
        assert.ok(Math.abs(bounds.innerLeft-(bounds.left+(bounds.available-contentWidth)/2))<1,'Section content centering at '+width);
        if(node.props.appearance?.gap) assert.ok(Math.abs(await locator.locator(':scope > .apl-section-content').evaluate(element=>parseFloat(getComputedStyle(element).gap))-responsive(node.props.appearance.gap,width))<0.01,'Authored section content gap at '+width);
      }
      if(node.type==='Column'||node.type==='Columns') {
        const content = locator.locator(node.type==='Columns'?':scope > .apl-column-grid':':scope > .apl-column-content');
        const gap = await content.evaluate(element=>parseFloat(getComputedStyle(element).gap));
        assert.ok(Math.abs(gap-responsive(node.props.appearance?.gap ?? node.props.gap,width))<0.01,'Layout gap at '+width);
      }
      if(node.type==='Columns') {
        const grid=locator.locator(':scope > .apl-column-grid');
        const tracks = await grid.evaluate(element=>getComputedStyle(element).gridTemplateColumns.split(' ').map(value=>parseFloat(value)));
        const expected = proportions[responsive(node.props.layout,width)];
        assert.equal(tracks.length,expected.length,'Preset column count at '+width);
        const unit = tracks.reduce((total,value)=>total+value,0)/expected.reduce((total,value)=>total+value,0);
        for(let index=0;index<tracks.length;index++) assert.ok(Math.abs(tracks[index]-unit*expected[index])<1,'Preset column ratio at '+width);
        assert.equal(await grid.evaluate(element=>getComputedStyle(element).alignItems),node.props.align,'Column alignment setting at '+width);
        const columns=await grid.locator(':scope > .apl-column').evaluateAll(elements=>elements.map(element=>{
          const rect=element.getBoundingClientRect(); return {top:rect.top,height:rect.height,center:rect.top+rect.height/2};
        }));
        for(let start=0;start<columns.length;start+=expected.length) {
          const row=columns.slice(start,start+expected.length),first=row[0];
          for(const column of row.slice(1)) {
            const edge=node.props.align==='center'?'center':'top';
            assert.ok(Math.abs(column[edge]-first[edge])<1,'Rendered column '+node.props.align+' alignment at '+width);
            if(node.props.align==='stretch') assert.ok(Math.abs(column.height-first.height)<1,'Stretched columns must have equal row heights at '+width);
          }
        }
      }
      if(node.type==='Column') {
        const align=node.props.align==='start'?'flex-start':node.props.align==='end'?'flex-end':'center';
        assert.equal(await locator.locator(':scope > .apl-column-content').evaluate(element=>getComputedStyle(element).justifyContent),align,'Column content alignment at '+width);
      }
      if(node.props.appearance && ['Heading','Paragraph','Image','Button'].includes(node.type)) {
        const authored=node.type==='Button'?locator.locator('a.apl-link-button'):locator;
        const measured=await authored.evaluate(element=>{const style=getComputedStyle(element);return {fontFamily:style.fontFamily,fontSize:parseFloat(style.fontSize),fontWeight:style.fontWeight,lineHeight:parseFloat(style.lineHeight),maxWidth:parseFloat(style.maxWidth),minHeight:parseFloat(style.minHeight),radius:parseFloat(style.borderTopLeftRadius)};});
        const appearance=node.props.appearance;
        if(appearance.fontFamily) assert.equal(measured.fontFamily,responsive(appearance.fontFamily,width),'Authored font family at '+width);
        if(appearance.fontSize) assert.ok(Math.abs(measured.fontSize-responsive(appearance.fontSize,width))<0.01,'Authored font size at '+width);
        if(appearance.fontWeight) assert.equal(measured.fontWeight,String(responsive(appearance.fontWeight,width)),'Authored font weight at '+width);
        if(appearance.lineHeight) assert.ok(Math.abs(measured.lineHeight-measured.fontSize*responsive(appearance.lineHeight,width))<0.02,'Authored line height at '+width);
        for(const [field,key] of [['maxWidth','maxWidth'],['minHeight','minHeight'],['radius','radius']]) if(appearance[field]) assert.ok(Math.abs(measured[key]-responsive(appearance[field],width))<0.01,'Authored '+field+' at '+width);
        if(node.type==='Image' && appearance.aspectRatio) {
          const ratio=await authored.evaluate(element=>{const box=element.getBoundingClientRect();return box.width/box.height;});
          assert.ok(Math.abs(ratio-responsive(appearance.aspectRatio,width))<0.02,'Authored image aspect ratio at '+width);
        }
      }
    }
  }
  if(layoutPages.length) {
    checks.push('responsive-nested-layouts','nested-content-order');
    await page.setViewportSize({width:1280,height:900});
    const hasButtons=layoutPages.some(entry=>walk(entry.nodes).some(node=>node.type==='Button'));
    for(const entry of layoutPages) for(const node of walk(entry.nodes).filter(node=>node.type==='Button')) {
      await page.goto(origin+entry.path);
      const button=page.locator('[data-layout-node="'+node.id+'"] a.apl-link-button');
      if(node.props.destination) {
        const action=node.props.destination;
        if (['service','article','portfolio'].includes(action.kind)) {
          const collection = action.kind === 'service' ? 'services' : action.kind === 'article' ? 'articles' : 'portfolio';
          const href = '/api/' + collection + '/' + action.entryId + '/link';
          assert.equal(await button.getAttribute('href'), href, 'CMS button uses stable record identity');
          const response = await fetch(origin + href, { redirect: 'manual' });
          assert.equal(response.status, 307, 'CMS button resolves a published destination');
          assert.ok(response.headers.get('location'));
          continue;
        }
        const href=action.kind==='url'?action.value:action.kind==='email'?'mailto:'+action.value:'tel:'+action.value.replace(/[ ()-]/g,'');
        assert.equal(await button.getAttribute('href'),href,'Explicit button destination');
        if(action.kind==='url') { assert.equal(await button.getAttribute('target'),'_blank'); const rel=(await button.getAttribute('rel')||'').split(/\s+/); assert.ok(rel.includes('noopener') && rel.includes('noreferrer'),'External links must isolate their opener'); }
        else assert.equal(await button.getAttribute('target'),null);
        continue; // Contract checks do not contact real external websites or launch mail/phone handlers.
      }
      const destination=site.pages.find(target=>target.id===node.props.target.pageId);
      assert.ok(destination,'Button target page is missing');
      const href=destination.path+(node.props.target.anchor==='#top'?'':node.props.target.anchor);
      assert.equal(await button.getAttribute('href'),href);
      await button.click(); await page.waitForURL(origin+href);
      assert.equal(await page.locator('main.site').getAttribute('data-page-id'),destination.id);
    }
    if(hasButtons) checks.push('nested-button-navigation');
    await page.emulateMedia({reducedMotion:'reduce'});
    for(const entry of layoutPages) {
      await page.goto(origin+entry.path);
      for(const button of await page.locator('.apl-link-button').all()) {
        await button.hover();
        const times=await button.evaluate(element=>[element,...element.querySelectorAll('*')].flatMap(item=>{
          const style=getComputedStyle(item);
          return [style.transitionDuration,style.animationDuration].flatMap(value=>value.split(',').map(time=>parseFloat(time)*(time.trim().endsWith('ms')?0.001:1)));
        }));
        assert.ok(times.every(time=>time<=0.001),'Reduced-motion preference must suppress button animation');
        assert.equal(await button.evaluate(element=>getComputedStyle(element).transform),'none','Reduced motion must suppress button lift');
        for(const arrow of await button.locator('.apl-button-arrow').all()) assert.equal(await arrow.evaluate(element=>getComputedStyle(element).transform),'none','Reduced motion must suppress animated arrows');
      }
    }
    await page.emulateMedia({reducedMotion:'no-preference'});
    if(hasButtons) checks.push('reduced-motion-respected');
  }
  const navigationSource=site.pages.find(entry=>entry.showHeader!==false);
  if(site.shared.header.enabled && navigationSource) for(const width of [390,1280]) {
    await page.setViewportSize({width,height:900});
    for(const entry of site.pages.filter(entry=>entry.inNavigation)) {
      await page.goto(origin+navigationSource.path);
      if(width<768) await page.locator('.site-mobile-nav summary').click();
      await page.locator('nav:visible a[href="'+entry.path+'"]').click();
      await page.waitForURL(origin + entry.path);
      assert.equal(await page.locator('main.site').getAttribute('data-page-id'),entry.id);
      assert.equal(await page.locator('nav:visible a[aria-current="page"]').count(),width<768||entry.showHeader===false?0:1);
    }
    await page.goto(origin+navigationSource.path);
    for(const entry of site.pages.filter(entry=>!entry.inNavigation)) assert.equal(await page.locator('nav a[href="'+entry.path+'"]').count(),0);
  }
  assert.equal((await fetch(origin+'/verification-missing-'+randomUUID())).status,404);
  checks.push('responsive-public-website','all-page-routes-and-metadata','shared-navigation','unknown-page-404');
  if(contact) {
    const denied = await anon.from('contact_submissions').select('*'); assert.ok(denied.error);
    assert.equal((await fetch(origin+'/api/admin/submissions')).status,401);
    const send=payload=>fetch(origin+'/api/contact',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(payload)});
    assert.equal((await send({name:'x',email:'bad',message:'short',website:''})).status,400);
    assert.equal((await fetch(origin+'/api/contact',{method:'POST',headers:{Origin:origin,'Content-Type':'text/plain'},body:'{}'})).status,415);
    assert.equal((await send({name:'Oversize',email:'visitor@example.test',message:'x'.repeat(21_000),website:''})).status,413);
    assert.equal((await fetch(origin+'/api/contact',{method:'POST',headers:{Origin:'https://untrusted.example','Content-Type':'application/json'},body:'{}'})).status,403);
    const marker='Proof '+randomUUID();
    const contactPages=site.pages.filter(entry=>walk(entry.nodes).some(node=>node.type==='Contact'));
    const conversion=(backup.conversions||[]).slice().sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)).find(record=>contactPages.some(entry=>entry.id===record.pageId && entry.nodes.some(node=>node.type==='Contact' && record.targetRootIds.includes(node.id))));
    const contactPage = (conversion && contactPages.find(entry=>entry.id===conversion.pageId)) || contactPages.find(entry=>entry.nodes.some(node=>node.type==='Section')) || contactPages[0];
    assert.ok(contactPage,'The selected contact module needs a public form page');
    await page.goto(origin+contactPage.path); await page.getByLabel('Your name').fill(marker);
    await page.getByLabel('Email address').fill('visitor@example.test');
    await page.getByLabel('What are you working on?').fill('Please tell me more about your services.');
    await page.locator('#contact button').click();
    await page.getByRole('status').filter({hasText:'Your message has been received'}).waitFor();
    const row=await db.from('contact_submissions').select('*').eq('name',marker).single(); assert.equal(row.error,null); assert.equal(row.data.email_status,'not_configured');
    contactPagesVerified.push(contactPage.path);
    if(conversion) checks.push('converted-contact-page-submission');
    await signInToAdmin();
    const inboxTab=page.getByRole('button',{name:'Inbox',exact:true});
    if(await inboxTab.isVisible()) await inboxTab.click();
    await page.getByRole('heading',{name:marker}).waitFor();
    await page.getByRole('button',{name:'Mark as read'}).first().click();
    await page.getByText(/read · Email/).first().waitFor();
    const updated=await db.from('contact_submissions').select('status').eq('id',row.data.id).single(); assert.equal(updated.data.status,'read');
    assert.equal((await fetch(origin+'/api/admin/submissions',{headers:{Authorization:'Bearer '+ordinaryToken}})).status,401);
    const limitEmail='limit-'+randomUUID()+'@example.test';
    const statuses=await Promise.all(Array.from({length:7},()=>send({name:'Rate test',email:limitEmail,message:'Concurrency verification message.',website:''}).then(r=>r.status)));
    assert.equal(statuses.filter(s=>s===201).length,5); assert.equal(statuses.filter(s=>s===429).length,2);
    // A second real server has deliberately fake provider credentials. The
    // internal Docker network blocks delivery; the stored inquiry must survive.
    const notificationOrigin='http://127.0.0.1:3001';
    notificationServer=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','0.0.0.0','--port','3001'],{
      stdio:'inherit',env:{...process.env,SITE_URL:notificationOrigin,BREVO_API_KEY:'verification-only-not-a-real-key',BREVO_SENDER_EMAIL:'sender@example.test',CONTACT_NOTIFY_EMAIL:'owner@example.test'}
    });
    for(let i=0;i<120;i++) { try { const r=await fetch(notificationOrigin); if(r.ok) break; } catch {} await new Promise(r=>setTimeout(r,250)); }
    const failureMarker='Notification failure '+randomUUID();
    const failedNotification=await fetch(notificationOrigin+'/api/contact',{method:'POST',headers:{Origin:notificationOrigin,'Content-Type':'application/json'},body:JSON.stringify({name:failureMarker,email:'notification@example.test',message:'Keep this inquiry even when email cannot be delivered.',website:''})});
    assert.equal(failedNotification.status,201);
    const retained=await db.from('contact_submissions').select('email_status').eq('name',failureMarker).single();
    assert.equal(retained.error,null); assert.equal(retained.data.email_status,'failed');
    checks.push('notification-failure-preserves-message','bounded-form-payload');
    checks.push('database-persistence','administrator-login-and-inbox','mark-read','unauthorized-access-denied','cross-origin-rejected','input-validation','atomic-rate-limit','email-unconfigured-preserves-message');
  } else {
    assert.equal((await fetch(origin+'/api/contact',{method:'POST'})).status,404);
    assert.equal((await fetch(origin+'/api/admin/submissions')).status,404);
    checks.push('unused-contact-backend-absent');
  }
  if(!backend) { assert.equal((await fetch(origin+'/admin')).status,404); checks.push('unused-backend-absent'); }
  if(cms) {
    const { verifyServices }=await import('./services-cms.mjs');
    cmsPagesVerified=await verifyServices({origin,page,db,anon,ownerToken,ordinaryToken,checks,importContent,signInToAdmin,contact});
  } else {
    assert.equal((await fetch(origin+'/api/admin/services')).status,404);
    checks.push('unused-cms-backend-absent');
  }
  if(portfolio) {
    const { verifyPortfolio }=await import('./portfolio-cms.mjs');
    portfolioPagesVerified=await verifyPortfolio({origin,page,db,anon,ownerToken,ordinaryToken,checks,importContent,signInToAdmin,contact,services:cms,site});
  } else {
    assert.equal((await fetch(origin+'/api/admin/portfolio')).status,404);
    checks.push('unused-portfolio-backend-absent');
  }
  if(articles) {
    const { verifyArticles }=await import('./articles-cms.mjs');
    articlePagesVerified=await verifyArticles({origin,page,db,anon,ownerToken,ordinaryToken,checks,importContent,signInToAdmin,contact});
  } else {
    assert.equal((await fetch(origin+'/api/admin/articles')).status,404);
    checks.push('unused-articles-backend-absent');
  }
  assert.deepEqual(unexpected,[],'Unexpected external browser request');
  await writeFile('/report/verification-report.json',JSON.stringify({status:'passed',contentHash:manifest.contentHash,checks,modulesVerified:manifest.modules,pagesVerified:site.pages.map(page=>page.path),layoutPagesVerified:layoutPages.map(page=>page.path),contactPagesVerified,cmsPagesVerified,portfolioPagesVerified,articlePagesVerified,checkedAt:new Date().toISOString()},null,2));
} catch(error) {
  // Test-only values are used throughout. Never log request headers or bodies.
  let visibleStatus = '';
  try { visibleStatus = await page?.getByRole('status').allTextContents(); } catch {}
  console.error('Runtime test diagnostics: ' + redactCommandOutput(JSON.stringify({ checks, browserErrors: diagnostics.slice(-12), visibleStatus })));
  throw error;
} finally { if(browser) await browser.close(); notificationServer?.kill(); server.kill(); }
