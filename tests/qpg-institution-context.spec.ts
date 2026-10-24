import {test,expect,type Page} from '@playwright/test';
const programs=[{code:'BTECH',display_name:'B.Tech',education_level:'Undergraduate',duration_years:4,departments:[{code:'CSE',display_name:'Computer Science'},{code:'ECE',display_name:'Electronics'}]},{code:'MBA',display_name:'MBA',education_level:'Postgraduate',duration_years:2,departments:[{code:'MGMT',display_name:'Management'}]}];
const batches=[{id:'b24',label:'2024–2028',entry_year:2024,program_code:'BTECH',version:1},{id:'b25',label:'2025–2029',entry_year:2025,program_code:'BTECH',version:1},{id:'mba24',label:'MBA 2024',entry_year:2024,program_code:'MBA',version:1}];
const subject={id:'linked',erp_subject_id:'erp-cn',code:'CN',name:'Computer Networks',program_code:'BTECH',branch_code:'CSE',year_number:2,semester_number:4,batch_id:'b24',batch_year:2024,institution_name:'Institution A',education_level:'Undergraduate',batch_name:'2024–2028',specialization_name:'Computer Science'};
async function setup(page:Page,{multiple=false,fail=false,saved=false,empty=false}={}){
 await page.addInitScript(({saved,subject})=>{localStorage.setItem('access_token','test-session');if(saved){sessionStorage.setItem('qpg-workspace-context',JSON.stringify({program:'BTECH',branch:'CSE',year:'2',semester:'4',subject:subject.id,batch_id:subject.batch_id}));sessionStorage.setItem('qpg-workspace-academic',JSON.stringify({...subject,legacy:false}));}},{saved,subject});
 const options={institution_name:'Institution A',programs:structuredClone(programs),institution_batches:empty?[]:structuredClone(batches),academic_contexts:[subject],erp_subjects:[{id:'erp-cn',code:'CN',name:'Computer Networks',department_code:'CSE'}],can_setup:true,can_write:true};
 if(multiple)options.institution_batches.push({id:'lateral',label:'2024 lateral',entry_year:2024,program_code:'BTECH',version:1});
 const writes:{path:string;body:any;method:string}[]=[],queries:URLSearchParams[]=[],errors:string[]=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route(/\/v[13]\//,async route=>{
  const r=route.request(),u=new URL(r.url()),p=u.pathname;let json:any={items:[]};
  if(r.method()!=='GET')writes.push({path:p,body:r.postDataJSON(),method:r.method()});
  if(p.endsWith('/users/me'))json={user_id:'admin',name:'Admin',email:'admin@local.test'};
  else if(p.endsWith('/college/access'))json={enabled:true,college_name:'Institution A'};
  else if(p.endsWith('/attendance/setup'))json={staff:[],students:[],classes:[]};
  else if(p.endsWith('/academic-catalog'))json={programs:options.programs};
  else if(p.endsWith('/academic-options'))json=options;
  else if(p.endsWith('/subjects')&&r.method()==='GET'){
   queries.push(u.searchParams);if(fail&&u.searchParams.has('batch_id')){fail=false;await route.fulfill({status:503,json:{detail:'Temporary subject service failure'}});return;}
   json={items:(u.searchParams.get('batch_id')==='b24'&&u.searchParams.get('semester_number')==='4')||!u.searchParams.has('batch_id')?[subject]:[]};
  }
  else if(p.endsWith('/catalog/batches')&&r.method()==='POST'){const v=r.postDataJSON().values;const b={id:'new-batch',...v,version:1};options.institution_batches.push(b);json=b;}
  else if(p.includes('/catalog/batches/')&&r.method()==='PUT'){const b=options.institution_batches.find(b=>p.endsWith('/'+b.id))!;Object.assign(b,r.postDataJSON(),{version:b.version+1});json=b;}
  else if(p.endsWith('/subjects')&&r.method()==='POST')json={...subject,...r.postDataJSON()};
  else if(p.endsWith('/academic-catalog/programs')&&r.method()==='POST'){const b=r.postDataJSON();Object.assign(options.programs.find(p=>p.code===b.code)!,b);json={status:'saved'};}
  else if(p.endsWith('/questions'))json={items:[],total:0};
  await route.fulfill({json});
 });
 return {options,writes,queries,errors};
}
async function choose(page:Page){
 await page.getByLabel('Batch year',{exact:true}).selectOption('2024');await page.getByLabel('Education level',{exact:true}).selectOption('Undergraduate');await page.getByLabel('Programme',{exact:true}).selectOption('BTECH');
 const batch=page.getByLabel('Batch',{exact:true});if(await batch.count())await batch.selectOption('b24');
 await page.getByLabel('Department',{exact:true}).selectOption('CSE');await page.getByLabel('Semester',{exact:true}).selectOption('4');
}
test('six-step hierarchy filters institution subjects and survives reload',async({page})=>{
 const f=await setup(page);await page.goto('/dashboard/question-papers/question-bank?view=bank');
 await expect(page.getByLabel('Education level',{exact:true})).toBeDisabled();await expect(page.getByLabel('Programme',{exact:true})).toBeDisabled();await choose(page);
 await expect(page.getByLabel('Subject',{exact:true})).toBeEnabled();await page.getByLabel('Subject',{exact:true}).selectOption('linked');
 await expect(page.getByRole('region',{name:'Selected academic context'})).toContainText('Batch year 2024');
 expect(f.queries.some(q=>q.get('batch_id')==='b24'&&q.get('semester_number')==='4')).toBe(true);
 await page.reload();await expect(page.getByRole('region',{name:'Selected academic context'})).toContainText('Computer Networks');expect(f.writes).toEqual([]);expect(f.errors).toEqual([]);
});
test('changing earlier fields clears dependent selections',async({page})=>{
 await setup(page);await page.goto('/dashboard/question-papers/question-bank?view=bank');await choose(page);
 await page.getByLabel('Batch year',{exact:true}).selectOption('2025');
 for(const title of ['Education level','Programme','Department','Semester','Subject'])await expect(page.getByLabel(title,{exact:true})).toHaveValue('');
 await expect(page.getByLabel('Subject',{exact:true})).toBeDisabled();
 await page.getByLabel('Education level',{exact:true}).selectOption('Undergraduate');await page.getByLabel('Programme',{exact:true}).selectOption('BTECH');await page.getByLabel('Department',{exact:true}).selectOption('CSE');await page.getByLabel('Semester',{exact:true}).selectOption('4');
 await expect(page.getByText('No subjects are linked to this batch and semester yet.')).toBeVisible();
});
test('multiple batches require explicit selection and programme limits semesters',async({page})=>{
 await setup(page,{multiple:true});await page.goto('/dashboard/question-papers/question-bank?view=bank');await page.getByLabel('Batch year',{exact:true}).selectOption('2024');await page.getByLabel('Education level',{exact:true}).selectOption('Undergraduate');await page.getByLabel('Programme',{exact:true}).selectOption('BTECH');
 await expect(page.getByLabel('Department',{exact:true})).toBeDisabled();await page.getByLabel('Batch',{exact:true}).selectOption('b24');await expect(page.getByLabel('Department',{exact:true})).toBeEnabled();
 await page.getByLabel('Education level',{exact:true}).selectOption('Postgraduate');await page.getByLabel('Programme',{exact:true}).selectOption('MBA');await page.getByLabel('Department',{exact:true}).selectOption('MGMT');await expect(page.getByLabel('Semester',{exact:true}).locator('option')).toHaveCount(5);
});
test('subject service error is visible and retry recovers',async({page})=>{
 await setup(page,{fail:true});await page.goto('/dashboard/question-papers/question-bank?view=bank');await choose(page);await expect(page.getByRole('alert').filter({hasText:'Temporary subject service failure'})).toBeVisible();await page.getByRole('button',{name:'Retry',exact:true}).click();await expect(page.getByLabel('Subject',{exact:true})).toBeEnabled();
});
test('existing unlinked subjects remain selectable',async({page})=>{
 await setup(page,{empty:true});await page.goto('/dashboard/question-papers/question-bank?view=bank');await page.getByRole('button',{name:'Open existing subjects',exact:true}).click();
 for(const [title,value] of [['Programme','BTECH'],['Department','CSE'],['Study year','2'],['Semester','4'],['Subject','linked']])await page.getByLabel(title,{exact:true}).selectOption(value);
 await expect(page.getByRole('region',{name:'Selected academic context'})).toContainText('Computer Networks');
});
test('changing subject can be cancelled without losing the current paper context',async({page})=>{
 await setup(page,{saved:true});await page.goto('/dashboard/question-papers/question-bank?view=bank');await page.getByRole('button',{name:'Change Subject',exact:true}).click();await page.getByLabel('Batch year',{exact:true}).selectOption('2025');await page.getByRole('button',{name:'Cancel subject change',exact:true}).click();await expect(page.getByRole('region',{name:'Selected academic context'})).toContainText('Computer Networks');
});
for(const width of [390,1440])test(`institution hierarchy fits at ${width}px`,async({page})=>{await page.setViewportSize({width,height:900});await setup(page);await page.goto('/dashboard/question-papers/question-bank?view=bank');await choose(page);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);});
test('institution management creates, edits and assigns the shared batch',async({page})=>{
 const f=await setup(page);await page.goto('/dashboard/attendance?tab=academic');const panel=page.getByRole('region',{name:'Batch and QPG subject setup'});await expect(panel).toBeVisible();await panel.getByText('Add admission batch',{exact:true}).click();
 const form=panel.locator('form').filter({has:page.getByRole('button',{name:'Save batch',exact:true})});await form.getByLabel('Batch year',{exact:true}).fill('2026');await form.getByRole('combobox',{name:'Programme',exact:true}).selectOption('BTECH');await form.getByLabel('Batch label',{exact:true}).fill('2026–2030');await form.getByRole('button',{name:'Save batch',exact:true}).click();
 await expect(panel.getByRole('status')).toContainText('Batch saved');await panel.getByText(/Configured batches/).click();await panel.getByRole('listitem').filter({hasText:'2026–2030'}).getByRole('button',{name:'Edit batch'}).click();
 const edit=panel.locator('form').filter({has:page.getByRole('heading',{name:'Edit 2026–2030'})});await edit.getByLabel('Batch year',{exact:true}).fill('2027');await edit.getByRole('button',{name:'Save batch',exact:true}).click();await expect(panel.getByRole('status')).toContainText('Batch updated');
 const selector=panel.getByRole('group',{name:'Institution academic selection'});await selector.getByLabel('Batch year',{exact:true}).selectOption('2024');await selector.getByLabel('Education level',{exact:true}).selectOption('Undergraduate');await selector.getByLabel('Programme',{exact:true}).selectOption('BTECH');await selector.getByLabel('Department',{exact:true}).selectOption('CSE');await selector.getByLabel('Semester',{exact:true}).selectOption('3');
 await panel.getByRole('combobox',{name:'Existing institution subject',exact:true}).selectOption('erp-cn');await panel.getByRole('button',{name:'Assign subject',exact:true}).click();await expect(panel.getByRole('status')).toContainText('Subject linked');expect(f.writes.at(-1)?.body.batch_id).toBe('b24');expect(f.writes.at(-1)?.body.semester_number).toBe(3);expect(f.errors).toEqual([]);
});

test('cancel also restores context after opening legacy subjects',async({page})=>{
 await setup(page,{saved:true});await page.goto('/dashboard/question-papers/question-bank?view=bank');await page.getByRole('button',{name:'Change Subject',exact:true}).click();await page.getByRole('button',{name:'Open existing subjects',exact:true}).click();await page.getByLabel('Programme',{exact:true}).selectOption('MBA');await page.getByRole('button',{name:'Cancel subject change',exact:true}).click();await expect(page.getByRole('region',{name:'Selected academic context'})).toContainText('Computer Networks');
});

test('programme education level is editable in institution management',async({page})=>{
 const f=await setup(page);await page.goto('/dashboard/attendance?tab=academic');await page.getByRole('article').filter({has:page.getByRole('heading',{name:'B.Tech',exact:true})}).getByRole('button',{name:'Edit program',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Edit program',exact:true});await dialog.getByRole('combobox',{name:/Education level/}).selectOption('Postgraduate');await dialog.getByRole('button',{name:'Save',exact:true}).click();await expect(dialog).not.toBeVisible();expect(f.writes.find(w=>w.path.endsWith('/academic-catalog/programs'))?.body.education_level).toBe('Postgraduate');
});
