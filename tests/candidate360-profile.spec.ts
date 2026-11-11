import {test,expect,type Page} from '@playwright/test';
const student={id:'student-a',full_name:'Profile Student',roll_number:'REG001',email:'student@example.test',phone:'9876543210',program:'BTECH',department_code:'CSE',department_display_name:'Computer Science',graduation_year:2027,batch_label:'2023–2027',cgpa:0,status:'active',has_readable_resume:true,skills:['SQL','Python']};
const bundle=()=>({student:{...student},reports:[],drives:[{assignment_id:'assignment-a',drive_id:'drive-a',company_name:'Example Technologies',role_title:'Data Analyst',assignment_status:'invited',drive_status:'active',drive_type:'official_placement',job_type:'full_time',location:'Chennai',package_min_lpa:0,package_max_lpa:6,package_currency:'INR',attempt_number:1,max_attempts:2,evaluation_status:'pending',officer_decision:'shortlist',window_start_at:'2026-11-10T04:00:00Z',window_end_at:'2026-11-20T12:00:00Z'}],profile_context:{college_name:'Example Institute',academic_year:'2026–2027',semester:7,section:'A',mentor:{name:'Assigned Faculty',email:'faculty@example.test',active:true}}});
async function setup(page:Page,data=bundle()){
 await page.addInitScript(()=>localStorage.setItem('access_token','test-session'));
 await page.route(/^http:\/\/127\.0\.0\.1:5194\/api\//,route=>route.fulfill({json:{}}));
 await page.route('**/v1/users/me',route=>route.fulfill({json:{name:'Admin',email:'admin@example.test'}}));
 await page.route('**/v3/college/access',route=>route.fulfill({json:{enabled:true,college_name:'Example Institute'}}));
 await page.route('**/v3/college/students?*',route=>route.fulfill({json:{items:[student],total:1}}));
 await page.route('**/v3/college/students/student-a/reports?profile=true',route=>route.fulfill({json:data}));
 await page.goto('/dashboard/placement-management?view=candidates&candidate=student-a');
}
test('shows academics, real zero CGPA, contact, mentor and placement details without inventing a placement',async({page})=>{
 await setup(page);
 await expect(page.getByRole('heading',{name:'Profile Student',exact:true})).toBeVisible();
 await expect(page.getByText('0.00 / 10',{exact:true})).toBeVisible();
 await expect(page.locator('.c360-summary-status')).toHaveText('Not recorded');
 await page.getByRole('navigation',{name:'Candidate profile sections'}).getByRole('button',{name:'Academics',exact:true}).click();
 await expect(page).toHaveURL(/candidateTab=academics/);
 await expect(page.getByText('2026–2027',{exact:true})).toBeVisible();
 await expect(page.getByRole('link',{name:'student@example.test',exact:true}).first()).toBeVisible();
 await expect(page.getByText('Assigned Faculty',{exact:true})).toBeVisible();
 await page.getByRole('navigation',{name:'Candidate profile sections'}).getByRole('button',{name:/^Placement/}).click();
 await expect(page.getByRole('cell',{name:/Example Technologies/})).toBeVisible();
 await expect(page.getByText('0 – 6 LPA · INR',{exact:true})).toBeVisible();
 await expect(page.getByText('Shortlist',{exact:true})).toBeVisible();
 await page.getByRole('navigation',{name:'Candidate profile sections'}).getByRole('button',{name:/^Assessments/}).click();
 await expect(page.getByRole('heading',{name:'No completed assessments yet',exact:true})).toBeVisible();
});
test('shows honest empty states for a student without placement or optional academic records',async({page})=>{
 const data=bundle();data.drives=[];data.profile_context={college_name:'Example Institute'} as typeof data.profile_context;
 data.student={...data.student,cgpa:null,has_readable_resume:false,skills:[]} as unknown as typeof data.student;
 await setup(page,data);
 await page.getByRole('navigation',{name:'Candidate profile sections'}).getByRole('button',{name:'Academics',exact:true}).click();
 await expect(page.getByText('No mentor assignment recorded.',{exact:true})).toBeVisible();
 await expect(page.getByText('Not uploaded',{exact:true})).toBeVisible();
 await expect(page.getByText('0.00 / 10',{exact:true})).toHaveCount(0);
 await page.getByRole('navigation',{name:'Candidate profile sections'}).getByRole('button',{name:/^Placement/}).click();
 await expect(page.getByText('No placement assignments recorded for this student.',{exact:true})).toBeVisible();
});
test('rejects a mismatched student response rather than displaying another candidate',async({page})=>{
 const data=bundle();data.student.id='another-student';data.student.full_name='Wrong Student';await setup(page,data);
 await expect(page.getByRole('alert')).toContainText('Unable to complete the request');
 await expect(page.getByRole('heading',{name:'Wrong Student',exact:true})).toHaveCount(0);
});
test('keeps the profile within a mobile viewport while placement history scrolls inside its table',async({page})=>{
 await page.setViewportSize({width:390,height:844});await setup(page);
 await expect(page.getByRole('heading',{name:'Profile Student',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBeTruthy();
 await page.screenshot({path:'/home/prajapati/voicedots-github/.local/candidate360-release/mobile-profile.png',fullPage:true});
});

test('candidate cards show the same ATS and interview summary as Assessment Intelligence',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('access_token','test-session'));
 await page.route(/^http:\/\/127\.0\.0\.1:5194\/api\//,route=>route.fulfill({json:{}}));
 await page.route('**/v1/users/me',route=>route.fulfill({json:{name:'Admin',email:'admin@example.test'}}));
 await page.route('**/v3/college/access',route=>route.fulfill({json:{enabled:true}}));
 await page.route('**/v3/college/students?*',route=>route.fulfill({json:{items:[{...student,cgpa:8.86}],total:1}}));
 await page.route('**/v3/college/students/student-a/reports?include_assessments=true',route=>route.fulfill({json:{student:{...student,cgpa:8.86},assessment_contract:'student-ats-v1',drives:[{drive_id:'a',assignment_status:'completed',criteria_ats_fit:60},{drive_id:'b',assignment_status:'in_progress',criteria_ats_fit:60}],reports:[{drive_id:'a',session_id:'session-a',overall_score:80,readiness:'Ready',completed_at:'2026-11-10'}],assessments:{a:{student_id:'student-a',ats_status:'evaluated',ats_fit_score:59,criteria_ats_fit:60},b:{student_id:'student-a',ats_status:'evaluated',ats_fit_score:61,criteria_ats_fit:60}}}}));
 await page.goto('/dashboard/placement-management?view=candidates');
 const card=page.getByRole('article',{name:'Candidate Profile Student',exact:true});
 await expect(card.getByText('80/100',{exact:true})).toBeVisible();
 await expect(card.locator('.c360-card-metrics')).toContainText('ATS above cutoff 1');
 await expect(card.locator('.c360-card-metrics')).toContainText('Participated 2');
 await expect(card.locator('.c360-card-metrics')).toContainText('Avg. ATS 60%');
 await expect(card.getByText('8.86',{exact:false})).toBeVisible();
 await expect(card.getByRole('button',{name:'View details',exact:true})).toBeVisible();
 await page.screenshot({path:'/home/prajapati/voicedots-github/.local/candidate360-release/summary-card-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBeTruthy();
 await page.screenshot({path:'/home/prajapati/voicedots-github/.local/candidate360-release/summary-card-mobile.png',fullPage:true});
});
