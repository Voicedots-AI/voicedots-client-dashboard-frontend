import { test, expect, type Page } from '@playwright/test';
async function setup(page: Page, enabled = true, options: { notFound?: string[]; driveRows?: unknown[]; driveDetails?: unknown; companyProfiles?: unknown[]; academicCatalog?: unknown; initialPath?: string; portalRole?: string } = {}) {
  await page.addInitScript(() => localStorage.setItem('access_token', 'test-session'));
  await page.route(/\/v[13]\//, route => {
    const path = new URL(route.request().url()).pathname.replace(/^\/api/, "");
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
    const path = new URL(route.request().url()).pathname.replace(/^\/api/, "");
    if (options.notFound?.includes(path)) return route.fulfill({ status: 404, json: { detail: 'Endpoint not found' } });
    return route.fallback();
  });
  await page.goto(options.initialPath || '/dashboard/college');
}


const roster=[{id:'student-history',full_name:'History Student',roll_number:'H-01',email:'history@example.edu',program:'B.Tech',department_code:'CSE',graduation_year:2027,status:'active'},{id:'student-empty',full_name:'New Student',roll_number:'N-01',email:'new@example.edu',program:'B.Tech',department_code:'CSE',graduation_year:2027,status:'active'}];
const bundle={student:roster[0],drives:[{drive_id:'drive-one',company_name:'First Company',role_title:'Engineer',assignment_status:'completed',assigned_at:'2026-09-10T10:00:00Z'},{drive_id:'drive-two',company_name:'Second Company',role_title:'Analyst',assignment_status:'invited',assigned_at:'2026-10-10T10:00:00Z'}],reports:[{drive_id:'drive-one',company_name:'First Company',role_title:'Engineer',overall_score:72,readiness:'developing',completed_at:'2026-10-20T10:00:00Z'},{drive_id:'drive-one',overall_score:40,readiness:'not_ready',completed_at:'2026-09-20T10:00:00Z'},{overall_score:99,readiness:'ready',completed_at:'2026-10-21T10:00:00Z'}]};

async function progressRoster(page:Page){
 await setup(page,true,{initialPath:'/dashboard/placement-management?view=assessment-intelligence'});
 await page.route('**/v3/college/students?**',r=>r.fulfill({json:{items:[roster[0]],total:1}}));
 await page.route('**/v3/college/students/student-history/reports?include_assessments=true',r=>r.fulfill({json:bundle}));
 await page.route('**/v3/college/students/student-history/drives/*/ats-fit',r=>r.fulfill({json:{assessment:{ats_status:'evaluated',ats_fit_score:60,skills:[]}}}));
 await page.reload();
 const card=page.locator('.ai-student-card').filter({has:page.getByRole('button',{name:'History Student',exact:true})});
 await expect(card).toBeVisible();
 if(await card.getByRole('button',{name:'History Student',exact:true}).getAttribute('aria-expanded')!=='true')await card.getByRole('button',{name:'Expand',exact:true}).click();
 await expect(card.getByRole('button',{name:'Progress for First Company Engineer',exact:true})).toBeVisible();
 return card;
}


