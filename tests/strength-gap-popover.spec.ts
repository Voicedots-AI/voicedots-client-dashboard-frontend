import {interviewEvidence,selectEvidenceReport} from '../src/pages/dashboard/interviewEvidence';
import {test,expect} from '@playwright/test';
for (const viewport of [{width:1280,height:720},{width:390,height:650}]) {
 test(`strengths popup escapes clipped cards and fits ${viewport.width}px viewport`,async({page})=>{
  await page.setViewportSize(viewport);
  await page.goto('/tests/fixtures/strength-gap-preview.html');
  const trigger=page.getByRole('button',{name:'View strengths & gaps'});
  await trigger.click();
  const dialog=page.getByRole('dialog');
  await expect(dialog).toContainText('Communication Skills (50/100)');
  await expect(page.getByTestId('clipping-card').getByRole('dialog')).toHaveCount(0);
  const bounds=await dialog.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x+bounds!.width).toBeLessThanOrEqual(viewport.width);
  expect(bounds!.y).toBeGreaterThanOrEqual(0);
  expect(bounds!.y+bounds!.height).toBeLessThanOrEqual(viewport.height);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.getByRole('heading',{name:'Placement drive · Interview results'}).click();
  await expect(dialog).toHaveCount(0);
  await trigger.click();
  await page.getByRole('button',{name:'Close strengths and gaps'}).click();
  await expect(dialog).toHaveCount(0);
 });
}

test('strengths match only green student competencies and omit long evidence',async({page})=>{
 await page.goto('/tests/fixtures/strength-gap-preview.html');await page.getByRole('button',{name:'View strengths & gaps'}).click();const popup=page.getByRole('dialog');
 await expect(popup).toContainText('Communication Skills (50/100)');await expect(popup).toContainText('Resume Ownership (0/100)');
 await expect(popup).not.toContainText('The saved answer did not demonstrate');await expect(popup).not.toContainText('Recorded competency scores');await expect(popup).not.toContainText('Interview rounds');
 await expect(popup).toContainText('Interview completed: 24/11/2026, 17:00 IST');
 await popup.getByRole('button',{name:'Open full interview report'}).click();await expect(page.locator('body')).toHaveAttribute('data-opened-session','saved-evidence-session');
});
test('green classification matches student threshold, names, band fallback and unknown handling',()=>{
 const result=interviewEvidence({core_dimensions:[{dimension:'communication',percentage:50},{dimension:'confidence_conduct',band:2},{dimension:'resume_ownership',percentage:0},{dimension:'structured_thinking',percentage:25},{dimension:'role_awareness',band:null}]});
 expect(result.strengths.map(item=>[item.name,item.score])).toEqual([['Communication Skills',50],['Confidence & Conduct',50]]);
 expect(result.growth.map(item=>[item.name,item.score])).toEqual([['Resume Ownership',0],['Problem Solving',25]]);
 expect(interviewEvidence({strengths:['Saved prose without a score']})).toEqual({strengths:[],growth:[]});
 expect(selectEvidenceReport([{drive_id:'d',session_id:'s'}],'d','other')).toBeUndefined();
});
