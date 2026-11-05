import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';

export async function verifyArticles({ origin, page, db, anon, ownerToken, ordinaryToken, checks, importContent, signInToAdmin, contact }) {
  const headers={Origin:origin,Authorization:'Bearer '+ownerToken,'Content-Type':'application/json'};
  const endpoint=origin+'/api/admin/articles';
  const request=(body,extra={})=>fetch(endpoint,{method:'POST',headers:{...headers,...extra},body:JSON.stringify(body)});
  async function mutate(body,status=200) {
    const response=await request(body);
    assert.equal(response.status,status,'CMS '+body.action+' returned '+response.status);
    const result=await response.json(); assert.ok(result.article);
    return result.article;
  }
  async function records() {
    const response=await fetch(endpoint,{headers}); assert.equal(response.status,200);
    const result=await response.json(); assert.ok(Array.isArray(result.articles)); return result.articles;
  }
  async function current(id) { const entry=(await records()).find(record=>record.id===id); assert.ok(entry); return entry; }
  async function publicPage(slug,status=200) {
    const response=await fetch(origin+'/articles/'+slug);
    assert.equal(response.status,status,'Public article '+slug); return response.text();
  }
  async function snapshot(table) {
    const result=await db.from(table).select('*').order('id'); assert.equal(result.error,null); return result.data;
  }
  const seed=JSON.parse(await readFile('articles-seed.json','utf8'));
  for(const file of ['articles-seed.json','project.apl.json','site-data.json','.env.local']) {
    assert.equal((await fetch(origin+'/'+file)).status,404,'Private source file must not be publicly served: '+file);
  }
  checks.push('cms-private-seed-and-source-not-served');
  const imported=await records();
  for(const entry of seed) {
    assert.ok(imported.some(record=>record.id===entry.id),'Seed record missing');
    if(!entry.published && entry.draft.slug && !seed.some(record=>record.published?.slug===entry.draft.slug)) await publicPage(entry.draft.slug,404);
    if(entry.published) {
      for(const width of [390,768,1280]) {
        await page.setViewportSize({width,height:900});
        assert.equal((await page.goto(origin+'/articles/'+entry.published.slug)).status(),200);
        await page.getByRole('heading',{name:entry.published.title,exact:true}).waitFor();
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true,'CMS detail overflow');
        if(entry.published.image) {
          const image=page.getByAltText(entry.published.imageAlt,{exact:true});
          await image.scrollIntoViewIfNeeded();
          await image.evaluate(element=>element.decode());
          assert.equal(await image.evaluate(element=>element.naturalWidth>0),true);
        }
      }
    }
  }
  for(const width of [390,768,1280]) {
    await page.setViewportSize({width,height:900});
    assert.equal((await page.goto(origin+'/articles')).status(),200);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true,'CMS listing overflow');
    for(const entry of seed.filter(record=>record.published)) assert.ok(await page.getByRole('link').filter({hasText:entry.published.title}).count());
  }
  checks.push('cms-seed-draft-private','cms-responsive-listing-and-details');

  assert.equal((await fetch(endpoint)).status,401);
  assert.equal((await fetch(endpoint,{headers:{Authorization:'Bearer '+ordinaryToken}})).status,401);
  const draftAccess=await anon.from('cms_articles').select('*');
  assert.ok(draftAccess.error || draftAccess.data.length===0,'Anonymous visitors must not read drafts');
  const ordinaryDraft=await fetch(process.env.NEXT_PUBLIC_SUPABASE_URL+'/rest/v1/cms_articles?select=*',{headers:{apikey:process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,Authorization:'Bearer '+ordinaryToken}});
  if(ordinaryDraft.ok) assert.deepEqual(await ordinaryDraft.json(),[]); else assert.ok([401,403].includes(ordinaryDraft.status));
  assert.equal((await request({action:'create',id:randomUUID(),draft:{}},{Origin:'https://untrusted.example'})).status,403);
  assert.equal((await request({action:'save',id:'not-a-uuid',expectedRevision:1,draft:{}})).status,400);
  assert.equal((await request({action:'create',id:randomUUID(),draft:{title:'x'.repeat(100_000)}})).status,413);
  checks.push('cms-authorization-and-draft-isolation','cms-origin-validation-and-payload-limits');

  const id=randomUUID(), conflictId=randomUUID(), slug='proof-'+id;
  const originalTitle='Independent published article '+id;
  const draft={title:originalTitle,slug,summary:'The original public article summary.',body:'A real article managed by the website owner.',image:'',imageAlt:''};
  let entry=await mutate({action:'create',id,draft},201);
  assert.equal(entry.published,null); assert.equal(entry.revision,1);
  await publicPage(slug,404);
  assert.equal((await fetch(origin+'/api/articles/'+id+'/image')).status,404);
  const listBefore=await (await fetch(origin+'/articles')).text(); assert.ok(!listBefore.includes(originalTitle));
  entry=await mutate({action:'publish',id,expectedRevision:entry.revision});
  assert.equal(entry.published.title,originalTitle); assert.equal(entry.publishedRevision,entry.revision);
  assert.ok((await publicPage(slug)).includes(originalTitle));

  // Exercise the actual browser admin, not only its HTTP handlers.
  await page.setViewportSize({width:1280,height:900});
  await signInToAdmin();
  const tab=page.getByRole('button',{name:'Articles',exact:true}); if(await tab.isVisible()) await tab.click();
  await page.getByRole('button').filter({hasText:originalTitle}).click();
  const updatedTitle='Unpublished revision '+id;
  await page.getByLabel('Title',{exact:true}).fill(updatedTitle);
  await page.getByLabel('Summary',{exact:true}).fill('A changed summary that must stay private until publication.');
  await page.getByLabel('Body',{exact:true}).fill('<script>window.aplInjected=true</script> Owner supplied text.');
  async function dismissDiscard(button) {
    let confirmationType;
    const dismiss=async dialog=>{confirmationType=dialog.type();await dialog.dismiss();};
    page.once('dialog',dismiss);
    try {
      await button.click();
      assert.equal(confirmationType,'confirm','Leaving unsaved article edits must ask before discarding');
    } finally { page.off('dialog',dismiss); }
    assert.equal(await page.getByLabel('Title',{exact:true}).inputValue(),updatedTitle);
    assert.equal(await page.getByLabel('Summary',{exact:true}).inputValue(),'A changed summary that must stay private until publication.');
    assert.equal(await page.getByRole('button',{name:'Sign out',exact:true}).isVisible(),true,'Dismissing discard must keep the administrator signed in');
  }
  await dismissDiscard(page.getByRole('button',{name:'Sign out',exact:true}));
  if(contact) {
    await dismissDiscard(page.getByRole('button',{name:'Inbox',exact:true}));
    assert.equal(await tab.getAttribute('aria-pressed'),'true','Dismissing discard must keep Articles selected');
  }
  checks.push('cms-unsaved-edit-guards');
  const saved=page.waitForResponse(response=>response.url()===endpoint && response.request().method()==='POST');
  await page.getByRole('button',{name:'Save draft',exact:true}).click(); assert.equal((await saved).status(),200);
  entry=await current(id); assert.equal(entry.draft.title,updatedTitle); assert.equal(entry.published.title,originalTitle);
  const unchanged=await publicPage(slug); assert.ok(unchanged.includes(originalTitle)); assert.ok(!unchanged.includes(updatedTitle));
  const publish=page.waitForResponse(response=>response.url()===endpoint && response.request().method()==='POST');
  await page.getByRole('button',{name:'Publish',exact:true}).click(); assert.equal((await publish).status(),200);
  entry=await current(id); assert.equal(entry.published.title,updatedTitle);
  await page.goto(origin+'/articles/'+slug); await page.getByRole('heading',{name:updatedTitle,exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>window.aplInjected),undefined,'CMS text must never execute as script');
  assert.ok((await publicPage(slug)).includes('&lt;script&gt;'));
  checks.push('cms-admin-save-draft-preserves-publication','cms-admin-publish-updates-public-site','cms-safe-text-rendering');

  const revisions=await Promise.all([
    request({action:'save',id,expectedRevision:entry.revision,draft:{...entry.draft,summary:'First concurrent update.'}}),
    request({action:'save',id,expectedRevision:entry.revision,draft:{...entry.draft,summary:'Second concurrent update.'}}),
  ]);
  assert.deepEqual(revisions.map(response=>response.status).sort(),[200,409]); entry=await current(id);
  const conflict=await mutate({action:'create',id:conflictId,draft:{...draft,title:'A different article using the same slug.'}},201);
  assert.equal((await request({action:'publish',id:conflict.id,expectedRevision:conflict.revision})).status,409);
  assert.equal((await current(conflict.id)).published,null); assert.ok((await publicPage(slug)).includes(updatedTitle));
  checks.push('cms-atomic-revision-conflicts','cms-unique-published-slugs');

  // Uploaded files stay in the private owner bucket; only the currently
  // published image is available through the website's public endpoint.
  const imageEndpoint=origin+'/api/admin/articles/image?articleId='+id;
  const uploadHeaders={Origin:origin,Authorization:'Bearer '+ownerToken,'Content-Type':'image/png'};
  const raster=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64');
  assert.equal((await fetch(imageEndpoint,{method:'POST',headers:{Origin:origin,'Content-Type':'image/png'},body:raster})).status,401);
  assert.equal((await fetch(imageEndpoint,{method:'POST',headers:uploadHeaders,body:Buffer.from('<svg onload="alert(1)"></svg>')})).status,400);
  assert.equal((await fetch(imageEndpoint,{method:'POST',headers:uploadHeaders,body:Buffer.alloc(2*1024*1024+1)})).status,413);
  const uploaded=await fetch(imageEndpoint,{method:'POST',headers:uploadHeaders,body:raster}); assert.equal(uploaded.status,201);
  const image=(await uploaded.json()).image; assert.match(image,new RegExp('^'+id+'/[a-f0-9-]+\\.webp$'));
  const privateObject=await anon.storage.from('cms-article-media').download(image); assert.ok(privateObject.error);
  const adminImage=origin+'/api/admin/articles/image?image='+encodeURIComponent(image);
  assert.equal((await fetch(adminImage)).status,401);
  assert.equal((await fetch(adminImage,{headers:{Authorization:'Bearer '+ordinaryToken}})).status,401);
  const preview=await fetch(adminImage,{headers:{Authorization:'Bearer '+ownerToken}}); assert.equal(preview.status,200); assert.match(preview.headers.get('content-type'),/image\/webp/);
  entry=await mutate({action:'save',id,expectedRevision:entry.revision,draft:{...entry.draft,image,imageAlt:'A private uploaded article image'}});
  await signInToAdmin();
  const articlesTab=page.getByRole('button',{name:'Articles',exact:true}); if(await articlesTab.isVisible()) await articlesTab.click();
  await page.getByRole('button').filter({hasText:updatedTitle}).click();
  const privatePreview=page.getByAltText('A private uploaded article image',{exact:true});
  await privatePreview.waitFor();
  await privatePreview.evaluate(element=>element.decode());
  assert.equal(await privatePreview.evaluate(element=>element.naturalWidth>0),true,'Admin private image must render under the site CSP');
  const publicImage=origin+'/api/articles/'+id+'/image'; assert.equal((await fetch(publicImage)).status,404);
  entry=await mutate({action:'publish',id,expectedRevision:entry.revision});
  const visible=await fetch(publicImage); assert.equal(visible.status,200); assert.match(visible.headers.get('content-type'),/image\/webp/);
  assert.match(visible.headers.get('cache-control'),/no-store/);
  const visibleBytes=Buffer.from(await visible.arrayBuffer()); assert.ok(visibleBytes.length>0);
  // Clearing the draft image must not remove the already published image.
  entry=await mutate({action:'save',id,expectedRevision:entry.revision,draft:{...entry.draft,image:'',imageAlt:''}});
  assert.deepEqual(Buffer.from(await (await fetch(publicImage)).arrayBuffer()),visibleBytes);
  checks.push('cms-private-image-upload-and-validation','cms-published-image-only');

  // Modify an imported record as well as the newly-created record. A second
  // design import must preserve the live owner's drafts and publications.
  if(seed.length) {
    let importedEntry=await current(seed[0].id);
    // An authored working draft can be incomplete or use a conflicting slug
    // while its existing publication remains valid. Publish a controlled edit
    // of the public snapshot, then preserve a separate new private revision.
    const source=importedEntry.published || importedEntry.draft;
    importedEntry=await mutate({action:'save',id:importedEntry.id,expectedRevision:importedEntry.revision,draft:{...source,title:'Owner-edited imported article '+id}});
    if(importedEntry.published) {
      importedEntry=await mutate({action:'publish',id:importedEntry.id,expectedRevision:importedEntry.revision});
      await mutate({action:'save',id:importedEntry.id,expectedRevision:importedEntry.revision,draft:{...importedEntry.draft,title:'Private owner revision '+id,slug:''}});
    }
  }
  const draftsBefore=await snapshot('cms_articles'), publicationsBefore=await snapshot('cms_article_publications');
  const inquiriesBefore=contact?await snapshot('contact_submissions'):null;
  importContent();
  assert.deepEqual(await snapshot('cms_articles'),draftsBefore);
  assert.deepEqual(await snapshot('cms_article_publications'),publicationsBefore);
  if(contact) assert.deepEqual(await snapshot('contact_submissions'),inquiriesBefore);
  checks.push('cms-reimport-preserves-owner-data');

  entry=await current(id);
  const boundLink = origin + '/api/articles/' + id + '/link';
  const rebound = await mutate({action:'save',id,expectedRevision:entry.revision,draft:{...entry.draft,slug:'changed-'+id}});
  entry = await mutate({action:'publish',id,expectedRevision:rebound.revision});
  assert.equal((await fetch(boundLink,{redirect:'manual'})).headers.get('location'),'/articles/changed-'+id);
  entry=await mutate({action:'unpublish',id,expectedRevision:entry.revision}); assert.equal(entry.published,null);
  assert.equal((await fetch(boundLink,{redirect:'manual'})).status,404);
  await publicPage(slug,404); assert.equal((await fetch(publicImage)).status,404);
  assert.ok(!(await (await fetch(origin+'/articles')).text()).includes(updatedTitle));
  assert.equal((await current(id)).draft.title,updatedTitle,'Unpublishing must retain the draft');
  checks.push('cms-unpublish-removes-public-access-keeps-draft', 'article-record-links-follow-published-slug-changes');

  const incompleteOrigin='http://127.0.0.1:3002';
  const incompleteServer=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','0.0.0.0','--port','3002'],{
    stdio:'inherit',env:{...process.env,SITE_URL:incompleteOrigin,SUPABASE_SECRET_KEY:''},
  });
  try {
    let ready=false;
    for(let attempt=0;attempt<120;attempt++) {
      try { await fetch(incompleteOrigin+'/api/admin/articles'); ready=true; break; } catch {}
      await new Promise(resolve=>setTimeout(resolve,250));
    }
    assert.equal(ready,true,'Missing-credentials test server did not start');
    const unavailable=await fetch(incompleteOrigin+'/api/admin/articles',{headers:{Authorization:'Bearer '+ownerToken}});
    assert.equal(unavailable.status,503);
    assert.match((await unavailable.json()).error,/setup|configuration|configured|unavailable/i);
    checks.push('cms-missing-credentials-useful-setup-error');
  } finally { incompleteServer.kill(); }
  return ['/articles',...seed.filter(record=>record.published).map(record=>'/articles/'+record.published.slug)];
}
