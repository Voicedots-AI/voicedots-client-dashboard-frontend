import {test,expect} from '@playwright/test';

test('finalized paper opens an editable version without overwriting the original',async({page})=>{
 await page.addInitScript(()=>{localStorage.setItem('access_token','paper-test');sessionStorage.setItem('qpg-workspace-context',JSON.stringify({program:'BTECH',branch:'CSE',year:'2',semester:'4',subject:'s1'}));sessionStorage.setItem('qpg-workspace-academic',JSON.stringify({institution_name:'',education_level:'',batch_name:'',specialization_name:'',legacy:true}));sessionStorage.setItem('qpg-paper:s1','p1');});
 const section={id:'a',name:'Part A',offered:1,attempted:1,marks_each:'2',question_type:'SHORT_ANSWER',format:'STANDARD',choice_groups:[]};
 const question={id:'q1',question_text:'Explain packet switching.',question_type:'SHORT_ANSWER',marks:2,status:'APPROVED',version:1,options:[],answer:'Packets travel independently.',source_type:'MANUAL',bloom_level:'K2',difficulty:'EASY'};
 const original={id:'p1',title:'Final exam',version:1,revision:5,status:'LOCKED',syllabus_version_id:'sv1',blueprint_version:1,duration_minutes:60,metadata:{instructions:'Answer all questions.',examination_session:'May 2026'},blueprint_snapshot:{title:'One part',duration_minutes:60,sections:[section]},syllabus_snapshot:{cos:[],units:[],topics:[]},items:[{id:'i1',section_id:'a',position:1,choice_group:null,snapshot:question,question_version:1}],validation:{valid:true,errors:[],checks:['All positions assigned']},totals:{offered_marks:'2',attempted_marks:'2'}};
 let draft:typeof original|null=null;let newVersions=0;
 await page.route(/\/v[13]\//,async route=>{
  const path=new URL(route.request().url()).pathname;const method=route.request().method();let json:unknown={items:[]};
  if(path.endsWith('/users/me'))json={user_id:'faculty',name:'Faculty',email:'faculty@example.edu'};
  if(path.endsWith('/college/access'))json={enabled:true,college_name:'Demo College'};
  if(path.endsWith('/academic-options'))json={programs:[{code:'BTECH',display_name:'B.Tech',duration_years:4,departments:[{code:'CSE',display_name:'Computer Science'}]}],erp_subjects:[],can_setup:false,can_write:true};
  if(path.endsWith('/subjects'))json={items:[{id:'s1',code:'CN',name:'Computer Networks'}]};
  if(path.endsWith('/syllabus/versions'))json={items:[{id:'sv1',version:1,status:'PUBLISHED'}]};
  if(path.endsWith('/papers'))json={items:[original,...(draft?[draft]:[])]};
  if(path.endsWith('/papers/p1'))json=original;
  if(path.endsWith('/papers/p1/new-version')){expect(route.request().postDataJSON().expected_revision).toBe(5);newVersions++;draft={...structuredClone(original),id:'p2',title:original.title,version:2,revision:1,status:'DRAFT'};json=draft;}
  if(path.endsWith('/papers/p2')){if(method==='PUT'){expect(route.request().postDataJSON().expected_revision).toBe(1);draft={...draft!,title:route.request().postDataJSON().title,revision:2};}json=draft;}
  if(path.endsWith('/availability'))json={sections:[{section_id:'a',name:'Part A',counts:{APPROVED:1,NEEDS_REVIEW:0,DRAFT:0,ARCHIVED:0},available_distinct:0,required:0,sufficient:true}]};
  if(path.endsWith('/ai-build'))json={build:null};
  if(path.endsWith('/generation-config'))json={enabled:false};
  await route.fulfill({json});
 });
 await page.goto('/dashboard/question-papers/paper-generation?view=papers');
 await page.getByRole('button',{name:'Final exam',exact:true}).click();
 await page.getByRole('button',{name:'Edit paper',exact:true}).click();
 await expect(page.getByRole('dialog',{name:'Edit finalized paper'})).toBeVisible();
 await page.getByRole('button',{name:'Create editable draft',exact:true}).click();
 await expect(page.getByRole('dialog',{name:'Edit finalized paper'})).toHaveCount(0);
 await expect(page.getByLabel('Paper title',{exact:true})).toBeEnabled();
 await expect(page.getByLabel('Paper title',{exact:true})).toHaveValue('Final exam');
 await page.getByLabel('Paper title',{exact:true}).fill('Updated exam');
 await page.getByRole('button',{name:'Save Draft',exact:true}).click();
 await expect(page.getByText('Paper details saved.',{exact:false})).toBeVisible();
 expect(newVersions).toBe(1);expect(original.title).toBe('Final exam');expect(original.status).toBe('LOCKED');expect(draft?.title).toBe('Updated exam');
 await page.getByRole('button',{name:'Questions',exact:true}).click();
 const part=page.locator('details[aria-label="Part A"]');await part.locator('summary').first().click();
 await expect(part.getByRole('button',{name:'Replace from bank',exact:true})).toBeEnabled();
 await expect(page.getByRole('region',{name:'Question availability'})).not.toBeVisible();
 await page.reload();
 await page.getByRole('button',{name:'Updated exam',exact:true}).click();
 await expect(page.getByRole('button',{name:'Paper details',exact:true})).toBeVisible();
 await expect(page.locator('.qpg-ai-tools')).not.toHaveAttribute('open','');
 await expect(page.getByLabel('Paper title',{exact:true})).not.toBeVisible();
 await page.getByRole('button',{name:'Paper details',exact:true}).click();
 await expect(page.getByLabel('Paper title',{exact:true})).toBeVisible();
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
