import {test,expect} from '@playwright/test';
import {setupStudio,openDraft} from './helpers/paper-studio';

test('paper details override printed college without a Design setup tab',async({page})=>{
 const {state}=await setupStudio(page);await openDraft(page);
 await expect(page.getByRole('button',{name:'Design & setup',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Paper details',exact:true}).click();await page.getByLabel('Printed college name',{exact:true}).fill('Meenakshi Engineering College');await page.getByLabel('College short name',{exact:true}).fill('MSEC');await page.getByLabel('Printed year',{exact:true}).fill('3');
 await expect(page.locator('.qpg-preview-sheet')).toContainText('Meenakshi Engineering College');expect(state.mutations).toHaveLength(0);
 await page.getByRole('button',{name:'Save Draft',exact:true}).click();await expect(page.getByText('Paper details saved.',{exact:false})).toBeVisible();
 expect((state.papers[0].metadata as any).document_details.institution_name).toBe('Meenakshi Engineering College');
 await page.getByRole('button',{name:'← My Papers',exact:true}).click();await openDraft(page);await page.getByRole('button',{name:'Paper details',exact:true}).click();await expect(page.getByLabel('Printed college name',{exact:true})).toHaveValue('Meenakshi Engineering College');
});

test('selecting a section heading opens formatting and persists alignment and font',async({page})=>{
 const {state}=await setupStudio(page);await openDraft(page);const preview=page.locator('.qpg-studio-preview');
 await preview.getByRole('button',{name:/Customize section:/}).first().click();await expect(preview.getByLabel('Section heading alignment',{exact:true})).toBeFocused();
 await preview.getByLabel('Section heading alignment',{exact:true}).selectOption('CENTER');await preview.getByLabel('Section heading size',{exact:true}).fill('18');await preview.getByLabel('Question font size',{exact:true}).fill('12');await preview.getByLabel('Question spacing (pt)',{exact:true}).fill('10');
 await expect(preview.locator('.qpg-preview-sheet section h4').first()).toHaveCSS('text-align','center');await expect(preview.locator('.qpg-preview-sheet section h4').first()).toHaveCSS('font-size','24px');expect(state.mutations).toHaveLength(0);
 await page.getByRole('button',{name:'Save Draft',exact:true}).click();await expect(page.getByText('Paper details saved.',{exact:false})).toBeVisible();expect((state.papers[0].metadata as any).document_style.section_alignment).toBe('CENTER');
 await page.getByRole('button',{name:'← My Papers',exact:true}).click();await openDraft(page);await expect(page.locator('.qpg-studio-preview .qpg-preview-sheet section h4').first()).toHaveCSS('text-align','center');
});

test('customization survives canceled navigation and reset returns to format settings',async({page})=>{
 await setupStudio(page);await openDraft(page);const preview=page.locator('.qpg-studio-preview');await preview.getByText('Customize paper',{exact:true}).click();await preview.getByLabel('Section heading alignment',{exact:true}).selectOption('RIGHT');
 page.once('dialog',d=>d.dismiss());await page.getByRole('button',{name:'← My Papers',exact:true}).click();await expect(preview.getByLabel('Section heading alignment',{exact:true})).toHaveValue('RIGHT');await preview.getByRole('button',{name:'Reset paper formatting',exact:true}).click();await expect(preview.getByLabel('Section heading alignment',{exact:true})).toHaveValue('');
});

test('locked paper customization is read only until a new version exists',async({page})=>{
 await setupStudio(page);await page.getByRole('button',{name:'Final exam',exact:true}).click();await expect(page.locator('.qpg-studio-preview').getByText('Customize paper',{exact:true})).toHaveCount(0);await page.getByRole('button',{name:'Paper details',exact:true}).click();await expect(page.getByLabel('Printed college name',{exact:true})).toBeDisabled();
});
