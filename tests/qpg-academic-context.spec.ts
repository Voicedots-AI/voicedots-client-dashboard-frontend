import {test,expect,type Page} from '@playwright/test';
async function goWorkspace(page:Page,section:'Paper Generation'|'Master Question Bank'){const menu=page.getByRole('complementary').getByRole('button',{name:'Question Paper Generation',exact:true});if(await menu.getAttribute('aria-expanded')!=='true')await menu.click();await page.getByRole('complementary').getByRole('button',{name:section,exact:true}).click();}
test('academic hierarchy sends reviewed context and preserves independent paper selection',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('access_token','test-session'));
 let captured:Record<string,unknown>|undefined;
 await page.route(/\/v[13]\//,async route=>{
  const path=new URL(route.request().url()).pathname;
  let json:unknown={};
  if(path.endsWith('/users/me'))json={user_id:'faculty',name:'Faculty',email:'faculty@local.test'};
  if(path.endsWith('/college/access'))json={enabled:true,college_name:'Dhanalakshmi Srinivasan CET'};
  if(path.endsWith('/academic-options'))json={programs:[{code:'BTECH',display_name:'B.Tech',duration_years:4,departments:[{code:'CSE',display_name:'Computer Science'}]}],academic_contexts:[],erp_subjects:[],can_setup:true,can_write:true};
  if(path.endsWith('/curricula'))json={items:[{id:'doc',filename:'JNTUH.pdf',course_count:1}]};
  if(path.endsWith('/curricula/doc'))json={id:'doc',filename:'JNTUH.pdf',courses:[{code:'CS302PC',name:'Data Structures',year_number:2,semester_number:3,cos:[],units:[],warnings:[],academic_metadata:{institution_name:{value:'JNTUH',source:'JAWAHARLAL NEHRU TECHNOLOGICAL UNIVERSITY'},batch_name:{value:'2022-23',source:'AY 2022-23 Batch'},specialization_name:{value:'AI & ML',source:'COMPUTER SCIENCE AND ENGINEERING (AI & ML)'}}}]};
  if(path.endsWith('/subjects'))json={items:[]};
  if(path.endsWith('/subjects/from-curriculum')){captured=route.request().postDataJSON();json={...captured,id:'new-subject'};}
  await route.fulfill({json});
 });
 await page.goto('/dashboard/question-papers');
 await page.getByLabel('Saved curricula').selectOption('doc');
 await page.getByLabel('Institution',{exact:true}).selectOption('JNTUH');
 await expect(page.getByLabel('Education level',{exact:true})).toBeEnabled();
 await page.getByLabel('Education level',{exact:true}).selectOption('Undergraduate');
 await page.getByLabel('Batch',{exact:true}).selectOption('2022-23');
 await page.getByLabel('Degree',{exact:true}).selectOption('BTECH');
 await page.getByLabel('Department',{exact:true}).selectOption('CSE');
 await page.getByLabel('Branch',{exact:true}).selectOption('AI & ML');
 await page.getByLabel('Year',{exact:true}).selectOption('2');
 await page.getByLabel('Semester',{exact:true}).selectOption('3');
 await page.getByLabel('Curriculum subject').selectOption('CS302PC');
 await page.getByRole('button',{name:'Continue to Syllabus Master'}).click();
 await expect.poll(()=>captured?.institution_name).toBe('JNTUH');
 expect(captured).toMatchObject({education_level:'Undergraduate',batch_name:'2022-23',specialization_name:'AI & ML',branch_code:'CSE',program_code:'BTECH'});
 await goWorkspace(page,'Paper Generation');
 await expect(page.getByLabel('Subject',{exact:true})).toHaveValue('');
 await goWorkspace(page,'Master Question Bank');
 await expect(page.getByLabel('Institution',{exact:true})).toHaveValue('JNTUH');
 await expect(page.getByLabel('Branch',{exact:true})).toHaveValue('AI & ML');
 await page.getByLabel('Institution',{exact:true}).selectOption('Dhanalakshmi Srinivasan CET');
 await expect(page.getByLabel('Education level',{exact:true})).toHaveValue('');
 await expect(page.getByLabel('Batch',{exact:true})).toHaveValue('');
 await expect(page.getByLabel('Degree',{exact:true})).toBeDisabled();
 await expect(page.getByLabel('Department',{exact:true})).toHaveValue('');
 await expect(page.getByLabel('Branch',{exact:true})).toHaveValue('');
});
test('legacy subjects stay accessible without invented academic fields',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('access_token','test-session'));
 await page.route(/\/v[13]\//,async route=>{
  const path=new URL(route.request().url()).pathname;
  let json:unknown={};
  if(path.endsWith('/users/me'))json={user_id:'faculty',name:'Faculty'};
  if(path.endsWith('/college/access'))json={enabled:true,college_name:'Demo College'};
  if(path.endsWith('/academic-options'))json={programs:[{code:'BTECH',display_name:'B.Tech',duration_years:4,departments:[{code:'CSE',display_name:'Computer Science'}]}],erp_subjects:[],can_setup:true,can_write:true};
  if(path.endsWith('/curricula'))json={items:[]};
  if(path.endsWith('/subjects'))json={items:[{id:'old',code:'CN',name:'Computer Networks'}]};
  await route.fulfill({json});
 });
 await page.goto('/dashboard/question-papers');
 await page.getByRole('button',{name:'Open existing subjects'}).click();
 await page.getByLabel('Degree',{exact:true}).selectOption('BTECH');
 await page.getByLabel('Department',{exact:true}).selectOption('CSE');
 await page.getByLabel('Year',{exact:true}).selectOption('2');
 await page.getByLabel('Semester',{exact:true}).selectOption('4');
 await page.getByLabel('Subject',{exact:true}).selectOption('old');
 await expect(page.getByLabel('Subject',{exact:true})).toHaveValue('old');
});