const recorded=(drive_id:string,overall:number,attempt_number=1)=>({drive_id,status:'released',attempt_number,completed_at:`2026-11-0${attempt_number}T04:00:00Z`,report:{overall_score:overall,score_breakdown:{technical:overall-2,communication:overall+2}}});
test('client Progress uses the student chart and metrics, refreshes and stays drive scoped',async({page},testInfo)=>{
 const card=await progressRoster(page);let refreshed=false,requests=0;
 await page.route('**/v3/college/students/student-history/coach?drive_id=drive-one',r=>{requests++;expect(r.request().method()).toBe('GET');return r.fulfill({json:{student_id:'student-history',drive_id:'drive-one',plans:[],cycles:[],progress_reports:[recorded('drive-one',42),recorded('drive-two',99),...(refreshed?[recorded('drive-one',68,2)]:[])],journey:{drive_id:'drive-one',progress_tracking:{modules_completed:3,questions_completed:4,questions_total:10,mock_interviews_completed:1,mock_interviews_total:3}}}})});
 const open=card.getByRole('button',{name:'Progress for First Company Engineer',exact:true});await open.click();const dialog=page.getByRole('dialog');
 await expect(dialog.getByRole('heading',{name:'My Improvement Journey'})).toBeVisible();
 for(const label of ['Learning Modules Completed','Practice Questions Completed','Mock Interviews Completed'])await expect(dialog).toContainText(label);
 await expect(dialog.locator('.s8-metric-value').nth(0)).toHaveText('3');await expect(dialog.locator('.s8-metric-value').nth(1)).toHaveText('4 / 10');
 await expect(dialog).toContainText('1 recorded attempt');await expect(dialog).not.toContainText('99');
 await expect(dialog.locator('.improvement-chart-scroll svg path')).toHaveCount(0);
 refreshed=true;await dialog.getByRole('button',{name:'Refresh progress',exact:true}).click();await expect(dialog).toContainText('2 recorded attempts');
 await expect(dialog.getByRole('button',{name:/Overall score/})).toContainText('68');
 await dialog.getByRole('button',{name:'View detailed report'}).click();await expect(dialog.getByRole('region',{name:'Recorded interview scores'})).toContainText('Attempt 2');
 await page.screenshot({path:testInfo.outputPath('progress-desktop.png'),fullPage:true});
 await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);await expect(open).toBeFocused();await open.click();await expect(page.getByRole('dialog')).toContainText('2 recorded attempts');
 await page.setViewportSize({width:390,height:844});await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:testInfo.outputPath('progress-mobile.png'),fullPage:true});expect(requests).toBe(3);
});

test('client Progress shows the same empty chart and retries failed reads',async({page})=>{
 const card=await progressRoster(page);let failed=true;
 await page.route('**/v3/college/students/student-history/coach?drive_id=drive-two',r=>failed?r.fulfill({status:503,json:{detail:'Progress temporarily unavailable'}}):r.fulfill({json:{student_id:'student-history',drive_id:'drive-two',plans:[],cycles:[],progress_reports:[],journey:null}}));
 await card.getByRole('button',{name:'Progress for Second Company Analyst'}).click();const dialog=page.getByRole('dialog');await expect(dialog.getByRole('alert')).toBeVisible();failed=false;await dialog.getByRole('button',{name:'Retry progress'}).click();await expect(dialog).toContainText('Your first released interview score will appear here');
});

test('client Progress refuses another student or drive response',async({page})=>{
 const card=await progressRoster(page);await page.route('**/v3/college/students/student-history/coach?drive_id=drive-one',r=>r.fulfill({json:{student_id:'other',drive_id:'drive-two',plans:[],cycles:[],progress_reports:[recorded('drive-two',99)]}}));await card.getByRole('button',{name:'Progress for First Company Engineer'}).click();const dialog=page.getByRole('dialog');await expect(dialog.getByRole('alert')).toContainText('does not match');await expect(dialog).not.toContainText('99');
});

test('saved journey points use the same student fallback without generated attempts',async({page})=>{
 const card=await progressRoster(page);await page.route('**/v3/college/students/student-history/coach?drive_id=drive-one',r=>r.fulfill({json:{student_id:'student-history',drive_id:'drive-one',plans:[],cycles:[],progress_reports:[],journey:{drive_id:'drive-one',progress_tracking:{modules_completed:2,trajectory_points:[{milestone:'Attempt 1',date:'2026-11-01',overall:45,technical:43,communication:47}]}}}}));await card.getByRole('button',{name:'Progress for First Company Engineer'}).click();const dialog=page.getByRole('dialog');await expect(dialog).toContainText('1 recorded attempt');await expect(dialog.getByRole('button',{name:/Overall score/})).toContainText('45');await expect(dialog.locator('.s8-metric-value').first()).toHaveText('2');
});


test('client Progress shows the student completion gate for an unfinished drive',async({page})=>{
 const card=await progressRoster(page);await page.route('**/v3/college/students/student-history/coach?drive_id=drive-two',r=>r.fulfill({json:{student_id:'student-history',drive_id:'drive-two',journey_unlocked:false,plans:[],cycles:[],progress_reports:[],journey:null}}));await card.getByRole('button',{name:'Progress for Second Company Analyst'}).click();const dialog=page.getByRole('dialog');await expect(dialog).toContainText('Your improvement journey starts with an interview');await expect(dialog.getByRole('heading',{name:'My Improvement Journey'})).toHaveCount(0);
});
