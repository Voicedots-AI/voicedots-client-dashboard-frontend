import {test,expect} from '@playwright/test';
for(const missing of [false,true])test(`background extraction resumes, preselects context and handles missing codes (${missing})`,async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('access_token','test-session'));
 let polls=0;let saved:Record<string,unknown>|undefined;let imported:Record<string,unknown>|undefined;
 const course={extraction_id:'record-1',code_missing:missing,code:missing?'':'DS1',name:'Data Structures',year_number:2,semester_number:3,cos:[{code:'CO1',title:'Understand trees',source_page:1}],units:[{code:'U1',title:'Trees',source_page:1,topics:[{code:'T1',title:'Binary trees',source_page:1}]}],warnings:[],academic_metadata:{institution_name:{value:'JNTUH',source:'JNTUH'},education_level:{value:'Undergraduate',source:'B.Tech.'},batch_name:{value:'2022-23',source:'AY 2022-23 Batch'},degree_name:{value:'B.Tech',source:'B.Tech.'},department_name:{value:'CSE',source:'Computer Science and Engineering'},specialization_name:{value:'AI & ML',source:'AI & ML'}}};
 await page.route(/\/v[13]\//,async route=>{
  const path=new URL(route.request().url()).pathname;let json:unknown={items:[]};
  if(path.endsWith('/users/me'))json={user_id:'faculty',name:'Faculty'};
  if(path.endsWith('/college/access'))json={enabled:true,college_name:'Local College'};
  if(path.endsWith('/academic-options'))json={programs:[{code:'BTECH',display_name:'Bachelor of Technology',duration_years:4,departments:[{code:'CSE',display_name:'Computer Science and Engineering'}]}],academic_contexts:[],erp_subjects:[],can_setup:true,can_write:true};
  if(path.endsWith('/syllabus/extract')){
   const request=route.request();
   expect(request.headers()['content-type']).toContain('multipart/form-data; boundary=');
   expect(request.postData()).toContain('name="file"; filename="MBA.pdf"');
   expect(request.postData()).toContain('name="background"');
   json={id:'doc',courses:[],extraction_status:'PROCESSING'};
  }
  if(path.endsWith('/curricula'))json={items:[{id:'doc',filename:'Other layout.pdf',course_count:0}]};
  if(path.endsWith('/curricula/doc'))json=++polls===1?{id:'doc',courses:[],extraction_status:'PROCESSING',progress:{stage:'Reading source pages',done:1,total:4}}:{id:'doc',courses:[course],extraction_status:'COMPLETED'};
  if(path.endsWith('/subjects/from-curriculum')){saved=route.request().postDataJSON();json={...saved,id:'subject'};}
  if(path.endsWith('/subjects/subject/syllabus'))json={current:{status:'DRAFT',revision:1},structure:{cos:[],units:[],topics:[],course:{}}};
  if(path.endsWith('/syllabus/import')){imported=route.request().postDataJSON();json={};}
  await route.fulfill({json});
 });
 await page.goto('/dashboard/question-papers');
 if(missing)await page.getByLabel('Saved curricula').selectOption('doc');
 else{
  await page.getByText('Upload a new curriculum',{exact:true}).click();
  await page.getByLabel('Curriculum document').setInputFiles({name:'MBA.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4 test upload')});
  await page.getByRole('button',{name:'Upload & extract courses'}).click();
 }
 await expect(page.getByText('Reading source pages · 1 / 4')).toBeVisible();
 await expect(page.getByLabel('Degree',{exact:true})).toHaveValue('BTECH');
 await expect(page.getByLabel('Department',{exact:true})).toHaveValue('CSE');
 await expect(page.getByLabel('Institution',{exact:true})).toHaveValue('JNTUH');
 await expect(page.getByLabel('Year',{exact:true})).toHaveValue('2');
 await page.getByLabel('Curriculum subject').selectOption('record-1');
 const next=page.getByRole('button',{name:'Continue to Syllabus Master'});
 if(missing){await expect(next).toBeDisabled();await page.getByLabel('Missing course code').fill('FACULTY-DS');}
 await expect(next).toBeEnabled();await next.click();
 await expect.poll(()=>saved?.code).toBe(missing?'FACULTY-DS':'DS1');
 await expect(page.getByRole('heading',{name:'Review syllabus · Data Structures'})).toBeVisible();
 await page.getByRole('checkbox',{name:'I have checked the course load, outcomes, units and topics against the document.'}).check();
 await page.getByRole('button',{name:'Save draft & continue'}).click();
 await expect.poll(()=>imported?.cos).toEqual([{code:'CO1',title:'Understand trees'}]);
 expect(imported?.units).toEqual([{code:'U1',title:'Trees',topics:[{code:'T1',title:'Binary trees'}]}]);
});

