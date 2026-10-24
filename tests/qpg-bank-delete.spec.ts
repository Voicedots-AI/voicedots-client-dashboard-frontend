import {test,expect,type Page} from '@playwright/test';
import {setupStudio} from './helpers/paper-studio';
async function bank(page:Page){
 const {state,pageErrors}=await setupStudio(page);const requests:any[]=[];
 await page.route('**/question-papers/questions?**',route=>route.fulfill({json:{items:state.questions,total:state.questions.length}}));
 await page.route('**/question-papers/questions/bulk-delete',async route=>{const body=route.request().postDataJSON();requests.push(body);const n=body.mode==='all'?state.questions.length:body.questions.length;state.questions=body.mode==='all'?[]:state.questions.filter(q=>!body.questions.some((item:any)=>item.id===q.id));await route.fulfill({json:{deleted_count:n}});});
 await page.goto('/dashboard/question-papers/question-bank?view=bank');
 await expect(page.getByRole('checkbox',{name:'Select all questions on this page',exact:true})).toBeVisible();
 return {state,requests,pageErrors};
}
test('delete selected requires typed confirmation and sends versions',async({page})=>{
 const {requests,pageErrors}=await bank(page);
 await expect(page.getByRole('button',{name:'Delete selected',exact:true})).toBeDisabled();
 await page.getByRole('checkbox',{name:'Select question: Explain software engineering concept 1.',exact:true}).check();
 await page.getByRole('button',{name:'Delete selected',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Delete selected questions?',exact:true});
 await expect(dialog.getByRole('button',{name:'Delete selected',exact:true})).toBeDisabled();
 await dialog.getByLabel('Type delete to confirm').fill('delete');await dialog.getByRole('button',{name:'Delete selected',exact:true}).click();
 await expect(dialog).not.toBeVisible();expect(requests).toEqual([{subject_id:'studio-subject',mode:'selected',confirmation:'delete',questions:[{id:'q-0',expected_version:1}]}]);
 await expect(page.getByText('1 question deleted.',{exact:true})).toBeVisible();expect(pageErrors).toEqual([]);
});
test('delete all explains scope and cancel does not mutate',async({page})=>{
 const {requests}=await bank(page);await page.getByRole('button',{name:'Delete all questions',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Delete all questions?',exact:true});
 await expect(dialog).toContainText('Search and filters do not limit this action.');await dialog.getByRole('button',{name:'Cancel',exact:true}).click();expect(requests).toEqual([]);
 await page.getByRole('button',{name:'Delete all questions',exact:true}).click();await dialog.getByLabel('Type delete to confirm').fill('delete');await dialog.getByRole('button',{name:'Delete all questions',exact:true}).click();
 await expect(dialog).not.toBeVisible();expect(requests).toEqual([{subject_id:'studio-subject',mode:'all',confirmation:'delete',questions:[]}]);
});
test('changing search clears selection',async({page})=>{
 await bank(page);await page.getByRole('checkbox',{name:'Select all questions on this page',exact:true}).check();await expect(page.getByText('4 selected · Select questions on this page',{exact:true})).toBeVisible();
 await page.getByLabel('Search questions',{exact:true}).fill('routing');await expect(page.getByRole('button',{name:'Delete selected',exact:true})).toBeDisabled();
});
