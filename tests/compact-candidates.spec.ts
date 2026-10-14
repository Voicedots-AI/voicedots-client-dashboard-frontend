import { test, expect, type Page } from '@playwright/test';
import { previewDrive, previewCandidate, previewBundle } from '../preview/drive-data';

const skills = [
  ...['SQL', 'Python', 'API Design', 'An exceptionally long matching skill name that must not grow the row'].map(skill => ({ skill, match_status: 'FULL_MATCH', priority: 'mandatory' })),
  ...['Java', 'Testing', 'Missing long required qualification that must stay in its column', 'Cloud'].map(skill => ({ skill, match_status: 'NO_EVIDENCE', priority: 'mandatory' })),
];
async function setup(page: Page, options: { report?: boolean; status?: string; failSave?: boolean; failLoad?: boolean } = {}) {
  let allowed = 5, assignmentStatus = 'completed';
  const writes: Array<{ path: string; body: Record<string, unknown> }> = [];
  const queries: URL[] = [];
  const row = { ...previewCandidate, department_code: 'CSE', cgpa: 8.5, attempt_number: 2, ats_status: 'evaluated', skills, recommendation: 'Consider' };
  const pending = { ...row, student_id: 'pending', full_name: 'Pending Candidate', ats_status: 'resume_not_available', ats_fit_score: null, skills: [], report_ready: false, attempt_number: 1, assignment_status: 'invited', overall_score: null, ranking_score: null };
  const drive = { ...previewDrive, status: options.status || 'active', max_attempts: 5 };
  await page.addInitScript(() => localStorage.setItem('access_token', 'local-only-test'));
  await page.route(/\/v[13]\//, async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname;
    if (request.method() === 'PUT') {
      const body = request.postDataJSON(); writes.push({ path, body });
      if (options.failSave) return route.fulfill({ status: 403, json: { detail: 'You do not have permission to update attempts.' } });
      if (path.endsWith('/attempt-limit')) allowed = body.max_attempts;
      if (path.endsWith('/reopen')) { allowed = body.max_attempts_override; assignmentStatus = 'invited'; }
      return route.fulfill({ json: { max_attempts: allowed } });
    }
    const current = { ...row, max_attempts: allowed, assignment_status: assignmentStatus };
    if (path.endsWith('/dashboard/ranking')) {
      queries.push(url);
      const result = url.searchParams.get('q') ? [pending] : Array.from({ length: 12 }, (_, i) => i === 1 ? pending : { ...current, student_id: i === 0 ? current.student_id : `student-${i}`, full_name: i === 0 ? current.full_name : `Candidate ${i}` });
      return route.fulfill({ json: { candidates: result, pagination: { total: 30 }, filter_options: { department: ['CSE', 'ECE'], program: ['B.Tech'] } } });
    }
    if (path.endsWith('/attempts')) {
      if (options.failLoad) return route.fulfill({ status: 403, json: { detail: 'Attempt policy access denied.' } });
      return route.fulfill({ json: { max_attempts: allowed, attempts: [{ attempt_number: 2 }, { attempt_number: 1 }] } });
    }
    if (path.includes('/dashboard/ats-fit')) return route.fulfill({ json: { candidates: [current], pagination: { total: 1 } } });
    if (/students\/[^/]+\/reports$/.test(path)) return route.fulfill({ json: { ...previewBundle, student: current, drives: [{ drive_id: 'preview-drive', attempt_number: 2, assignment_status: assignmentStatus, started_at: '2026-10-11', session_id: 'preview-session' }], reports: previewBundle.reports.map(report => ({ ...report, attempt_number: 2, recording: { status: 'unavailable' } })) } });
    const lookup: Record<string, unknown> = {
      '/v1/users/me': { name: 'Test manager' }, '/v3/college/access': { enabled: true, college_name: 'Test college' },
      '/v3/college/drives/preview-drive': drive,
      '/v3/college/academic-catalog': { programs: [{ code: 'B.Tech', display_name: 'B.Tech', departments: [{ code: 'CSE', display_name: 'Computer Science' }] }] },
    };
    return route.fulfill({ json: lookup[path] || (path.includes('/dashboard/') ? { candidates: [current, pending], interview_progress: { completed: 1 } } : {}) });
  });
  await page.goto(`/dashboard/placement-management?drive=preview-drive&section=results${options.report ? '&candidate=preview-student' : ''}`);
  await expect(page.getByRole('button', { name: options.report ? 'Manage Attempts' : 'Table', exact: true }).first()).toBeVisible();
  return { writes, queries };
}

