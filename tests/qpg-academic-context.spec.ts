import {test,expect,type Page} from '@playwright/test';
async function goWorkspace(page:Page,section:'Paper Generation'|'Master Question Bank'){const menu=page.getByRole('complementary').getByRole('button',{name:'Question Paper Generation',exact:true});if(await menu.getAttribute('aria-expanded')!=='true')await menu.click();await page.getByRole('complementary').getByRole('button',{name:section,exact:true}).click();}
const institution='Dhanalakshmi Srinivasan CET';
const academic={institution_name:institution,education_level:'Undergraduate',batch_name:'2024–2028',specialization_name:'Computer Science',program_code:'BTECH',branch_code:'CSE'};
const subject={...academic,id:'bank-subject',code:'DS',name:'Data Structures',year_number:2,semester_number:3,batch_id:'batch24',batch_year:2024};
async function setup(page:Page,{missing=false}={}){
 await page.addInitScript(()=>localStorage.setItem('access_token','test-session'));
 const writes:Record<string,unknown>[]=[],queries:URLSearchParams[]=[];
 await page.route(/\/v[13]\//,async route=>{
  const url=new URL(route.request().url()),path=url.pathname;let json:unknown={items:[]};
  if(path.endsWith('/users/me'))json={user_id:'faculty',name:'Faculty'};
  else if(path.endsWith('/college/access'))json={enabled:true,college_name:institution};
  else if(path.endsWith('/academic-options'))json={institution_name:institution,programs:[{code:'BTECH',display_name:'B.Tech',duration_years:4,education_level:'Undergraduate',departments:[{code:'CSE',display_name:'Computer Science'}]}],institution_batches:missing?[]:[{id:'batch24',label:'2024–2028',program_code:'BTECH',entry_year:2024,version:1}],academic_contexts:[academic],erp_subjects:[],can_setup:true,can_write:true};
  else if(path.endsWith('/curricula'))json={items:[{id:'doc',filename:'JNTUH.pdf',course_count:1}]};
  else if(path.endsWith('/curricula/doc'))json={id:'doc',filename:'JNTUH.pdf',courses:[{code:'CS302PC',name:'Data Structures',year_number:2,semester_number:3,cos:[],units:[],warnings:[],academic_metadata:{institution_name:{value:'JNTUH',source:'Document heading'},batch_name:{value:'2022-23',source:'Academic year in document'},specialization_name:{value:'AI & ML',source:'Document department'}}}]};
  else if(path.endsWith('/subjects')){queries.push(url.searchParams);json={items:[subject]};}
  else if(path.endsWith('/subjects/from-curriculum')){const body=route.request().postDataJSON();writes.push(body);json={...body,id:'new-subject'};}
  else if(path.endsWith('/questions'))json={items:[],total:0};
  await route.fulfill({json});
 });
 return {writes,queries};
}
async function selectContext(page:Page){for(const [title,value] of [['Batch year','2024'],['Education level','Undergraduate'],['Programme','BTECH'],['Department','CSE'],['Semester','3']])await page.getByLabel(title,{exact:true}).selectOption(value);}

test('curriculum review uses institution records and never infers admission year from document labels',async({page})=>{
 const f=await setup(page);await page.goto('/dashboard/question-papers');await page.getByRole('button',{name:'Saved curricula',exact:true}).click();await page.getByRole('button',{name:'JNTUH.pdf · 1 course',exact:true}).click();
 await expect(page.getByLabel('Batch year',{exact:true})).toHaveValue('');await expect(page.getByLabel('Education level',{exact:true})).toBeDisabled();await selectContext(page);await page.getByLabel('Curriculum subject').selectOption('CS302PC');await page.getByRole('button',{name:'Continue to Syllabus Master'}).click();
 await expect.poll(()=>f.writes[0]?.batch_id).toBe('batch24');expect(f.writes[0]).toMatchObject({...academic,year_number:2,semester_number:3});expect(f.writes[0].institution_name).not.toBe('JNTUH');
 await goWorkspace(page,'Paper Generation');await expect(page.getByLabel('Batch year',{exact:true})).toHaveValue('');await expect(page.getByLabel('Subject',{exact:true})).toHaveValue('');
});
test('legacy subjects stay accessible without invented admission years',async({page})=>{
 await setup(page,{missing:true});await page.goto('/dashboard/question-papers');await page.getByRole('button',{name:'Open existing subjects',exact:true}).click();for(const [title,value] of [['Programme','BTECH'],['Department','CSE'],['Study year','2'],['Semester','3'],['Subject','bank-subject']])await page.getByLabel(title,{exact:true}).selectOption(value);await expect(page.getByLabel('Subject',{exact:true})).toHaveValue('bank-subject');
});
test('Question Bank and Prepare Paper share the selected institution subject across refresh',async({page})=>{
 const f=await setup(page);await page.goto('/dashboard/question-papers/question-bank?view=bank');await selectContext(page);await page.getByLabel('Subject',{exact:true}).selectOption('bank-subject');await expect(page.getByRole('region',{name:'Selected academic context'})).toContainText(institution);expect(f.queries.some(q=>q.get('batch_id')==='batch24'&&q.get('semester_number')==='3')).toBe(true);
 await goWorkspace(page,'Paper Generation');await expect(page.getByRole('region',{name:'Selected academic context'})).toContainText('Batch 2024');await page.reload();await expect(page.getByRole('region',{name:'Selected academic context'})).toContainText('Computer Science');await page.getByRole('button',{name:'Change Subject',exact:true}).click();await page.getByRole('button',{name:'Cancel subject change',exact:true}).click();await expect(page.getByRole('region',{name:'Selected academic context'})).toContainText('Data Structures');
});
test('missing academic setup directs administrators to Institution Management',async({page})=>{
 const f=await setup(page,{missing:true});await page.goto('/dashboard/question-papers');await page.getByRole('button',{name:'Saved curricula',exact:true}).click();await page.getByRole('button',{name:'JNTUH.pdf · 1 course',exact:true}).click();await expect(page.getByText('No admission batches are configured yet.')).toBeVisible();await expect(page.getByLabel('Batch year',{exact:true}).locator('option')).toHaveCount(1);await expect(page.getByRole('link',{name:'Manage batches, programmes and subjects ↗'})).toHaveAttribute('href','/dashboard/attendance?tab=academic');expect(f.writes).toEqual([]);
});
