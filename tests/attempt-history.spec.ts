import { readFileSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';
async function setup(page: Page, enabled = true, options: { notFound?: string[]; driveRows?: unknown[]; driveDetails?: unknown; companyProfiles?: unknown[]; academicCatalog?: unknown; initialPath?: string; portalRole?: string } = {}) {
  await page.addInitScript(() => localStorage.setItem('access_token', 'test-session'));
  await page.route(/\/v[13]\//, route => {
    const path = new URL(route.request().url()).pathname;
    const values: Record<string, unknown> = {
      '/v1/users/me': { user_id: 'client-1', name: 'College Manager', email: 'manager@example.edu', ...(options.portalRole ? { portal_role: options.portalRole } : {}) },
      '/v3/college/staff': { staff: [] },
      '/v3/email/capabilities': { email_enabled: false },
      '/v3/college/roster-options': {batches:['2023-2027'],graduation_years:[2027,2028],statuses:['active']},
      '/v3/college/analytics': {summary:{total_students:0,placed_students:0,students_attended:0,total_attempts:0,completed_attempts:0,repeat_students:0,not_attended:0,participation_rate:0,completion_rate:0,average_duration_minutes:null},by_drive:[],by_program:[],trend:[],scope:'Placement interviews only.'},
      '/v3/college/access': { enabled, college_name: 'Example Engineering College', timezone:'Asia/Kolkata' },
      '/v3/college/company-profiles': options.companyProfiles ?? [{id:'company-1',company_name:'Northstar Technologies',company_description:'Builds software',company_website:'https://northstar.example',company_linkedin:'https://linkedin.com/company/northstar'}],
      '/v3/college/drives/role-suggestions': ['Data Analyst','Data Scientist','LLM Engineer'],
      '/v3/college/drive-drafts': [],
      '/v3/college/drives/eligibility/preview': {total_students:0,eligible_count:0,not_eligible_count:0,missing_photo_count:0,candidates:[]},
      '/v3/college/agents': {agents:[],tracks:['hr','domain','industry','manager'].map((track,i)=>({track,default_profile:{track,name:['Priya','Arjun','Neha','Vikram'][i],role:['Talent Acquisition Specialist','Senior Domain Specialist','Practical Interviewer','Hiring Manager'][i],intro_message:'Hello {name}',personality_prompt:'Interview for {role}',tone:'professional',voice_id:'flux-priya-en'}}))},
      '/v3/college/drives': options.driveRows ?? [{ id: 'drive-1', company_name: 'Example Company', role_title: 'Software Engineer', status: 'draft', location: 'Chennai' }],
      '/v3/college/drives/drive-1': options.driveDetails ?? {},
      '/v3/college/students': { items: [], total: 0 },
      '/v3/college/attendance/setup': { classes: [], students: [], staff: [] },
      '/v3/college/academic-catalog': options.academicCatalog ?? { programs: [{ code: 'B.Tech', display_name: 'Bachelor of Technology', duration_years: 4, departments: [{ code: 'CSE', display_name: 'Computer Science' },{ code: 'IT', display_name: 'Information Technology' }] }], graduation_years:[2027,2028] },
    };
    return route.fulfill({ json: values[path] || {} });
  });
  if (options.notFound?.length) await page.route(/\/v[13]\//, route => {
    const path = new URL(route.request().url()).pathname;
    if (options.notFound?.includes(path)) return route.fulfill({ status: 404, json: { detail: 'Endpoint not found' } });
    return route.fallback();
  });
  await page.goto(options.initialPath || '/dashboard/college');
}

