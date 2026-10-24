import {test,expect,type Page} from '@playwright/test';
import {createHash} from 'node:crypto';
import {setupStudio,fixtures,model} from './helpers/paper-studio';
const pdf=Buffer.from('%PDF-1.4\nExact preview test document\n%%EOF');
const digest=createHash('sha256').update(pdf).digest('hex');
async function setup(page:Page,fail=false){
 const state=fixtures();state.config.layout_style='STANDARD';(state.config as any).institution_name='Test College';
 state.papers[0].items=state.papers[0].items.map((item,i)=>({...item,snapshot:state.questions[i],question_version:1}));
 const result=await setupStudio(page,state);const downloads:URL[]=[];const previewRequests:URL[]=[];
 await page.route('**/papers/draft/export-preview?**',async route=>{
  const url=new URL(route.request().url());previewRequests.push(url);
  await route.fulfill(url.searchParams.get('output')==='PDF'?{contentType:'application/pdf',body:pdf}:{json:{render_model:model(state)}});
 });
 await page.route('**/papers/draft/export?**',async route=>{
  downloads.push(new URL(route.request().url()));await route.fulfill(fail?{status:409,json:{detail:'The document changed since its PDF preview. Preview it again before downloading.'}}:{contentType:'application/pdf',body:pdf});
 });
 await page.getByRole('button',{name:'Software Engineering Midterm',exact:true}).click();
 await page.getByRole('button',{name:'Review & Export',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Download Question Paper',exact:true});await expect(dialog).toBeVisible();
 return {...result,dialog,downloads,previewRequests};
}

test('exact PDF preview and download use identical template revision and digest',async({page})=>{
 const {dialog,downloads,previewRequests,state,pageErrors}=await setup(page);
 await dialog.getByRole('button',{name:'Preview Document',exact:true}).click();
 await expect(dialog.getByRole('region',{name:'Exact PDF preview',exact:true})).toBeVisible();
 expect(state.mutations).toEqual([]);
 await dialog.getByRole('button',{name:'Export and Download',exact:true}).click();
 await expect.poll(()=>downloads.length).toBe(1);
 for(const key of ['revision','template_id','document_type'])expect(downloads[0].searchParams.get(key)).toBe(previewRequests[0].searchParams.get(key));
 expect(downloads[0].searchParams.get('expected_sha256')).toBe(digest);
 expect(pageErrors).toEqual([]);
});

test('changing template discards old PDF preview and digest',async({page})=>{
 const {dialog,downloads}=await setup(page);
 await dialog.getByRole('button',{name:'Preview Document',exact:true}).click();await expect(dialog.getByRole('region',{name:'Exact PDF preview',exact:true})).toBeVisible();
 await dialog.getByLabel('Export template',{exact:true}).selectOption('university');
 await expect(dialog.getByRole('region',{name:'Exact PDF preview',exact:true})).toHaveCount(0);
 await dialog.getByRole('button',{name:'Export and Download',exact:true}).click();await expect.poll(()=>downloads.length).toBe(1);
 expect(downloads[0].searchParams.get('template_id')).toBe('university');expect(downloads[0].searchParams.has('expected_sha256')).toBe(false);
});

test('a changed document is blocked and asks for a fresh preview',async({page})=>{
 const {dialog}=await setup(page,true);await dialog.getByRole('button',{name:'Preview Document',exact:true}).click();await expect(dialog.getByRole('region',{name:'Exact PDF preview',exact:true})).toBeVisible();
 await dialog.getByRole('button',{name:'Export and Download',exact:true}).click();await expect(dialog.getByRole('alert')).toContainText('Preview it again before downloading.');
});

test('switching to Word clears PDF state and uses the same template for the model',async({page})=>{
 const {dialog,previewRequests}=await setup(page);await dialog.getByRole('button',{name:'Preview Document',exact:true}).click();await expect(dialog.getByRole('region',{name:'Exact PDF preview',exact:true})).toBeVisible();
 await dialog.getByLabel('Student Paper DOCX',{exact:true}).check();await expect(dialog.getByRole('region',{name:'Exact PDF preview',exact:true})).toHaveCount(0);
 await dialog.getByRole('button',{name:'Preview Document',exact:true}).click();await expect.poll(()=>previewRequests.length).toBe(2);
 expect(previewRequests[1].searchParams.get('template_id')).toBe(previewRequests[0].searchParams.get('template_id'));
 expect(previewRequests[1].searchParams.has('output')).toBe(false);
});

test('AI editor preview requests its selected template directly',async({page})=>{
 const state=fixtures();(state.config as any).institution_name='Test College';await setupStudio(page,state);const urls:URL[]=[];page.on('request',r=>urls.push(new URL(r.url())));
 await page.getByRole('button',{name:'Software Engineering Midterm',exact:true}).click();
 await expect.poll(()=>urls.filter(u=>u.pathname.endsWith('/ai-build/build/preview')).length).toBeGreaterThan(0);
 expect(urls.find(u=>u.pathname.endsWith('/ai-build/build/preview'))!.searchParams.get('template_id')).toBe('college-template');
 expect(urls.some(u=>u.pathname.includes('/templates/')&&u.pathname.endsWith('/preview'))).toBe(false);
});
