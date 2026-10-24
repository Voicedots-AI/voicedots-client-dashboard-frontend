import {test,expect,type Page} from '@playwright/test';
import {setupStudio,fixtures} from './helpers/paper-studio';
async function simplePaper(page:Page){
 const state=fixtures();state.config.layout_style='STANDARD';(state.config as any).institution_name='Test College';
 state.papers[0].items=state.papers[0].items.map((item,i)=>({...item,snapshot:{...state.questions[i]},question_version:1}));
 const result=await setupStudio(page,state);await page.getByRole('button',{name:'Software Engineering Midterm',exact:true}).click();
 await expect(page.getByRole('navigation',{name:'Paper editing sections'})).toBeVisible();return result;
}

test('fix an existing simple paper from export and save the layout in a new revision',async({page})=>{
 const {state,pageErrors}=await simplePaper(page);const originalItems=JSON.stringify(state.papers[0].items);
 await page.getByRole('button',{name:'Review & Export',exact:true}).click();
 let dialog=page.getByRole('dialog',{name:'Download Question Paper',exact:true});await expect(dialog.getByRole('region',{name:'Paper layout guidance'})).toBeVisible();
 await dialog.getByRole('button',{name:'Use organized exam layout',exact:true}).click();
 await expect.poll(()=>(state.papers[0].metadata as any).document_style?.layout_style).toBe('UNIVERSITY');
 await expect(dialog.getByText('Organized exam layout · Marks / K-Level / CO',{exact:true})).toBeVisible();
 expect(state.papers[0].revision).toBe(5);expect(JSON.stringify(state.papers[0].items)).toBe(originalItems);
 await dialog.getByRole('button',{name:'Close',exact:true}).click();
 await expect(page.getByRole('article',{name:'University Document Preview'})).toBeVisible();
 await expect(page.locator('.qpg-studio-preview').getByText('Reg. No.',{exact:true})).toBeVisible();
 expect(pageErrors).toEqual([]);
});

test('layout is an explicit customizable saved setting',async({page})=>{
 const {state}=await simplePaper(page);await page.getByRole('button',{name:'Customize paper',exact:true}).click();
 await page.getByLabel('Paper layout',{exact:true}).selectOption('UNIVERSITY');await expect(page.getByRole('article',{name:'University Document Preview'})).toBeVisible();
 await expect(page.locator('.qpg-studio-preview').getByText('K2',{exact:true}).first()).toBeVisible();
 await page.getByRole('button',{name:'Save Draft',exact:true}).click();await expect.poll(()=>(state.papers[0].metadata as any).document_style?.layout_style).toBe('UNIVERSITY');
 await page.getByLabel('Paper layout',{exact:true}).selectOption('STANDARD');await page.getByRole('button',{name:'Save Draft',exact:true}).click();
 await expect.poll(()=>(state.papers[0].metadata as any).document_style?.layout_style).toBe('STANDARD');
 await expect(page.getByRole('article',{name:'University Document Preview'})).toHaveCount(0);
});
