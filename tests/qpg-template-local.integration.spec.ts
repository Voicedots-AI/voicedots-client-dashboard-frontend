import {test,expect} from '@playwright/test';
import path from 'node:path';

test.skip(process.env.QPG_LOCAL_INTEGRATION!=='1','Explicit local demo integration only');
const api='/v3/college/question-papers/';
const localApi=process.env.QPG_LOCAL_API_URL||'http://127.0.0.1:8016';
const artifacts=path.resolve('../artifacts/qpg-template-audit-20261017');
test('real local template upload, live preview, activation, choose and cleanup',async({page,request})=>{
 test.setTimeout(120000);
 const health=await request.get(localApi+'/health');expect((await health.json()).database).toBe('qpg_local_preview_test');
 const login=await request.post('/v3/auth/login',{form:{email:'faculty@local.test',password:'PreviewOnly!2026'}});expect(login.ok()).toBe(true);const token=(await login.json()).access_token;const headers={Authorization:`Bearer ${token}`};
 const subjects=(await (await request.get(api+'subjects',{headers})).json()).items;const subject=subjects.find((s:any)=>s.code==='CN');expect(subject).toBeTruthy();
 const papers=(await (await request.get(api+`papers?subject_id=${subject.id}`,{headers})).json()).items;const paper=papers.find((p:any)=>p.title==='DEMO - Computer Networks Review Paper');expect(paper).toBeTruthy();const before=await (await request.get(api+`papers/${paper.id}`,{headers})).json();
 const name=`LOCAL AUDIT ${Date.now()}`;let createdId:string|undefined;
 const pageErrors:string[]=[];page.on('pageerror',e=>pageErrors.push(e.message));
 await page.addInitScript(({token,subject})=>{localStorage.setItem('access_token',token);sessionStorage.setItem('qpg-workspace-context',JSON.stringify({program:subject.program_code,branch:subject.branch_code,year:String(subject.year_number),semester:String(subject.semester_number),subject:subject.id}));sessionStorage.setItem('qpg-workspace-academic',JSON.stringify({institution_name:'',education_level:'',batch_name:'',specialization_name:'',legacy:true}));},{token,subject});
 try{
  await page.goto('/dashboard/question-papers/paper-generation');await page.getByRole('button',{name:paper.title,exact:true}).click();await page.getByRole('button',{name:'Create template',exact:true}).click();await page.getByRole('button',{name:'Upload template'}).click();
  const upload=page.getByRole('dialog',{name:'Upload template reference'});await upload.getByLabel('Format reference document').setInputFiles(path.join(artifacts,'reference.docx'));await upload.getByRole('button',{name:'Read format'}).click();
  const dialog=page.getByRole('dialog',{name:'Create template · design and exam pattern'});await expect(dialog.getByLabel('College name',{exact:true})).toHaveValue('Local Audit Engineering College');await dialog.getByLabel('Format name').fill(name);
  await expect(dialog.getByRole('checkbox',{name:/I checked/})).toBeEnabled();await dialog.getByRole('button',{name:'Exam structure',exact:true}).click();await expect(dialog.getByLabel('Maximum marks',{exact:true})).toHaveValue('100');await expect(dialog.getByLabel('Duration (minutes)',{exact:true})).toHaveValue('180');
  await page.screenshot({path:path.join(artifacts,'real-template-live-preview.png'),fullPage:true});
  await dialog.getByRole('checkbox',{name:/I checked/}).check();await dialog.getByRole('button',{name:'Save & activate'}).click();
  const chooser=page.getByRole('region',{name:'Choose template'});await expect(chooser).toBeVisible();const card=chooser.getByRole('article').filter({has:page.getByRole('heading',{name,exact:true})});await expect(card).toBeVisible();
  const rows=(await (await request.get(api+'templates',{headers})).json()).items;const created=rows.find((r:any)=>r.name===name);expect(created.status).toBe('ACTIVE');createdId=created.id;
  await card.getByRole('button',{name:'Use template'}).click();await expect(page.getByRole('navigation',{name:'Paper editing sections'})).toBeVisible();const after=await (await request.get(api+`papers/${paper.id}`,{headers})).json();expect(after.revision).toBe(before.revision);expect(after.items).toEqual(before.items);expect(after.blueprint_id).toBe(before.blueprint_id);expect(pageErrors).toEqual([]);
 }finally{
  const rows=(await (await request.get(api+'templates',{headers})).json()).items;const row=rows.find((r:any)=>r.id===createdId||r.name===name);if(row){const deleted=await request.delete(api+`templates/${row.id}`,{headers,data:{expected_revision:row.revision,confirmation:'delete'}});expect(deleted.ok()).toBe(true);}
 }
});

