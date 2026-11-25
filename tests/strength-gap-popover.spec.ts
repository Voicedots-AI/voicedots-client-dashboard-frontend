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
