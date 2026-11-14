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
 await expect(card.getByRole('button',{name:'AI Coach Progress for First Company Engineer',exact:true})).toBeVisible();
 return card;
}

test('drive Progress opens the shared nine-screen student journey and refreshes read-only',async({page})=>{
 const card=await progressRoster(page);let completed=false,writes=0,requests=0;
 const payload=()=>({student_id:'student-history',drive_id:'drive-one',journey:{id:'journey-one',drive_id:'drive-one',student_name:'History Student',company_name:'First Company',role_title:'Engineer',interview_result:{overall_score:72,competencies:[]},improvement_plan:{focus_areas:['Saved student focus']},daily_schedule:[{id:'task',activity:'Saved learning activity',date_label:'Monday',status:completed?'Completed':'Pending'}],learning_resources:{syllabus_topics:['Saved resource'],question_bank:[]}}});
 await page.route('**/v3/college/students/student-history/journey?drive_id=drive-one',r=>{requests++;if(r.request().method()!=='GET')writes++;return r.fulfill({json:payload()})});
 const open=card.getByRole('button',{name:'AI Coach Progress for First Company Engineer',exact:true});
 await open.click();const dialog=page.getByRole('dialog',{name:'AI Coach Progress · History Student'});
 await expect(dialog).toContainText('First Company · Engineer');await expect(dialog).toContainText('72/100');
 const screens=dialog.getByRole('navigation',{name:'Journey screens'});await expect(screens.getByRole('button')).toHaveCount(9);
 await screens.getByRole('button',{name:'5 Daily Learning Schedule',exact:true}).click();await expect(dialog).toContainText('Saved learning activity');await expect(dialog).toContainText('Pending');
 await screens.getByRole('button',{name:'4 Personalized Improvement Plan',exact:true}).click();await expect(dialog).toContainText('Saved student focus');
 await expect(dialog.getByRole('textbox')).toHaveCount(0);await expect(dialog.getByRole('button',{name:'Start coaching',exact:true})).toHaveCount(0);
 completed=true;await dialog.getByRole('button',{name:'Refresh AI Coach Progress',exact:true}).click();await screens.getByRole('button',{name:'5 Daily Learning Schedule',exact:true}).click();await expect(dialog).toContainText('Completed');
 await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);await expect(open).toBeFocused();
 await open.click();await expect(dialog).toContainText('72/100');expect(requests).toBe(3);expect(writes).toBe(0);
});

test('Progress has a retryable failure and honest empty state for a different drive',async({page})=>{
 const card=await progressRoster(page);let failed=true;
 await page.route('**/v3/college/students/student-history/journey?drive_id=drive-two',r=>failed?r.fulfill({status:503,json:{detail:'Progress temporarily unavailable'}}):r.fulfill({json:{student_id:'student-history',drive_id:'drive-two',journey:null}}));
 await card.getByRole('button',{name:'AI Coach Progress for Second Company Analyst',exact:true}).click();const dialog=page.getByRole('dialog');await expect(dialog.getByRole('alert')).toBeVisible();
 failed=false;await dialog.getByRole('button',{name:'Retry AI Coach Progress',exact:true}).click();await expect(dialog).toContainText('No saved improvement journey');await expect(dialog).not.toContainText('Saved student focus');
});

test('Progress refuses another student or drive before displaying private data',async({page})=>{
 const card=await progressRoster(page);
 await page.route('**/v3/college/students/student-history/journey?drive_id=drive-one',r=>r.fulfill({json:{student_id:'other-student',drive_id:'drive-two',journey:{id:'private',drive_id:'drive-two',student_name:'Other student private progress'}}}));
 await card.getByRole('button',{name:'AI Coach Progress for First Company Engineer',exact:true}).click();const dialog=page.getByRole('dialog');await expect(dialog.getByRole('alert')).toContainText('does not match');await expect(dialog).not.toContainText('Other student private progress');
});