test('Question Bank and Prepare Paper share an independent full hierarchy across refresh',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('access_token','test-session'));
 const academic={institution_name:'JNTUH',education_level:'Undergraduate',batch_name:'2022-23',specialization_name:'AI & ML',program_code:'BTECH',branch_code:'CSE'};
 const subject={...academic,id:'bank-subject',code:'DS',name:'Data Structures',year_number:2,semester_number:3};
 let requested:URLSearchParams|undefined;
 await page.route(/\/v[13]\//,async route=>{
  const url=new URL(route.request().url());const path=url.pathname;let json:unknown={items:[]};
  if(path.endsWith('/users/me'))json={user_id:'faculty',name:'Faculty'};
  if(path.endsWith('/college/access'))json={enabled:true,college_name:'Demo College'};
  if(path.endsWith('/academic-options'))json={programs:[{code:'BTECH',display_name:'B.Tech',duration_years:4,departments:[{code:'CSE',display_name:'Computer Science'}]}],academic_contexts:[academic,{...academic,institution_name:'Demo College',batch_name:'2023-24',specialization_name:'Core CSE'}],erp_subjects:[],can_setup:true,can_write:true};
  if(path.endsWith('/subjects')){requested=url.searchParams;json={items:[subject]};}
  if(path.endsWith('/questions'))json={items:[],total:0};
  await route.fulfill({json});
 });
 await page.goto('/dashboard/question-papers?view=bank');
 for(const [title,value] of [['Institution','JNTUH'],['Education level','Undergraduate'],['Batch','2022-23'],['Degree','BTECH'],['Department','CSE'],['Branch','AI & ML'],['Year','2'],['Semester','3'],['Subject','bank-subject']])await page.getByLabel(title,{exact:true}).selectOption(value);
 await expect(page.getByRole('region',{name:'Selected academic context'})).toContainText('JNTUH');
 expect(requested?.get('institution_name')).toBe('JNTUH');expect(requested?.get('batch_name')).toBe('2022-23');expect(requested?.get('specialization_name')).toBe('AI & ML');expect(requested?.get('branch_code')).toBe('CSE');
 await goWorkspace(page,'Paper Generation');
 await expect(page.getByRole('region',{name:'Selected academic context'})).toContainText('AI & ML');
 await page.reload();await page.getByRole('button',{name:'Change Subject',exact:true}).click();
 await expect(page.getByLabel('Institution',{exact:true})).toHaveValue('JNTUH');await expect(page.getByLabel('Batch',{exact:true})).toHaveValue('2022-23');await expect(page.getByLabel('Branch',{exact:true})).toHaveValue('AI & ML');
 await goWorkspace(page,'Master Question Bank');
 await expect(page.getByLabel('Institution',{exact:true})).toHaveValue('');
 await goWorkspace(page,'Paper Generation');
 await page.getByLabel('Institution',{exact:true}).selectOption('Demo College');
 await expect(page.getByLabel('Education level',{exact:true})).toHaveValue('');await expect(page.getByLabel('Degree',{exact:true})).toBeDisabled();await expect(page.getByLabel('Subject',{exact:true})).toHaveValue('');
});