test('original stacked cards preserve evidence, avatars align and the table stays compact at all widths', async ({ page }) => {
  await setup(page);
  const cards = page.locator('#result-candidate-cards>article');
  await expect(cards).toHaveCount(12);
  const first = cards.first();
  await expect(first.locator('.matching .compact-skill')).toHaveCount(2);
  await expect(first.locator('.missing .compact-skill')).toHaveCount(2);
  await expect(first.getByRole('button', { name: 'View details', exact: true })).toHaveCount(0);
  await expect(first.getByText('AI Proctor', { exact: true })).toBeVisible();
  await expect(first.getByText('Interview rounds', { exact: true })).toBeVisible();
  await expect(first.getByText('Student result', { exact: true })).toBeVisible();
  const avatar = first.locator('.candidate-avatar');
  await expect(avatar).toHaveText('AS');
  const alignment = await avatar.evaluate(element => {const css=getComputedStyle(element);return {align:css.alignItems,justify:css.justifyContent,line:css.lineHeight,height:element.getBoundingClientRect().height,width:element.getBoundingClientRect().width};});
  expect(alignment.align).toBe('center'); expect(alignment.justify).toBe('center'); expect(alignment.height).toBe(alignment.width);
  await expect(cards.nth(1).getByText('Resume Not Available', { exact: true })).toBeVisible();
  await first.getByRole('button', { name: 'ATS Fit & Resume Evidence', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'ATS fit details for Ananya Sharma' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Original resume', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Close ATS fit', exact: true }).click();
  for (const width of [1920, 1440, 1024, 768, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    const a = await first.boundingBox(), b = await cards.nth(1).boundingBox();
    expect(b!.y).toBeGreaterThanOrEqual(a!.y + a!.height + (width > 700 ? 15 : 11));
    expect(Math.abs(a!.x - b!.x)).toBeLessThan(1);
    if (width === 1440 || width === 390) {
      const avatarBox = await first.locator('.candidate-avatar').boundingBox(), identityBox = await first.locator('.candidate-profile-identity').boundingBox();
      expect(Math.abs((avatarBox!.y + avatarBox!.height / 2) - (identityBox!.y + identityBox!.height / 2))).toBeLessThan(1);
      await first.screenshot({ path: `/root/voicedots/artifacts/compact-candidates-20261014/candidate-card-${width}.png` });
    }
    await page.screenshot({ path: `/root/voicedots/artifacts/compact-candidates-20261014/cards-${width}.png`, fullPage: true });
    await page.getByRole('button', { name: 'Table', exact: true }).click();
    const table = page.locator('#result-candidate-table');
    await expect(table.getByRole('columnheader')).toHaveCount(7);
    await expect(table.getByRole('columnheader', { name: 'Integrity', exact: true })).toHaveCount(0);
    await expect(table.locator('tbody tr').first().locator('.matching .compact-skill')).toHaveCount(2);
    await expect(table.locator('tbody tr').first().locator('.missing .compact-skill')).toHaveCount(1);
    const row = await table.locator('tbody tr').first().boundingBox(); expect(row!.height).toBeLessThanOrEqual(76);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    await page.screenshot({ path: `/root/voicedots/artifacts/compact-candidates-20261014/table-${width}.png`, fullPage: true });
    await page.getByRole('button', { name: 'Cards', exact: true }).click();
  }
});

test('limit extension confirms, preserves closed status, refreshes counts and does not reopen', async ({ page }) => {
  const { writes } = await setup(page, { report: true });
  await page.getByRole('button', { name: 'Manage Attempts', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Manage Attempts', exact: true });
  await expect(dialog.getByText('2/5', { exact: true })).toBeVisible();
  await expect(dialog.getByText('3', { exact: true })).toBeVisible();
  await dialog.getByLabel('Allowed attempts', { exact: true }).fill('7');
  await dialog.getByRole('button', { name: 'Save changes', exact: true }).click();
  expect(writes).toHaveLength(0);
  await expect(dialog.getByRole('status')).toContainText('The interview will not be reopened');
  await dialog.getByRole('button', { name: 'Confirm changes', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(writes).toEqual([{ path: '/v3/college/drives/preview-drive/candidates/preview-student/attempt-limit', body: { max_attempts: 7 } }]);
  await page.getByRole('button', { name: 'Manage Attempts', exact: true }).click();
  await expect(dialog.getByText('2/7', { exact: true })).toBeVisible();
  await expect(dialog.getByText('5', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Manage Attempts', exact: true })).toBeFocused();
});

test('reopen is explicit, confirmed and uses the existing separate endpoint', async ({ page }) => {
  const { writes } = await setup(page);
  await page.locator('#result-candidate-cards>article').first().getByRole('button', { name: 'Manage Attempts', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Manage Attempts', exact: true });
  await dialog.getByLabel('Allowed attempts', { exact: true }).fill('7');
  await dialog.getByRole('checkbox', { name: /Reopen interview after saving/ }).check();
  await dialog.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(dialog.getByRole('status')).toContainText('Also reopen');
  await dialog.getByRole('button', { name: 'Confirm changes', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(writes).toEqual([{ path: '/v3/college/drives/preview-drive/candidates/preview-student/reopen', body: { max_attempts_override: 7 } }]);
});

test('validation, authorization errors, pending-report access, mobile modal and closed-drive rules', async ({ page }) => {
  const { writes } = await setup(page, { failSave: true, status: 'closed' });
  await page.locator('#result-candidate-cards>article').nth(1).getByRole('button', { name: 'Manage Attempts', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Manage Attempts', exact: true });
  await expect(dialog.getByLabel('Allowed attempts', { exact: true })).toHaveValue('5');
  await expect(dialog.getByRole('checkbox')).toHaveCount(0);
  for (const invalid of ['4', '21', '7.5', '']) {
    await dialog.getByLabel('Allowed attempts', { exact: true }).fill(invalid);
    await expect(dialog.getByRole('button', { name: 'Save changes', exact: true })).toBeDisabled();
    await expect(dialog.getByRole('alert')).toContainText('whole number');
  }
  expect(writes).toHaveLength(0);
  await dialog.getByLabel('Allowed attempts', { exact: true }).fill('7');
  await dialog.getByRole('button', { name: 'Save changes', exact: true }).click();
  await dialog.getByRole('button', { name: 'Confirm changes', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('permission');
  await expect(dialog).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await page.screenshot({ path: '/root/voicedots/artifacts/compact-candidates-20261014/attempts-mobile.png', fullPage: true });
});

test('failed policy fetch blocks updates', async ({ page }) => {
  const { writes } = await setup(page, { failLoad: true });
  await page.locator('#result-candidate-cards>article').first().getByRole('button', { name: 'Manage Attempts', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Manage Attempts', exact: true });
  await expect(dialog.getByRole('alert')).toContainText('access denied');
  await expect(dialog.getByRole('button', { name: 'Save changes', exact: true })).toHaveCount(0);
  expect(writes).toHaveLength(0);
});

test('search, ATS sorting, department filtering, pagination and layout switching preserve query behavior', async ({ page }) => {
  const { queries } = await setup(page);
  await page.getByRole('combobox', { name: 'Sort results', exact: true }).selectOption('ats_asc');
  await expect.poll(() => queries.at(-1)?.searchParams.get('sort_by')).toBe('ats_asc');
  await page.getByRole('combobox', { name: 'Sort results', exact: true }).selectOption('ats_desc');
  await expect.poll(() => queries.at(-1)?.searchParams.get('sort_by')).toBe('ats_desc');
  await page.getByRole('combobox', { name: 'Department', exact: true }).selectOption('CSE');
  await expect.poll(() => queries.at(-1)?.searchParams.get('department')).toBe('CSE');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect.poll(() => queries.at(-1)?.searchParams.get('offset')).toBe('25');
  await page.getByRole('textbox', { name: 'Search candidates', exact: true }).fill('Pending');
  await expect.poll(() => queries.at(-1)?.searchParams.get('q')).toBe('Pending');
  await expect.poll(() => queries.at(-1)?.searchParams.get('offset')).toBe('0');
  await expect(page.locator('#result-candidate-cards>article')).toHaveCount(1);
  await page.getByRole('button', { name: 'Table', exact: true }).click();
  await expect(page.locator('#result-candidate-table tbody tr')).toHaveCount(1);
});

test('officer decision remains editable and saves without publishing the result', async ({ page }) => {
  const { writes } = await setup(page);
  await page.locator('#result-candidate-cards>article').first().getByRole('button', { name: 'Shortlist', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Officer decision', exact: true })).toHaveValue('shortlist');
  await page.getByRole('textbox', { name: 'Officer note', exact: true }).fill('Review approved');
  await page.getByRole('button', { name: 'Save decision & note', exact: true }).click();
  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0]).toEqual({ path: '/v3/college/drives/preview-drive/candidates/preview-student/decision', body: { decision: 'shortlist', note: 'Review approved' } });
});