const attemptReports = [
  {source:'drive',drive_id:'drive-1',session_id:'saved-second',attempt_number:2,overall_score:78,completed_at:'2026-11-25T09:00:00Z',detail:{status:'released',strengths:['Second attempt feedback'],question_reviews:[]}},
  {source:'drive',drive_id:'other-drive',session_id:'unrelated',attempt_number:5,overall_score:99,detail:{status:'released'}},
  {source:'drive',drive_id:'drive-1',session_id:'saved-first',attempt_number:1,overall_score:0,completed_at:'2026-11-24T09:00:00Z',detail:{status:'released',strengths:['First attempt feedback'],question_reviews:[]}},
];
async function mockAttemptReports(page:Page, reports:unknown[]=attemptReports){
  await page.route('**/v3/college/drives/drive-1',route=>route.fulfill({json:{id:'drive-1',company_name:'Example Company',role_title:'Engineer',status:'active',agent_selection:[]}}));
  await page.route('**/v3/college/students/s1/reports',route=>route.fulfill({json:{student:{id:'s1',full_name:'Attempt Candidate'},reports}}));
  await page.route('**/v3/college/students/s1/reports/*/recording',route=>route.fulfill({json:{status:'unavailable'}}));
  await page.route('**/v3/college/students/s1/reports/*/transcript',route=>route.fulfill({json:{turns:[]}}));
  await page.route('**/v3/college/students/s1/reports/*/integrity-events',route=>route.fulfill({json:{events:[]}}));
}

test('existing scorecard arrows switch only this candidate drive attempts without adding a selector',async({page})=>{
  await setup(page);
  await mockAttemptReports(page,[...attemptReports,attemptReports[0],{drive_id:'drive-1',attempt_number:3}]);
  await page.goto('/dashboard/placement-management?drive=drive-1&section=results&candidate=s1');
  const pager=page.locator('.candidate-pager');
  await expect(pager).toContainText('Attempt 2 · 2 of 2');
  await expect(page.locator('#glance')).toContainText('saved-second');
  await expect(page.locator('#glance')).toContainText('78');
  await expect(pager.getByRole('button',{name:'Next attempt',exact:true})).toBeDisabled();
  await expect(page.getByRole('combobox',{name:'View saved attempt'})).toHaveCount(0);
  await pager.getByRole('button',{name:'Previous attempt',exact:true}).click();
  await expect(pager).toContainText('Attempt 1 · 1 of 2');
  await expect(page.locator('#glance')).toContainText('saved-first');
  await expect(page.locator('#glance')).not.toContainText('saved-second');
  await expect(page.getByText('First attempt feedback').first()).toBeVisible();
  await expect(page.getByText('Second attempt feedback')).toHaveCount(0);
  await expect(pager.getByRole('button',{name:'Previous attempt',exact:true})).toBeDisabled();
  await expect(page).toHaveURL(/candidate=s1/);
  await pager.getByRole('button',{name:'Next attempt',exact:true}).click();
  await expect(pager).toContainText('Attempt 2 · 2 of 2');
  await expect(page.locator('#glance')).toContainText('saved-second');
});

test('attempt navigation discards delayed recording and transcript from the previous attempt',async({page})=>{
  await setup(page);
  await mockAttemptReports(page);
  let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});let pending=0;
  await page.route('**/v3/college/students/s1/reports/saved-second/recording',async route=>{pending++;await gate;await route.fulfill({json:{status:'ready',playback_url:'https://media.example/wrong-attempt.webm'}}).catch(()=>{});});
  await page.route('**/v3/college/students/s1/reports/saved-second/transcript',async route=>{pending++;await gate;await route.fulfill({json:{turns:[{turn_id:'stale',transcript:'Stale attempt transcript'}]}}).catch(()=>{});});
  await page.goto('/dashboard/placement-management?drive=drive-1&section=results&candidate=s1');
  await expect.poll(()=>pending).toBe(2);
  await page.getByRole('button',{name:'Previous attempt',exact:true}).click();
  await expect(page.locator('#glance')).toContainText('saved-first');
  release();
  await expect(page.locator('.candidate-pager')).toContainText('Attempt 1 · 1 of 2');
  await expect(page.getByText('Stale attempt transcript')).toHaveCount(0);
  await expect(page.getByLabel('Interview recording',{exact:true})).toHaveCount(0);
});

