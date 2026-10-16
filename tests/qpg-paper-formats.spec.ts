import {test,expect} from '@playwright/test';
import {setupStudio,model,openDraft} from './helpers/paper-studio';
import type {PaperTemplate} from '../src/pages/dashboard/QpgTemplatesPanel';

async function formats(page:Parameters<typeof setupStudio>[0]){
 const {state}=await setupStudio(page);let rows:PaperTemplate[]=[];const calls:{path:string;body:unknown}[]=[];
 await page.route('**/question-papers/templates',async route=>{
  if(route.request().method()==='POST'){const body=route.request().postDataJSON();calls.push({path:'save',body});rows.push({...body,id:'format-1',version:1,revision:1,status:'DRAFT',used:false,has_logo:false});return route.fulfill({status:201,json:rows[0]});}
  return route.fulfill({json:{items:rows,can_write:true,branding:{name:'Test College'}}});
 });
 await page.route('**/question-papers/templates/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path.endsWith('/inspect'))return route.fulfill({json:{name:'Uploaded college format',institution_name:'Test College',total_marks:null,duration_minutes:null,sections:[],warnings:['Verify detected details against the original.'],text:'Test College reference paper',text_truncated:false}});
  const body=route.request().method()==='POST'?route.request().postDataJSON():null;calls.push({path,body});
  if(path.endsWith('/format-preview'))return route.fulfill({json:{render_model:model(state)}});
  if(path.endsWith('/activate')){rows[0].status='ACTIVE';rows[0].revision++;return route.fulfill({json:rows[0]});}
  if(path.endsWith('/prepare-pattern'))return route.fulfill({json:{id:'format-pattern',version:1,status:'PUBLISHED',syllabus_version_id:'sv',config:rows[0].configuration.paper_pattern}});
  return route.fulfill({json:{render_model:model(state)}});
 });
 await page.getByRole('button',{name:'＋ New Paper',exact:true}).click();await page.getByLabel('Paper syllabus',{exact:true}).selectOption('sv');await page.getByRole('button',{name:'Paper Formats',exact:true}).click();
 return {calls,getRows:()=>rows};
}

test('uploaded format requires correction, preview and confirmation before saving',async({page})=>{
 const {calls,getRows}=await formats(page);
 await page.getByRole('button',{name:'Upload format',exact:true}).click();const upload=page.getByRole('dialog',{name:'Upload paper format'});
 await upload.getByLabel('Format reference document').setInputFiles({name:'reference.docx',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',buffer:Buffer.from('mocked reader')});await upload.getByRole('button',{name:'Read format',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Review paper format'});await expect(dialog.getByLabel('Format name')).toHaveValue('Uploaded college format');await expect(dialog.getByRole('button',{name:'Save format draft'})).toBeDisabled();await expect(dialog.getByRole('button',{name:'Build preview'})).toBeDisabled();
 await dialog.getByRole('button',{name:'Exam structure',exact:true}).click();await expect(dialog.getByLabel('Maximum marks')).toHaveValue('');await expect(dialog.getByLabel('Duration (minutes)')).toHaveValue('');await dialog.getByLabel('Use a starting structure').selectOption('two-parts');
 await dialog.getByRole('button',{name:'Build preview'}).click();await expect(dialog.getByText('Sample positions only.',{exact:false})).toBeVisible();await expect(dialog.getByRole('button',{name:'Save format draft'})).toBeDisabled();
 await dialog.getByRole('checkbox',{name:/I checked/}).check();await dialog.getByRole('button',{name:'Save format draft'}).click();await expect(dialog).toHaveCount(0);
 expect(getRows()[0].configuration.paper_pattern?.sections[1].marks_each).toBe(16);expect(getRows()[0].status).toBe('DRAFT');
 await page.getByRole('button',{name:'Activate format',exact:true}).click();await expect(page.getByRole('button',{name:'Use format',exact:true})).toBeVisible();await page.getByRole('button',{name:'Use format',exact:true}).click();await expect(page.getByText('Its design and exam structure will be used',{exact:false})).toBeVisible();
 expect(calls.some(c=>c.path.endsWith('/prepare-pattern'))).toBe(true);expect(calls.filter(c=>c.path==='save')).toHaveLength(1);
});

test('changing a previewed format invalidates confirmation',async({page})=>{
 await formats(page);await page.getByRole('button',{name:'Create format',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Review paper format'});await dialog.getByRole('button',{name:'Build preview'}).click();await dialog.getByRole('checkbox',{name:/I checked/}).check();await expect(dialog.getByRole('button',{name:'Save format draft'})).toBeEnabled();await dialog.getByRole('button',{name:'Appearance',exact:true}).click();await dialog.getByLabel('College name',{exact:true}).fill('Corrected College');await expect(dialog.getByRole('button',{name:'Save format draft'})).toBeDisabled();
});

test('upload rejects unsupported and empty files before sending',async({page})=>{
 const {calls}=await formats(page);await page.getByRole('button',{name:'Upload format',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Upload paper format'});await dialog.getByLabel('Format reference document').setInputFiles({name:'wrong.xlsx',mimeType:'application/octet-stream',buffer:Buffer.from('test')});await expect(dialog.getByRole('alert')).toContainText('PDF or DOCX');await expect(dialog.getByRole('button',{name:'Read format'})).toBeDisabled();expect(calls).toHaveLength(0);
});

test('existing draft is unchanged while creating a format',async({page})=>{
 const {state}=await setupStudio(page);await openDraft(page);const before=structuredClone(state.papers[0]);await page.getByRole('button',{name:'Paper Formats',exact:true}).click();await expect(page.getByText('Formats are applied when creating a new paper.',{exact:false})).toBeVisible();await page.getByRole('button',{name:'Create format',exact:true}).click();await expect(page.getByRole('dialog',{name:'Review paper format'})).toBeVisible();expect(state.papers[0]).toEqual(before);expect(state.mutations).toHaveLength(0);
});
