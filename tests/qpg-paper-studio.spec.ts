import {test,expect} from '@playwright/test';
import {fixtures,setupStudio,openDraft} from './helpers/paper-studio';

test('library filters, search, counts and context',async({page})=>{
 const {pageErrors}=await setupStudio(page);const library=page.getByRole('region',{name:'My papers'});
 await expect(library.locator('tbody tr')).toHaveCount(5);
 await page.getByRole('button',{name:'Awaiting Review 1',exact:true}).click();await expect(library.locator('tbody tr')).toHaveCount(1);await expect(page.getByRole('button',{name:'Review',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Final 2',exact:true}).click();await expect(library.locator('tbody tr')).toHaveCount(2);await expect(page.getByRole('button',{name:'Download',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Finalize',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'All 5',exact:true}).click();await page.getByRole('searchbox',{name:'Search papers'}).fill('returned');await expect(library.locator('tbody tr')).toHaveCount(1);
 await page.getByRole('searchbox').fill('no-such-paper');await expect(page.getByText('No matching papers')).toBeVisible();await page.getByRole('button',{name:'Show all papers'}).click();await expect(library.locator('tbody tr')).toHaveCount(5);expect(pageErrors).toEqual([]);
});
test('library state survives editor round trip and top My Papers works',async({page})=>{
 await setupStudio(page);await page.getByRole('button',{name:'Drafts 2',exact:true}).click();await page.getByRole('searchbox').fill('midterm');await openDraft(page);
 await page.getByRole('navigation',{name:'Question paper sections'}).getByRole('button',{name:'My Papers',exact:true}).click();await expect(page.getByRole('searchbox')).toHaveValue('midterm');await expect(page.getByRole('button',{name:'Drafts 2'})).toHaveAttribute('aria-pressed','true');
});
test('candidate preview contains all questions, correct marks and no writes on load',async({page})=>{
 const {state,pageErrors}=await setupStudio(page);await openDraft(page);await expect(page.locator('.qpg-preview-sheet')).toContainText('Analyze risk management');await expect(page.locator('.qpg-studio-progress')).toContainText('3 ready');await expect(page.getByRole('button',{name:'Check Paper',exact:true})).toBeDisabled();
 const nav=page.getByRole('region',{name:'Question navigator'});await expect(nav.getByRole('button',{name:/Question /})).toHaveCount(4);await expect(nav.getByRole('button',{name:/Question 3b/})).toHaveClass('attention');expect(state.mutations).toHaveLength(0);expect(pageErrors).toEqual([]);
});
test('navigator locates OR question in editor and preview',async({page})=>{
 await setupStudio(page);await openDraft(page);await page.getByRole('region',{name:'Question navigator'}).getByRole('button',{name:/Question 3b/}).click();await expect(page.locator('#qpg-position-slot-3b')).toBeFocused();await expect(page.locator('.qpg-preview-canvas [data-preview-question="3b"]')).toHaveAttribute('data-navigator-selected','true');await expect(page.locator('.qpg-preview-canvas [data-preview-question="3b"]')).toBeInViewport();
});
test('clickable issues show duplicate comparison and open exact editor',async({page})=>{
 await setupStudio(page);await openDraft(page);await page.getByRole('button',{name:'1 need attention ↗',exact:true}).first().click();const issues=page.getByRole('dialog',{name:'Questions needing attention (1)'});await expect(issues).toContainText('Same wording as Q3a');await expect(issues.locator('.qpg-duplicate-comparison section')).toHaveCount(2);await issues.getByRole('button',{name:'Edit candidate',exact:true}).click();const editor=page.getByRole('dialog',{name:'Edit AI paper draft'});await expect(editor).toBeVisible();await expect(editor.getByLabel('Candidate question',{exact:true})).toHaveValue('Analyze risk management with examples.');await expect(editor).toContainText('16 marks');
});
test('regenerate is confirmation only until explicitly confirmed',async({page})=>{
 const {state}=await setupStudio(page);await openDraft(page);await page.getByRole('button',{name:'1 need attention ↗',exact:true}).first().click();await page.getByRole('dialog').getByRole('button',{name:'Regenerate',exact:true}).click();await expect(page.getByRole('dialog',{name:'Regenerate Q3b?'})).toBeVisible();await page.getByRole('dialog').getByRole('button',{name:'Cancel',exact:true}).click();expect(state.mutations).toHaveLength(0);
});
test('live details update without network writes; explicit save persists',async({page})=>{
 const {state}=await setupStudio(page);await openDraft(page);await page.getByRole('button',{name:'Paper details',exact:true}).click();await page.getByLabel('Examination session',{exact:true}).fill('November session');await page.getByLabel('Paper instructions',{exact:true}).fill('Use a blue pen.');await expect(page.locator('.qpg-preview-sheet')).toContainText('November session');await expect(page.locator('.qpg-preview-sheet')).toContainText('Use a blue pen.');expect(state.mutations).toHaveLength(0);await page.getByRole('button',{name:'Save Draft',exact:true}).click();await expect(page.getByText('Paper details saved.',{exact:false})).toBeVisible();expect(state.papers[0].metadata.instructions).toBe('Use a blue pen.');
});
test('unsaved details survive cancel and confirmed navigation back',async({page})=>{
 await setupStudio(page);await openDraft(page);await page.getByRole('button',{name:'Paper details',exact:true}).click();await page.getByLabel('Paper title',{exact:true}).fill('Unsaved renamed paper');page.once('dialog',d=>d.dismiss());await page.getByRole('button',{name:'← My Papers',exact:true}).click();await expect(page.getByLabel('Paper title',{exact:true})).toHaveValue('Unsaved renamed paper');page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'← My Papers',exact:true}).click();await openDraft(page);await page.getByRole('button',{name:'Paper details',exact:true}).click();await expect(page.getByLabel('Paper title',{exact:true})).toHaveValue('Unsaved renamed paper');
});
test('save conflicts retain unsaved content and show actionable error',async({page})=>{
 const state=fixtures();state.conflict=true;await setupStudio(page,state);await openDraft(page);await page.getByRole('button',{name:'Paper details',exact:true}).click();await page.getByLabel('Paper title',{exact:true}).fill('Keep my changes');await page.getByRole('button',{name:'Save Draft',exact:true}).click();await expect(page.getByRole('alert').filter({hasText:'The paper changed'})).toBeVisible();await expect(page.getByLabel('Paper title',{exact:true})).toHaveValue('Keep my changes');expect(state.papers[0].title).toBe('Software Engineering Midterm');
});
test('duplicate edit then single add action saves and assembles through existing APIs',async({page})=>{
 const {state}=await setupStudio(page);await openDraft(page);await page.getByRole('button',{name:'1 need attention ↗',exact:true}).first().click();await page.getByRole('dialog').getByRole('button',{name:'Edit candidate',exact:true}).click();const editor=page.getByRole('dialog',{name:'Edit AI paper draft'});await editor.getByLabel('Candidate question',{exact:true}).fill('Assess risk exposure quantitatively using a worked software project example.');await editor.getByRole('button',{name:'Save changes',exact:true}).click();await expect(editor).toContainText('Question 3b saved');await editor.getByRole('button',{name:'Done editing',exact:true}).click();await page.getByRole('button',{name:'Add ready questions to paper',exact:true}).click();await expect.poll(()=>state.papers[0].items.filter(i=>i.snapshot).length).toBe(4);await expect(page.getByRole('button',{name:'Check Paper',exact:true})).toBeEnabled();expect(state.mutations.some(m=>m.path.endsWith('/assemble'))).toBe(true);expect(state.mutations.some(m=>m.path.includes('/regenerate'))).toBe(false);
});
test('failed duplicate acceptance preserves ready questions and blocks assembly',async({page})=>{
 const {state}=await setupStudio(page);await openDraft(page);await page.getByRole('button',{name:'Review AI questions',exact:true}).click();await page.getByRole('button',{name:'Add ready questions to paper',exact:true}).click();await expect(page.getByRole('alert').filter({hasText:'still need a compatible question'})).toBeVisible();expect(state.build.positions.filter(p=>p.job.results[0].decision==='ACCEPTED')).toHaveLength(3);expect(state.mutations.some(m=>m.path.endsWith('/assemble'))).toBe(false);
});
test('locked paper download opens template confirmation without exporting',async({page})=>{
 const {state}=await setupStudio(page);await page.getByRole('button',{name:'Final 2',exact:true}).click();await page.getByRole('button',{name:'Download',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Download Final Paper'});await expect(dialog).toBeVisible();await expect(dialog.getByRole('region',{name:'Confirm export details'})).toContainText('Test College');await expect(dialog).toContainText('20');await expect(dialog).toContainText('CS304PC');expect(state.mutations.some(m=>m.path.endsWith('/export'))).toBe(false);await dialog.getByRole('button',{name:'Close',exact:true}).click();await expect(page.getByLabel('Paper title',{exact:true})).not.toBeVisible();await page.getByRole('button',{name:'Paper details',exact:true}).click();await expect(page.getByLabel('Paper title',{exact:true})).toBeDisabled();
});
test('approved paper opens finalize action; it is not offered as downloadable',async({page})=>{
 const {state}=await setupStudio(page);await page.getByRole('button',{name:'Finalize',exact:true}).click();await expect(page.getByRole('button',{name:'Finalize and Lock',exact:true})).toBeVisible();expect(state.mutations).toHaveLength(0);
});
test('new version preserves original locked paper',async({page})=>{
 const {state}=await setupStudio(page);await page.getByRole('button',{name:'Final exam',exact:true}).click();await page.getByRole('button',{name:'Edit paper',exact:true}).click();await page.getByRole('button',{name:'Create editable draft',exact:true}).click();await expect(page.getByLabel('Paper title',{exact:true})).toBeEnabled();expect(state.papers.find(p=>p.id==='locked')?.status).toBe('LOCKED');expect(state.papers.find(p=>p.id==='new-version')?.version).toBe(2);
});
test('preview failure offers retry without erasing paper state',async({page})=>{
 const state=fixtures();state.previewFails=100;await setupStudio(page,state);await openDraft(page);await expect(page.getByRole('button',{name:'Retry preview',exact:true})).toBeVisible();state.previewFails=0;await page.getByRole('button',{name:'Retry preview',exact:true}).click();await expect(page.locator('.qpg-preview-sheet')).toContainText('Analyze risk management');expect(state.mutations).toHaveLength(0);
});
test('initial list failure recovers without a full page reload',async({page})=>{
 const state=fixtures();state.listFails=1;await setupStudio(page,state);await expect(page.getByRole('alert')).toContainText('Paper list unavailable');await page.getByRole('button',{name:'Refresh',exact:true}).click();await expect(page.getByRole('region',{name:'My papers'}).locator('tbody tr')).toHaveCount(5);await expect(page.getByRole('button',{name:'＋ New Paper',exact:true})).toBeVisible();
});
test('read-only access cannot create, edit or regenerate',async({page})=>{
 const state=fixtures();state.readOnly=true;await setupStudio(page,state);await expect(page.getByRole('button',{name:'＋ New Paper',exact:true})).toHaveCount(0);await page.getByRole('button',{name:'Software Engineering Midterm',exact:true}).click();await expect(page.getByRole('button',{name:'Save Draft',exact:true})).toHaveCount(0);await page.getByRole('button',{name:'Paper details',exact:true}).click();await expect(page.getByLabel('Paper title',{exact:true})).toBeDisabled();expect(state.mutations).toHaveLength(0);
});
test('mobile library and editor have no page-level horizontal overflow',async({page})=>{
 await page.setViewportSize({width:390,height:844});await setupStudio(page);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await openDraft(page);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'test-results/paper-studio-mobile.png',fullPage:true});
});
test('full controls remain available and returning to simple retains paper',async({page})=>{
 await setupStudio(page);await openDraft(page);await page.getByRole('button',{name:'Full controls',exact:true}).click();await expect(page.getByRole('navigation',{name:'Legacy paper views'})).toBeVisible();await expect(page.getByLabel('Saved papers',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Simple editor',exact:true}).click();await expect(page.getByRole('navigation',{name:'Legacy paper views'})).not.toBeVisible();await expect(page.locator('.qpg-studio-progress')).toContainText('3 ready');
});

test('new paper uses a published syllabus and exact selected pattern',async({page})=>{
 const {state}=await setupStudio(page);await page.getByRole('button',{name:'＋ New Paper',exact:true}).click();await expect(page.getByRole('button',{name:'Create Paper',exact:true})).toBeDisabled();await page.getByLabel('Paper syllabus',{exact:true}).selectOption('sv');await page.locator('.qpg-studio-patterns button').filter({hasText:'20 marks'}).click();await page.getByRole('button',{name:'Create Paper',exact:true}).click();await expect(page.getByRole('region',{name:'Question navigator'})).toBeVisible();expect(state.mutations.find(m=>m.path.endsWith('/papers'))?.body).toEqual({subject_id:'studio-subject',syllabus_version_id:'sv',blueprint_id:'bp'});expect(state.papers.find(p=>p.id==='draft')?.revision).toBe(4);
});
test('active generation blocks paper changes, checks and returning to library',async({page})=>{
 const state=fixtures();state.build.status='RUNNING';await setupStudio(page,state);await openDraft(page);await expect(page.getByRole('button',{name:'Save Draft',exact:true})).toBeDisabled();await expect(page.getByRole('button',{name:'← My Papers',exact:true})).toBeDisabled();await expect(page.getByRole('button',{name:'Check Paper',exact:true})).toBeDisabled();await page.getByRole('button',{name:'Paper details',exact:true}).click();await expect(page.getByLabel('Paper title',{exact:true})).toBeDisabled();expect(state.mutations).toHaveLength(0);
});
test('safe reconnection preserves every generated result',async({page})=>{
 const state=fixtures();state.build.stale=true;state.build.paper_revision=3;const before=JSON.stringify(state.build.positions);await setupStudio(page,state);await openDraft(page);await expect.poll(()=>state.build.stale).toBe(false);await expect(page.locator('.qpg-preview-sheet')).toContainText('Analyze risk management');expect(JSON.stringify(state.build.positions)).toBe(before);expect(state.mutations).toHaveLength(1);expect(state.mutations[0].path).toContain('/rebase');
});
test('structural conflict keeps candidates but prevents unsafe edits and assembly',async({page})=>{
 const state=fixtures();state.build.stale=true;state.rebaseFails=true;const before=JSON.stringify(state.build.positions);await setupStudio(page,state);await openDraft(page);await page.getByRole('button',{name:'Review AI questions',exact:true}).click();await expect(page.getByRole('alert').filter({hasText:'The syllabus or pattern changed'})).toBeVisible();await expect(page.getByRole('button',{name:'Add ready questions to paper',exact:true})).toHaveCount(0);expect(JSON.stringify(state.build.positions)).toBe(before);expect(state.mutations.every(m=>m.path.endsWith('/rebase'))).toBe(true);
});
test('manual question editor preserves the 16-mark paper position',async({page})=>{
 await setupStudio(page);await openDraft(page);await page.getByRole('button',{name:'Add manually',exact:true}).first().click();const choose=page.getByRole('dialog',{name:'Add a question manually'});await choose.getByLabel('Paper part',{exact:true}).selectOption('b');await choose.getByLabel('Question position',{exact:true}).selectOption('slot-3b');await choose.getByRole('button',{name:'Write question'}).click();const form=page.getByRole('dialog',{name:'Add question manually · Q3b'});await expect(form).toContainText('16 marks');await expect(form.getByRole('button',{name:'Save and map question'})).toBeDisabled();
});
test('bank picker defaults to the exact 16 marks and assigns the chosen version',async({page})=>{
 const {state}=await setupStudio(page);await openDraft(page);await page.getByRole('button',{name:'1 need attention ↗',exact:true}).first().click();await page.getByRole('dialog').getByRole('button',{name:'Replace from bank',exact:true}).click();const picker=page.getByRole('dialog',{name:'Map saved question · Q3b'});await expect(picker.getByLabel('Picker Marks',{exact:true})).toHaveValue('16');await picker.getByRole('button',{name:'Use Question',exact:true}).first().click();await expect.poll(()=>state.papers[0].items[3].snapshot?.marks).toBe(16);const assignment=state.mutations.find(m=>m.path.endsWith('/items/slot-3b'));expect(assignment?.body.expected_question_version).toBe(1);expect(assignment?.body.expected_revision).toBe(4);
});
test('checked paper submits through faculty review and appears in the right filter',async({page})=>{
 const state=fixtures();state.papers[0].items=structuredClone(state.papers[1].items);await setupStudio(page,state);await page.getByRole('button',{name:'Software Engineering Midterm',exact:true}).click();await page.getByRole('button',{name:'Check Paper',exact:true}).click();await page.getByRole('button',{name:'Send for Faculty Review',exact:true}).click();await expect(page.getByRole('button',{name:'Awaiting Review 2',exact:true})).toHaveAttribute('aria-pressed','true');await expect(page.getByRole('region',{name:'My papers'}).locator('tbody tr')).toHaveCount(2);expect(state.papers[0].status).toBe('FACULTY_REVIEW');
});
for(const width of [320,768])test(`responsive library and paper controls at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});await setupStudio(page);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await openDraft(page);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
