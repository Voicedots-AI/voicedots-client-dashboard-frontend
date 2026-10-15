import {test,expect} from '@playwright/test';

for(const status of [200,404,500]){
 test(`student sharing ${status}: question bank remains accurate`,async({page})=>{
  await page.addInitScript(()=>{
   localStorage.setItem('access_token','sharing-test');
   sessionStorage.setItem('qpg-workspace-context',JSON.stringify({program:'BTECH',branch:'CSE',year:'2',semester:'4',subject:'s1'}));
   sessionStorage.setItem('qpg-workspace-academic',JSON.stringify({institution_name:'',education_level:'',batch_name:'',specialization_name:'',legacy:true}));
  });
  await page.route(/\/v[13]\//,async route=>{
   const path=new URL(route.request().url()).pathname;let json:unknown={items:[]};
   if(path.endsWith('/student-question-releases')){
    await route.fulfill({status,json:status===200?{items:[{question_id:'q1',published:false}]}:{detail:status===404?'College endpoint not found.':'Sharing service failed.'}});return;
   }
   if(path.endsWith('/users/me'))json={user_id:'faculty',name:'Faculty',email:'faculty@example.edu'};
   if(path.endsWith('/college/access'))json={enabled:true,college_name:'Demo College'};
   if(path.endsWith('/academic-options'))json={programs:[{code:'BTECH',display_name:'B.Tech',duration_years:4,departments:[{code:'CSE',display_name:'Computer Science'}]}],erp_subjects:[],can_setup:true,can_write:true};
   if(path.endsWith('/subjects'))json={items:[{id:'s1',code:'CN',name:'Computer Networks'}]};
   if(path.endsWith('/questions'))json={total:1,items:[{id:'q1',subject_id:'s1',question_text:'Explain packet switching.',question_type:'SHORT_ANSWER',marks:2,bloom_level:'K2',difficulty:'EASY',status:'APPROVED',source_type:'MANUAL',version:1,answer:'Answer',options:[],updated_at:'2026-10-14T00:00:00Z'}]};
   await route.fulfill({json});
  });
  await page.goto('/dashboard/question-papers/question-bank');
  await expect(page.getByRole('button',{name:'Edit',exact:true})).toBeVisible();
  if(status===500)await expect(page.getByRole('alert')).toContainText('Sharing service failed.');
  else await expect(page.getByRole('alert')).toHaveCount(0);
  if(status===200)await expect(page.getByRole('columnheader',{name:'Student access',exact:true})).toBeVisible();
  else await expect(page.getByRole('columnheader',{name:'Student access',exact:true})).toHaveCount(0);
 });
}
