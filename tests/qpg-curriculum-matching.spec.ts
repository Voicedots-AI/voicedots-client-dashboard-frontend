import {test,expect} from '@playwright/test';

for(const automatic of [true,false]){
 test(automatic?'student curriculum is automatically matched':'admin resolves ambiguous curriculum and can restore automatic matching',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('access_token','curriculum-test'));
  const student={id:'student-1',full_name:'Asha Kumar',roll_number:'CSE001',program:'B.Tech',department_code:'CSE',batch_label:'2024-2028'};
  const core={context_key:'a'.repeat(64),institution_name:'Demo College',education_level:'Undergraduate',program_name:'B.Tech',branch_name:'CSE',batch_name:'2024-2028',specialization_name:'Core CSE',subject_count:3};
  const ai={...core,context_key:'b'.repeat(64),specialization_name:'AI and ML'};
  let selected:string|null=null;
  await page.route(/\/v[13]\//,async route=>{
   const path=new URL(route.request().url()).pathname;
   let json:unknown={items:[]};
   if(path.endsWith('/users/me'))json={user_id:'admin',name:'Admin',email:'admin@example.edu'};
   if(path.endsWith('/college/access'))json={enabled:true,college_name:'Demo College'};
   if(path.endsWith('/academic-options'))json={programs:[],erp_subjects:[],can_setup:true,can_write:true};
   if(path.endsWith('/student-curriculum/students'))json={items:[student]};
   if(path.endsWith('/student-curriculum/student-1')){
    if(route.request().method()==='POST'){
     const payload=route.request().postDataJSON();expect(payload.profile_key).toBe('c'.repeat(64));selected=payload.context_key;
    }
    json={student,profile_key:'c'.repeat(64),status:automatic||selected?'matched':'ambiguous',context:automatic?core:selected?ai:null,match_method:automatic?'automatic':selected?'admin':null,candidates:automatic?[core]:[core,ai],message:automatic?'Your curriculum was matched automatically from your academic profile.':'More than one curriculum matches your academic profile.'};
   }
   await route.fulfill({json});
  });
  await page.goto('/dashboard/question-papers/question-bank?view=student-access');
  await expect(page.getByRole('heading',{name:'Student curriculum matching'})).toBeVisible();
  await page.locator('select').first().selectOption('student-1');
  if(automatic){
   await expect(page.getByRole('status')).toContainText('Automatically matched');
   await expect(page.getByText('3 subjects')).toBeVisible();
   await expect(page.getByRole('button',{name:'Save curriculum choice'})).toHaveCount(0);
  }else{
   await expect(page.getByRole('status')).toContainText('Curriculum choice required');
   await page.getByLabel('Matching curriculum').selectOption(ai.context_key);
   await page.getByRole('button',{name:'Save curriculum choice'}).click();
   await expect(page.getByText('Curriculum selected by administrator',{exact:true})).toBeVisible();
   await expect(page.getByText(/Curriculum choice saved/)).toBeVisible();
   await page.getByRole('button',{name:'Use automatic matching'}).click();
   await expect(page.getByText('Curriculum choice required',{exact:true})).toBeVisible();
  }
 });
}

test('clearing a student while its curriculum request is pending stops the loading state',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('access_token','curriculum-test'));
 let requested=false;
 await page.route(/\/v[13]\//,async route=>{
  const path=new URL(route.request().url()).pathname;let json:unknown={items:[]};
  if(path.endsWith('/users/me'))json={user_id:'admin',name:'Admin'};
  if(path.endsWith('/college/access'))json={enabled:true,college_name:'Demo College'};
  if(path.endsWith('/academic-options'))json={programs:[],erp_subjects:[],can_setup:true,can_write:true};
  if(path.endsWith('/student-curriculum/students'))json={items:[{id:'student-1',full_name:'Asha Kumar',roll_number:'CSE001',program:'B.Tech',department_code:'CSE',batch_label:'2024-2028'}]};
  if(path.endsWith('/student-curriculum/student-1')){requested=true;await new Promise(resolve=>setTimeout(resolve,5000));await route.fulfill({json:{}}).catch(()=>{});return;}
  await route.fulfill({json});
 });
 await page.goto('/dashboard/question-papers/question-bank?view=student-access');
 await page.getByRole('combobox').first().selectOption('student-1');
 await expect.poll(()=>requested).toBe(true);
 await expect(page.getByText('Checking curriculum match…',{exact:true})).toBeVisible();
 await page.getByRole('combobox').first().selectOption('');
 await expect(page.getByText('Checking curriculum match…',{exact:true})).toHaveCount(0);
});