test('administrator can add a missing degree and department without leaving curriculum review',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('access_token','test-session'));
 const programs=[{code:'BTECH',display_name:'B.Tech',duration_years:4,departments:[] as {code:string;display_name:string}[]}];
 let savedSubject:Record<string,unknown>|undefined;
 await page.route(/\/v[13]\//,async route=>{
  const path=new URL(route.request().url()).pathname;let json:unknown={items:[]};
  if(path.endsWith('/users/me'))json={user_id:'faculty',name:'Faculty'};
  if(path.endsWith('/college/access'))json={enabled:true,college_name:'Local Demo College'};
  if(path.endsWith('/academic-options'))json={programs,academic_contexts:[],erp_subjects:[],can_setup:true,can_write:true};
  if(path.endsWith('/curricula'))json={items:[{id:'civil',filename:'Water Supply.pdf',course_count:1}]};
  if(path.endsWith('/curricula/civil'))json={id:'civil',courses:[{code:'U24CE305',name:'Water Supply Engineering',cos:[],units:[],warnings:[],academic_metadata:{institution_name:{value:'Meenakshi Sundararajan Engineering College',source:'College heading'},department_name:{value:'Civil Engineering',source:'Department: Civil Engineering'}}}]};
  if(path.endsWith('/academic-catalog/programs')){const body=route.request().postDataJSON();programs.push({...body,departments:[]});json={status:'saved'};}
  if(path.endsWith('/academic-catalog/departments')){const body=route.request().postDataJSON();programs.find(p=>p.code===body.program_code)!.departments.push({code:body.code,display_name:body.display_name});json={status:'saved'};}
  if(path.endsWith('/subjects/from-curriculum')){savedSubject=route.request().postDataJSON();json={...savedSubject,id:'civil-subject'};}
  await route.fulfill({json});
 });
 await page.goto('/dashboard/question-papers');await page.getByLabel('Saved curricula').selectOption('civil');
 await expect(page.getByLabel('Institution',{exact:true})).toHaveValue('Meenakshi Sundararajan Engineering College');
 await page.getByLabel('Education level',{exact:true}).selectOption('Undergraduate');
 await page.getByLabel('Batch',{exact:true}).selectOption('__new__');await page.getByLabel('New batch').fill('2024 admitted batch');
 await page.getByLabel('Degree',{exact:true}).selectOption('__add__');let dialog=page.getByRole('dialog',{name:'Add Degree'});
 await dialog.getByLabel('Degree code',{exact:true}).fill('BE');await dialog.getByLabel('Degree name',{exact:true}).fill('Bachelor of Engineering');await dialog.getByLabel('Duration (years)').fill('4');await dialog.getByRole('button',{name:'Save',exact:true}).click();
 await expect(page.getByLabel('Degree',{exact:true})).toHaveValue('BE');
 await page.getByLabel('Department',{exact:true}).selectOption('__add__');dialog=page.getByRole('dialog',{name:'Add Department'});
 await expect(dialog.getByLabel('Department name',{exact:true})).toHaveValue('Civil Engineering');await dialog.getByLabel('Department code',{exact:true}).fill('CE');await dialog.getByRole('button',{name:'Save',exact:true}).click();
 await expect(page.getByLabel('Department',{exact:true})).toHaveValue('CE');
 await page.getByLabel('Branch',{exact:true}).selectOption('General');await page.getByLabel('Year',{exact:true}).selectOption('2');await page.getByLabel('Semester',{exact:true}).selectOption('3');await page.getByLabel('Curriculum subject').selectOption('U24CE305');
 await page.getByRole('button',{name:'Continue to Syllabus Master'}).click();
 await expect.poll(()=>savedSubject?.branch_code).toBe('CE');expect(savedSubject).toMatchObject({program_code:'BE',batch_name:'2024 admitted batch',specialization_name:'General',institution_name:'Meenakshi Sundararajan Engineering College'});
});
