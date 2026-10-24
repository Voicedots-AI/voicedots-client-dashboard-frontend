import {test,expect,type Page} from '@playwright/test';
import {setupTemplates} from './helpers/template-flows';
async function newPaper(page:Page){await page.getByRole('button',{name:'← My Papers',exact:true}).click();await page.getByRole('button',{name:'＋ New Paper',exact:true}).click();}
async function chooseCombined(page:Page){await page.getByRole('button',{name:'Paper Formats',exact:true}).click();return page.getByRole('article').filter({has:page.getByRole('heading',{name:'Combined College Exam',exact:true})});}

test('a combined template prepares its exam pattern for the selected syllabus in a new paper',async({page})=>{
 const {calls,state}=await setupTemplates(page);await newPaper(page);await page.getByLabel('Paper syllabus',{exact:true}).selectOption('sv');const card=await chooseCombined(page);await card.getByRole('button',{name:'Use template'}).click();await expect(page.getByRole('button',{name:'Create Paper',exact:true})).toBeEnabled();const prepared=calls.find(c=>c.path.endsWith('/prepare-pattern'));expect(prepared?.body).toMatchObject({subject_id:'studio-subject',syllabus_version_id:'sv',expected_revision:1});await page.getByRole('button',{name:'Create Paper',exact:true}).click();expect(state.mutations.find(m=>m.path.endsWith('/papers')&&m.body)?.body.blueprint_id).toBe('selected-pattern');
});
test('choosing a combined template without a syllabus explains the missing selection',async({page})=>{
 const {calls}=await setupTemplates(page);await newPaper(page);const card=await chooseCombined(page);await card.getByRole('button',{name:'Use template'}).click();await expect(page.getByRole('alert')).toContainText('Select a published paper syllabus');expect(calls.some(c=>c.path.endsWith('/prepare-pattern'))).toBe(false);
});
test('a saved design-only template can be chosen before an exam pattern',async({page})=>{
 const {calls}=await setupTemplates(page);await newPaper(page);await page.getByRole('button',{name:'Paper Formats',exact:true}).click();await page.getByRole('article').filter({has:page.getByRole('heading',{name:/Test College Exam/})}).getByRole('button',{name:'Use template'}).click();await expect(page.getByLabel('Paper syllabus',{exact:true})).toBeVisible();expect(calls.some(c=>c.path.endsWith('/prepare-pattern'))).toBe(false);
});
test('read-only users can view templates but have no create or activation controls',async({page})=>{
 await setupTemplates(page,{readonly:true});await expect(page.getByRole('button',{name:'Create template',exact:true})).toHaveCount(0);await page.getByRole('button',{name:'Choose template',exact:true}).click();await expect(page.getByRole('button',{name:'Preview',exact:true}).first()).toBeVisible();await expect(page.getByRole('button',{name:'Create template',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'Save & activate'})).toHaveCount(0);
});