test('real API reads PDF and DOCX references without creating saved templates',async({request})=>{
 const health=await request.get(localApi+'/health');expect((await health.json()).database).toBe('qpg_local_preview_test');const login=await request.post('/v3/auth/login',{form:{email:'faculty@local.test',password:'PreviewOnly!2026'}});const headers={Authorization:`Bearer ${(await login.json()).access_token}`};const before=(await (await request.get(api+'templates',{headers})).json()).items.length;
 const fs=await import('node:fs/promises');for(const ext of ['pdf','docx']){const response=await request.post(api+'templates/inspect',{headers,multipart:{file:{name:`reference.${ext}`,mimeType:ext==='pdf'?'application/pdf':'application/vnd.openxmlformats-officedocument.wordprocessingml.document',buffer:await fs.readFile(path.join(artifacts,`reference.${ext}`))}}});expect(response.ok()).toBe(true);const d=await response.json();expect(d.total_marks).toBe(100);expect(d.duration_minutes).toBe(180);expect(d.sections[1].marks_each).toBe(16);}
 expect((await (await request.get(api+'templates',{headers})).json()).items.length).toBe(before);
});

test('real PDF preview equals downloaded bytes and rejects an outdated preview hash',async({request})=>{
 const health=await request.get(localApi+'/health');expect((await health.json()).database).toBe('qpg_local_preview_test');
 const login=await request.post('/v3/auth/login',{form:{email:'faculty@local.test',password:'PreviewOnly!2026'}});expect(login.ok()).toBe(true);const headers={Authorization:`Bearer ${(await login.json()).access_token}`};
 const subjects=(await (await request.get(api+'subjects',{headers})).json()).items;const subject=subjects.find((s:any)=>s.code==='CN');expect(subject).toBeTruthy();
 const papers=(await (await request.get(api+`papers?subject_id=${subject.id}`,{headers})).json()).items;const paper=papers.find((p:any)=>p.title==='DEMO - Computer Networks Review Paper');expect(paper).toBeTruthy();
 const base=api+`papers/${paper.id}`;const before=await(await request.get(base,{headers})).json();
 const query=`revision=${paper.revision}&template_id=university&document_type=STUDENT`;
 const preview=await request.get(base+`/export-preview?${query}&output=PDF`,{headers});expect(preview.ok(),await preview.text()).toBe(true);expect(preview.headers()['content-type']).toContain('application/pdf');
 const bytes=await preview.body();expect(bytes.subarray(0,5).toString()).toBe('%PDF-');const {createHash}=await import('node:crypto');const digest=createHash('sha256').update(bytes).digest('hex');
 const downloaded=await request.get(base+`/export?${query}&format=PDF&expected_sha256=${digest}`,{headers});expect(downloaded.ok()).toBe(true);expect(await downloaded.body()).toEqual(bytes);
 const stale=await request.get(base+`/export?${query}&format=PDF&expected_sha256=${'0'.repeat(64)}`,{headers});expect(stale.status()).toBe(409);expect((await stale.json()).detail).toContain('Preview it again');
 const after=await(await request.get(base,{headers})).json();expect(after.revision).toBe(before.revision);expect(after.items).toEqual(before.items);
});
