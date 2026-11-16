import {test,expect,type Page} from '@playwright/test';
const student={id:'student-a',full_name:'Profile Student',roll_number:'REG001',email:'student@example.test',phone:'9876543210',program:'BTECH',department_code:'CSE',graduation_year:2027,cgpa:0,status:'active'};
const bundle=()=>({student:{...student},assessment_contract:'student-ats-v1',reports:[],drives:[{drive_id:'drive-a',company_name:'Example Technologies',role_title:'Data Analyst',assignment_status:'invited',drive_status:'active',window_start_at:'2026-11-10T04:00:00Z',window_end_at:'2026-11-20T12:00:00Z'}],assessments:{'drive-a':{student_id:'student-a',drive_id:'drive-a',ats_status:'evaluated',ats_fit_score:75,criteria_ats_fit:60}}});
async function setup(page:Page,data=bundle(),path='/dashboard/placement-management?view=candidates&candidate=student-a'){
 await page.addInitScript(()=>localStorage.setItem('access_token','test-session'));
 await page.route(/^http:\/\/127\.0\.0\.1:5194\/api\//,route=>route.fulfill({json:{}}));
 await page.route('**/v1/users/me',route=>route.fulfill({json:{name:'Admin',email:'admin@example.test'}}));
 await page.route('**/v3/college/access',route=>route.fulfill({json:{enabled:true,college_name:'Example Institute'}}));
 await page.route('**/v3/college/students?*',route=>route.fulfill({json:{items:[student],total:1}}));
 await page.route('**/v3/college/students/student-a/reports?include_assessments=true',route=>route.fulfill({json:data}));
 await page.goto(path);
}
test('candidate details use the mentee placement workspace and resume biodata',async({page})=>{
 await setup(page);
 const workspace=page.getByRole('region',{name:'Placement assessment intelligence'});
 await expect(workspace.getByRole('button',{name:'Profile Student',exact:true})).toBeVisible();
 await expect(workspace.getByText('CGPA 0',{exact:true})).toBeVisible();
 await expect(workspace.getByRole('button',{name:'AI Coach Progress for Example Technologies Data Analyst',exact:true})).toBeVisible();
 await expect(workspace.getByRole('button',{name:'View ATS Fit 75%',exact:true})).toBeVisible();
 await expect(page.getByRole('navigation',{name:'Candidate profile sections'})).toHaveCount(0);
 await workspace.locator('.ai-student-actions').getByRole('button',{name:'Resume & biodata',exact:true}).click();
 await expect(page.getByRole('dialog')).toContainText('Candidate biodata');
 await expect(page.getByRole('dialog')).toContainText('student@example.test');
 await page.getByRole('button',{name:'Close candidate details'}).click();
 await page.getByRole('button',{name:'All candidates',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Candidate 360°',exact:true})).toBeVisible();
});
test('shows an honest empty state for a candidate without drives',async({page})=>{
 const data=bundle();data.drives=[];data.assessments={} as typeof data.assessments;await setup(page,data);
 await expect(page.getByText('No placement assignments or drive reports have been recorded for this student.',{exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'View scorecards',exact:true})).toBeDisabled();
});
test('rejects a mismatched student response',async({page})=>{
 const data=bundle();data.student.id='another-student';data.student.full_name='Wrong Student';await setup(page,data);
 await expect(page.getByRole('alert')).toContainText('Placement assessments unavailable');
 await expect(page.getByRole('button',{name:'Wrong Student',exact:true})).toHaveCount(0);
});
test('shared candidate details fit a mobile viewport',async({page})=>{
 await page.setViewportSize({width:390,height:844});await setup(page);
 await expect(page.getByRole('button',{name:'Profile Student',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBeTruthy();
});
test('candidate directory opens the same placement details from View details',async({page})=>{
 await setup(page,bundle(),'/dashboard/placement-management?view=candidates');
 await page.getByRole('button',{name:'View details',exact:true}).click();
 await expect(page).toHaveURL(/candidate=student-a/);
 await expect(page.getByRole('region',{name:'Placement assessment intelligence'})).toBeVisible();
 await expect(page.getByRole('button',{name:'All candidates',exact:true})).toBeVisible();
});

test('candidate cards match mentee academic tags and cumulative competency profile',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('access_token','test-session'));
 await page.route(/^http:\/\/127\.0\.0\.1:5194\/api\//,route=>route.fulfill({json:{}}));
 await page.route('**/v1/users/me',route=>route.fulfill({json:{name:'Admin',email:'admin@example.test'}}));
 await page.route('**/v3/college/access',route=>route.fulfill({json:{enabled:true}}));
 await page.route('**/v3/college/students?*',route=>route.fulfill({json:{items:[{...student,cgpa:8.86}],total:1}}));
 await page.route('**/v3/college/students/student-a/reports?include_assessments=true',route=>route.fulfill({json:{student:{...student,cgpa:8.86},assessment_contract:'student-ats-v1',drives:[{drive_id:'a',assignment_status:'completed',criteria_ats_fit:60},{drive_id:'b',assignment_status:'in_progress',criteria_ats_fit:60}],reports:[{drive_id:'a',session_id:'session-a',overall_score:80,readiness:'Ready',completed_at:'2026-11-10',detail:{core_dimensions:[{dimension:'communication',label:'Communication',percentage:0},{dimension:'domain_knowledge',label:'Domain Knowledge',percentage:75}]}}],assessments:{a:{student_id:'student-a',ats_status:'evaluated',ats_fit_score:59,criteria_ats_fit:60},b:{student_id:'student-a',ats_status:'evaluated',ats_fit_score:61,criteria_ats_fit:60}}}}));
 await page.goto('/dashboard/placement-management?view=candidates');
 const card=page.getByRole('article',{name:'Candidate Profile Student',exact:true});
 await expect(card.getByRole('heading',{name:'Competency Profile',exact:true})).toBeVisible();
 await expect(card.getByRole('progressbar',{name:'Communication cumulative score',exact:true})).toHaveAttribute('value','0');
 await expect(card.getByRole('progressbar',{name:'Domain Knowledge cumulative score',exact:true})).toHaveAttribute('value','75');
 await expect(card.locator('.c360-card-tags')).toContainText('CourseBTECH');
 await expect(card.locator('.c360-card-tags')).toContainText('DepartmentCSE');
 await expect(card.locator('.c360-card-metrics')).toHaveCount(0);
 await expect(card.getByText('8.86',{exact:false})).toBeVisible();
 await expect(card.getByRole('button',{name:'View details',exact:true})).toBeVisible();
 await page.screenshot({path:'/home/prajapati/voicedots-github/.local/candidate360-release/summary-card-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBeTruthy();
 await page.screenshot({path:'/home/prajapati/voicedots-github/.local/candidate360-release/summary-card-mobile.png',fullPage:true});
});
