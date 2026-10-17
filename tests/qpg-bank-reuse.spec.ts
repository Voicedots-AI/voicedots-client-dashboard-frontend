import {test,expect} from '@playwright/test';
import {fixtures,setupStudio} from './helpers/paper-studio';
test('a compatible bank match shows Using saved question and needs no regeneration',async({page})=>{
 const state=fixtures();const pos=state.build.positions[0];const result=pos.job.results[0];result.decision='PENDING';result.duplicate=true;result.review_status=null;
 await setupStudio(page,state);
 await page.route(`**/generation-jobs/${pos.job.id}/results/${result.id}/accept`,async route=>{
  Object.assign(result,{decision:'ACCEPTED',duplicate:false,question_id:result.question.id,question_version:1,review_status:'APPROVED',reused_from_bank:true});pos.job.revision++;
  await route.fulfill({json:pos.job});
 });
 await page.getByRole('button',{name:'Software Engineering Midterm',exact:true}).click();await expect(page.getByRole('navigation',{name:'Paper editing sections'})).toBeVisible();await page.getByRole('button',{name:'Review AI questions',exact:true}).click();await page.getByRole('button',{name:'Add ready questions to paper',exact:true}).click();
 await expect.poll(()=>result.decision).toBe('ACCEPTED');
 await page.getByRole('button',{name:'All questions (4)',exact:true}).click();await expect(page.getByText(/Q1 ·.*Using saved question/)).toBeVisible();
 expect(state.mutations.some(m=>m.path.includes('/regenerate'))).toBe(false);
});

test('matching wording with different requirements saves a separate editable bank variant',async({page})=>{
 const state=fixtures();const pos=state.build.positions[0];const result=pos.job.results[0];result.decision='PENDING';result.duplicate=true;result.review_status=null;
 await setupStudio(page,state);
 await page.route(`**/generation-jobs/${pos.job.id}/results/${result.id}/accept`,async route=>{
  Object.assign(result,{decision:'ACCEPTED',duplicate:false,question_id:'separate-variant',question_version:1,review_status:'APPROVED',variant_from_bank:true,bank_variant_of:['original-bank-question']});pos.job.revision++;
  await route.fulfill({json:pos.job});
 });
 await page.getByRole('button',{name:'Software Engineering Midterm',exact:true}).click();await page.getByRole('button',{name:'Review AI questions',exact:true}).click();
 await expect(page.getByText('Matching bank wording found.',{exact:false}).first()).toBeVisible();
 await page.getByRole('button',{name:'Add ready questions to paper',exact:true}).click();
 await expect.poll(()=>result.decision).toBe('ACCEPTED');await page.getByRole('button',{name:'All questions (4)',exact:true}).click();
 await page.getByText(/Q1 ·.*Ready in bank/).click();await expect(page.getByText('Saved as a separate bank variant',{exact:true})).toBeVisible();
 await expect(page.getByText('The original bank question is unchanged.',{exact:false})).toBeVisible();
 expect(state.mutations.some(m=>m.path.includes('/regenerate'))).toBe(false);
});
