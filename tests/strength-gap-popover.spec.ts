import {interviewEvidence,selectEvidenceReport} from '../src/pages/dashboard/interviewEvidence';
import {test,expect} from '@playwright/test';
for (const viewport of [{width:1280,height:720},{width:390,height:650}]) {
 test(`strengths popup escapes clipped cards and fits ${viewport.width}px viewport`,async({page})=>{
  await page.setViewportSize(viewport);
  await page.goto('/tests/fixtures/strength-gap-preview.html');
  const trigger=page.getByRole('button',{name:'View strengths & gaps'});
  await trigger.click();
  const dialog=page.getByRole('dialog');
  await expect(dialog).toContainText('Maintains a professional tone');
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

test('popup shows complete saved feedback, real round scores and interview date rather than reevaluation date',async({page})=>{
 await page.goto('/tests/fixtures/strength-gap-preview.html');await page.getByRole('button',{name:'View strengths & gaps'}).click();
 const popup=page.getByRole('dialog');
 await expect(popup).toContainText('Fourth saved positive observation.');
 await expect(popup).toContainText('Practice concise summaries for complex problems.');
 await expect(popup).toContainText('The saved answer did not demonstrate the claimed responsibility.');
 await expect(popup).toContainText('Describe your own contribution with a concrete example.');
 await expect(popup).toContainText('Talent Acquisition Specialist · 0/100');
 await expect(popup).toContainText('Practical Interviewer · Not assessed');
 await expect(popup).toContainText('Attempt 1 · Interview completed: 24/11/2026, 17:00 IST');
 await expect(popup).not.toContainText('27/11/2026');
 await popup.getByRole('button',{name:'Open full interview report'}).click();
 await expect(page.locator('body')).toHaveAttribute('data-opened-session','saved-evidence-session');
});
test('missing positive feedback stays unknown while recorded competency scores remain visible',async({page})=>{
 await page.goto('/tests/fixtures/strength-gap-preview.html?case=empty');await page.getByRole('button',{name:'View strengths & gaps'}).click();
 const popup=page.getByRole('dialog');await expect(popup).toContainText('No positive feedback was recorded for this attempt.');
 await expect(popup).toContainText('Communication Skills');await expect(popup).toContainText('50/100');await expect(popup).toContainText('0/100');
});

test('exact session selection cannot fall back to another attempt or drive',()=>{
 const rows=[{drive_id:'d1',session_id:'s1'},{drive_id:'d1',session_id:'s2'},{drive_id:'d2',session_id:'s3'}];
 expect(selectEvidenceReport(rows,'d1','s2')?.session_id).toBe('s2');expect(selectEvidenceReport(rows,'d1','missing')).toBeUndefined();expect(selectEvidenceReport(rows,'d1','s3')).toBeUndefined();
});
test('saved evidence is deduplicated and preserves full text and actions without inferring strengths from scores',()=>{
 const long='Complete saved feedback. '.repeat(30);const result=interviewEvidence({strengths:[long,long],question_reviews:[{strength_feedback:['Positive answer feedback.']}],priority_improvement_areas:[{focus:'Ownership',problem:'Missing example',actions:['Explain the example']}],core_dimensions:[{dimension:'communication',percentage:50}]});
 expect(result.strengths).toHaveLength(2);expect(result.strengths[0].title).toBe(long.trim());expect(result.growth[0].details).toEqual(['Missing example','Explain the example']);
 expect(interviewEvidence({core_dimensions:[{percentage:50}]}).strengths).toEqual([]);
});