test('a single saved attempt disables both existing scorecard arrows',async({page})=>{
  await setup(page);
  await mockAttemptReports(page,[attemptReports[0]]);
  await page.goto('/dashboard/placement-management?drive=drive-1&section=results&candidate=s1');
  await expect(page.locator('.candidate-pager')).toContainText('Attempt 2 · 1 of 1');
  await expect(page.getByRole('button',{name:'Previous attempt',exact:true})).toBeDisabled();
  await expect(page.getByRole('button',{name:'Next attempt',exact:true})).toBeDisabled();
});

test('attempt history denial provides retry without showing another candidate report',async({page})=>{
  await setup(page);
  await mockAttemptReports(page);
  let denied=true;
  await page.route('**/v3/college/students/s1/reports',route=>denied?route.fulfill({status:403,json:{detail:'Not authorized'}}):route.fallback());
  await page.goto('/dashboard/placement-management?drive=drive-1&section=results&candidate=s1');
  await expect(page.getByRole('alert')).toContainText('Not authorized');
  await expect(page.locator('#glance')).toHaveCount(0);
  denied=false;
  await page.getByRole('button',{name:'Retry attempt history'}).click();
  await expect(page.locator('.candidate-pager')).toContainText('Attempt 2 · 2 of 2');
});

test('Assessment Intelligence scorecard entry uses the existing attempt pager',async({page})=>{
  await setup(page);
  await mockAttemptReports(page);
  const student={id:'s1',full_name:'Attempt Candidate',roll_number:'R1',email:'candidate@example.test',program:'B.Tech',department_code:'CSE',graduation_year:2027,status:'active'};
  await page.route('**/v3/college/students?**',route=>route.fulfill({json:{items:[student],total:1}}));
  await page.route('**/v3/college/students/s1/reports?include_assessments=true',route=>route.fulfill({json:{student,drives:[{drive_id:'drive-1',company_name:'Example Company',role_title:'Engineer',assignment_status:'completed'}],reports:attemptReports.filter(report=>report.drive_id==='drive-1'),assessment_contract:'student-ats-v1',assessments:{'drive-1':{student_id:'s1',drive_id:'drive-1',ats_status:'evaluated',ats_fit_score:65}}}}));
  await page.goto('/dashboard/placement-management?view=assessment-intelligence&student=s1');
  await page.getByRole('button',{name:'View scorecards',exact:true}).click();
  await expect(page.locator('.candidate-pager')).toContainText('Attempt 2 · 2 of 2');
  await page.getByRole('button',{name:'Previous attempt',exact:true}).click();
  await expect(page.locator('#glance')).toContainText('saved-first');
  await expect(page.getByRole('combobox',{name:'View saved attempt'})).toHaveCount(0);
  await page.screenshot({path:'/tmp/attempt-results-desktop.png',fullPage:false});
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
  await page.screenshot({path:'/tmp/attempt-results-mobile.png',fullPage:false});
});


 test('every saved drive attempt has its own score link and opens the exact session',async({page})=>{
  await setup(page);await mockAttemptReports(page);
  const student={id:'s1',full_name:'Attempt Candidate',roll_number:'R1',program:'B.Tech',status:'active'};
  await page.route('**/v3/college/students?**',route=>route.fulfill({json:{items:[student],total:1}}));
  await page.route('**/v3/college/students/s1/reports?include_assessments=true',route=>route.fulfill({json:{student,drives:[{drive_id:'drive-1',company_name:'Example Company',assignment_status:'completed'}],reports:attemptReports.filter(r=>r.drive_id==='drive-1'),assessment_contract:'student-ats-v1',assessments:{'drive-1':{student_id:'s1',drive_id:'drive-1',ats_status:'evaluated',ats_fit_score:65}}}}));
  await page.goto('/dashboard/placement-management?view=assessment-intelligence&student=s1');
  const table=page.locator('.ai-drive-table');
  await expect(table).toContainText('Attempt 1 · 0/100');await expect(table).toContainText('Attempt 2 · 78/100');
  await expect(table).not.toContainText('99/100');
  await page.getByRole('button',{name:'Open attempt 1 scorecard for Attempt Candidate at Example Company',exact:true}).click();
  await expect(page.locator('.candidate-pager')).toContainText('Attempt 1 · 1 of 2');
  await expect(page.locator('#glance')).toContainText('saved-first');
 });
