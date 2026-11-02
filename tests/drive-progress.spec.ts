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

test('drive Progress shows canonical saved lessons and evidence, refreshes and stays read-only',async({page},testInfo)=>{
 const card=await progressRoster(page);
 let refreshed=false,requests=0,writes=0;
 const progress=()=>({student_id:'student-history',drive_id:'drive-one',plans:[{id:'plan-one',drive_id:'drive-one',company_name:'First Company',role_title:'Engineer',goal:'Saved student goal',summary:'Saved student summary',lessons:[{session_id:'lesson',day:1,title:'Recorded Python lesson',objective:'Explain the actual API',activities:['Implement a handler'],stage:refreshed?'completed':'practice',teaching_completed:true,validation_status:refreshed?'validated':'needs_review'}],skills_progress:{score:refreshed?70:35,skills:[{skill:'Recorded Python evidence',state:refreshed?'validated':'learning',training_stage:refreshed?'completed':'practice',evidence_note:'Evidence from the student portal',objectives:[{task_id:'task',question:'Saved diagnostic task',answer:'Saved student answer',status:'needs_improvement',feedback:{feedback:'Recorded assessor feedback'}}]}]}}],cycles:[]});
 await page.route('**/v3/college/students/student-history/coach?drive_id=drive-one',r=>{requests++;if(r.request().method()!=='GET')writes++;return r.fulfill({json:progress()})});
 const open=card.getByRole('button',{name:'Progress for First Company Engineer',exact:true});
 await expect(card.getByRole('button',{name:'AI Coach',exact:true})).toHaveCount(0);
 await open.click();const dialog=page.getByRole('dialog',{name:'Progress · History Student'});
 await expect(dialog).toContainText('First Company · Engineer');
 await expect(dialog).toContainText('Saved student goal');await expect(dialog).toContainText('Recorded Python lesson');
 await expect(dialog).toContainText('35% readiness from recorded evidence');await expect(dialog).toContainText('Needs Review');
 await dialog.getByText('Assessment details · 1 tasks',{exact:true}).click();
 await expect(dialog).toContainText('Saved student answer');await expect(dialog).toContainText('Recorded assessor feedback');
 await expect(dialog.getByRole('combobox')).toHaveCount(0);
 refreshed=true;await dialog.getByRole('button',{name:'Refresh progress',exact:true}).click();
 await expect(dialog).toContainText('70% readiness from recorded evidence');await expect(dialog).toContainText('1 / 1');
 await page.screenshot({path:testInfo.outputPath('progress-desktop.png'),fullPage:true});
 await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);await expect(open).toBeFocused();
 await open.click();await expect(page.getByRole('dialog')).toContainText('70% readiness from recorded evidence');
 await page.setViewportSize({width:390,height:844});
 await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await page.screenshot({path:testInfo.outputPath('progress-mobile.png'),fullPage:true});
 expect(requests).toBe(3);expect(writes).toBe(0);
});

test('Progress for an unassessed drive shows an honest empty state and can retry a failure',async({page})=>{
 const card=await progressRoster(page);let failed=true;
 await page.route('**/v3/college/students/student-history/coach?drive_id=drive-two',r=>failed?r.fulfill({status:503,json:{detail:'Progress temporarily unavailable'}}):r.fulfill({json:{student_id:'student-history',drive_id:'drive-two',plans:[],cycles:[]}}));
 await card.getByRole('button',{name:'Progress for Second Company Analyst',exact:true}).click();
 const dialog=page.getByRole('dialog');await expect(dialog.getByRole('alert')).toBeVisible();
 failed=false;await dialog.getByRole('button',{name:'Retry progress',exact:true}).click();
 await expect(dialog).toContainText('No progress recorded for this drive');await expect(dialog).not.toContainText('Saved student goal');
});

test('Progress refuses data belonging to another drive or student',async({page})=>{
 const card=await progressRoster(page);
 await page.route('**/v3/college/students/student-history/coach?drive_id=drive-one',r=>r.fulfill({json:{student_id:'other-student',drive_id:'drive-two',plans:[{id:'private',drive_id:'drive-two',summary:'Other student private progress',lessons:[]}],cycles:[]}}));
 await card.getByRole('button',{name:'Progress for First Company Engineer',exact:true}).click();
 const dialog=page.getByRole('dialog');await expect(dialog.getByRole('alert')).toContainText('does not match');
 await expect(dialog).not.toContainText('Other student private progress');
});


test('Progress includes the saved improvement journey without requiring an old coaching plan',async({page})=>{
 const card=await progressRoster(page);
 await page.route('**/v3/college/students/student-history/coach?drive_id=drive-one',r=>r.fulfill({json:{student_id:'student-history',drive_id:'drive-one',plans:[],cycles:[],journey:{drive_id:'drive-one',progress_tracking:{modules_completed:2,modules_total:5,plan_completed_percent:40,recorded_feedback:'Saved journey feedback'},daily_schedule:[{id:'task-1',title:'Review API validation',status:'Completed'}]}}}));
 await card.getByRole('button',{name:'Progress for First Company Engineer',exact:true}).click();
 const dialog=page.getByRole('dialog');await expect(dialog).toContainText('Progress tracking');await expect(dialog).toContainText('Saved journey feedback');await expect(dialog).toContainText('Review API validation');await expect(dialog).not.toContainText('No progress recorded');
});
