import {test,expect} from '@playwright/test';

test('import preview is readable, filters corrections and keeps row editing available',async({page})=>{
 await page.addInitScript(()=>{localStorage.setItem('access_token','preview-test');sessionStorage.setItem('qpg-workspace-context',JSON.stringify({program:'BTECH',branch:'CSE',year:'2',semester:'4',subject:'s1'}));sessionStorage.setItem('qpg-workspace-academic',JSON.stringify({institution_name:'',education_level:'',batch_name:'',specialization_name:'',legacy:true}));});
 const rows=[{id:'r1',row_number:1,location:'unit 1 · row 6',content:{question_text:'State Newton’s law of viscosity.',marks:'2',question_type:'',bloom_level:'Remember'},raw_values:{Question:'State Newton’s law of viscosity.'},errors:['Choose a question type.','Check the Bloom level.'],warnings:[],selected:false,removed:false,faculty_confirmed:false},{id:'r2',row_number:2,location:'unit 1 · row 7',content:{question_text:'Define mass density.',marks:'2',question_type:'SHORT_ANSWER',bloom_level:'K1'},raw_values:{Question:'Define mass density.'},errors:[],warnings:[],selected:false,removed:false,faculty_confirmed:false}];
 const preview={id:'i1',filename:'Fluid mechanics.xlsx',status:'NEEDS_CORRECTION',revision:1,columns:['Question','marks'],mapping:{question_text:'Question',marks:'marks'},summary:{valid:1,errors:1},rows};
 await page.route(/\/v[13]\//,async route=>{
  const path=new URL(route.request().url()).pathname;let json:unknown={items:[]};
  if(path.endsWith('/users/me'))json={user_id:'faculty',name:'Faculty',email:'faculty@example.edu'};
  if(path.endsWith('/college/access'))json={enabled:true,college_name:'Demo College'};
  if(path.endsWith('/academic-options'))json={programs:[{code:'BTECH',display_name:'B.Tech',duration_years:4,departments:[{code:'CSE',display_name:'Computer Science'}]}],erp_subjects:[],can_setup:false,can_write:true};
  if(path.endsWith('/subjects'))json={items:[{id:'s1',code:'U24CE302',name:'Fluid Mechanics'}]};
  if(path.endsWith('/imports')&&route.request().method()==='POST')json=preview;
  if(path.endsWith('/imports/i1/rows/r1')){preview.rows[0].errors=[];preview.summary={valid:2,errors:0};preview.revision++;json=preview;}
  await route.fulfill({json});
 });
 await page.goto('/dashboard/question-papers/question-bank?view=imports');
 await page.getByRole('button',{name:'Choose file',exact:true}).click();
 const dialog=page.getByRole('dialog');
 await dialog.locator('input[type=file]').setInputFiles({name:'questions.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:Buffer.from('fixture')});
 await dialog.getByRole('button',{name:'Upload and preview',exact:true}).click();
 await expect(dialog.getByText('Define mass density.',{exact:true})).toBeVisible();
 await expect(dialog.locator('table')).toHaveCount(0);
 await expect(dialog.getByText('IMPORT INTO',{exact:true})).toBeVisible();
 await expect(dialog.getByLabel('Select row 1')).toBeDisabled();
 await expect(dialog.getByLabel('Select row 2')).toBeEnabled();
 await dialog.getByRole('checkbox',{name:'Only show questions needing correction'}).check();
 await expect(dialog.getByText('Define mass density.',{exact:true})).toHaveCount(0);
 await dialog.getByRole('button',{name:'Edit row 1',exact:true}).click();
 await expect(dialog.getByLabel('Row Question Text',{exact:true})).toHaveValue('State Newton’s law of viscosity.');
 await dialog.getByLabel('Row Question Type',{exact:true}).selectOption('SHORT_ANSWER');
 await dialog.getByLabel('Row Bloom Level',{exact:true}).selectOption('K1');
 await dialog.getByRole('button',{name:'Save correction',exact:true}).click();
 await expect(dialog.getByRole('region',{name:'Correct row 1'})).toHaveCount(0);
 await expect(dialog.getByText('No questions need correction.',{exact:true})).toBeVisible();
 await dialog.getByRole('checkbox',{name:'Only show questions needing correction'}).uncheck();
 await expect(dialog.getByText('Define mass density.',{exact:true})).toBeVisible();
 await page.setViewportSize({width:390,height:844});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