for(const scenario of [
 {name:'progress connection failure',response:{id:'doc',courses:[],extraction_status:'PROCESSING'},message:'Your document is saved; reopen it from Saved curricula.'},
 {name:'missing response fields',response:{},message:'The extraction response is incomplete.'},
 {name:'missing job identity',response:{courses:[],extraction_status:'PROCESSING'},message:'Extraction status is unavailable.'},
 {name:'empty completed result',response:{courses:[],extraction_status:'COMPLETED'},message:'No courses were found.'},
 {name:'malformed course',response:{courses:[{name:'MBA',code:'MBA1'}],extraction_status:'COMPLETED'},message:'The extracted course data is incomplete.'},
 {name:'malformed topic',response:{courses:[{name:'MBA',code:'MBA1',warnings:[],cos:[],units:[{code:'U1',title:'Management',topics:[null]}]}],extraction_status:'COMPLETED'},message:'The extracted course data is incomplete.'},
 {name:'provider failure',response:{courses:[],extraction_status:'FAILED',error:'The AI provider timed out. Retry the saved document.'},message:'The AI provider timed out.'},
])test(`curriculum upload handles ${scenario.name} without crashing`,async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.addInitScript(()=>localStorage.setItem('access_token','test-session'));
 await page.route(/\/v[13]\//,async route=>{
  const path=new URL(route.request().url()).pathname;let json:unknown={items:[]};
  if(path.endsWith('/users/me'))json={user_id:'faculty',name:'Faculty'};
  if(path.endsWith('/college/access'))json={enabled:true,college_name:'Local College'};
  if(path.endsWith('/academic-options'))json={programs:[],academic_contexts:[],erp_subjects:[],can_setup:true,can_write:true};
  if(path.endsWith('/curricula/doc')){await route.fulfill({status:503,json:{detail:'Unavailable'}});return;}
  if(path.endsWith('/syllabus/extract'))json=scenario.response;
  await route.fulfill({json});
 });
 await page.goto('/dashboard/question-papers');
 await page.getByLabel('Curriculum document').setInputFiles({name:'MBA.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4 test')});
 await page.getByRole('button',{name:'Upload & extract courses'}).click();
 await expect(page.getByRole('alert')).toContainText(scenario.message);
 if(scenario.name==='progress connection failure'){await expect(page.getByLabel('Saved curricula')).toHaveValue('doc');await expect(page.getByText('Reading your curriculum. You can reopen it from Saved curricula.',{exact:true})).toHaveCount(0);}
 await expect(page.getByRole('button',{name:'Upload & extract courses'})).toBeEnabled();
 expect(errors).toEqual([]);
});

test('confirming a detected academic field preserves dependent curriculum choices',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('access_token','test-session'));
 const course={extraction_id:'mba-1',code:'MBA101',name:'Management Principles',year_number:1,semester_number:1,cos:[],units:[],warnings:[],academic_metadata:{institution_name:{value:'JNTUH',source:'JNTUH'},education_level:{value:'Postgraduate',source:'MBA'},batch_name:{value:'2025-26 admitted batch',source:'AY 2025-26'},degree_name:{value:'MBA',source:'MBA'}}};
 await page.route(/\/v[13]\//,async route=>{const path=new URL(route.request().url()).pathname;let json:unknown={items:[]};if(path.endsWith('/users/me'))json={user_id:'faculty',name:'Faculty'};if(path.endsWith('/college/access'))json={enabled:true,college_name:'Local College'};if(path.endsWith('/academic-options'))json={programs:[{code:'MBA',display_name:'Master of Business Administration',duration_years:2,departments:[{code:'MGMT',display_name:'Management Studies'}]}],academic_contexts:[],erp_subjects:[],can_setup:true,can_write:true};if(path.endsWith('/curricula'))json={items:[{id:'mba-doc',filename:'MBA.pdf',course_count:1}]};if(path.endsWith('/curricula/mba-doc'))json={id:'mba-doc',courses:[course],extraction_status:'COMPLETED'};await route.fulfill({json});});
 await page.goto('/dashboard/question-papers');await page.getByLabel('Saved curricula').selectOption('mba-doc');
 await expect(page.getByLabel('Education level')).toHaveValue('Postgraduate');await expect(page.getByLabel('Batch')).toHaveValue('2025-26 admitted batch');
 await page.getByLabel('Education level').selectOption('Postgraduate');
 await expect(page.getByLabel('Batch')).toHaveValue('2025-26 admitted batch');
 await page.getByLabel('Degree').selectOption('MBA');await page.getByLabel('Department').selectOption('MGMT');await page.getByLabel('Branch').selectOption('General');await page.getByLabel('Year').selectOption('1');await page.getByLabel('Semester').selectOption('1');
 await expect(page.getByLabel('Curriculum subject')).toContainText('MBA101 · Management Principles');
});
