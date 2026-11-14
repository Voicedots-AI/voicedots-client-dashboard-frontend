import {test,expect,type Page} from '@playwright/test';
test.beforeEach(async({page})=>{page.on('pageerror',e=>console.log('PAGE ERROR',e.message));});
const today=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'});
function due(n:number){const d=new Date(today+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)}
const tasks=[['soon',2,'Pending'],['future',3,'Pending'],['overdue',-1,'In Progress'],['today',0,'Pending'],['done',-3,'Completed'],['undated',null,'Pending']].map(([id,n,status])=>({id,title:id+' task',due:n===null?'':due(Number(n)),status,outcome:'Saved outcome',assignee:'Test Student',assignedBy:'Test Mentor',studentId:'student-1'}));
const data={mentorName:'Test Mentor',studentName:'Test Student',menteeCount:1,activeDiscussions:0,pendingReplies:0,tasks,discussions:[],schedule:[],communications:[],versions:{'student-1':0},mentees:[],canAssign:false,canCollaborate:false};
async function setup(page:Page,mentor:boolean){
 await page.addInitScript(()=>localStorage.setItem('access_token','test'));
 await page.route(/^https?:\/\/[^/]+\/api\//,r=>r.fulfill({json:{}}));
 await page.route('**/v1/users/me',r=>r.fulfill({json:{name:'Test user',portal_role:mentor?'placement_staff':'client'}}));
 await page.route('**/v3/college/access',r=>r.fulfill({json:{enabled:true,mentor_management_enabled:true,is_mentor:mentor,erp_role:mentor?'faculty':'college_admin'}}));
 await page.route('**/v3/college/mentors/state',r=>r.fulfill({json:{mentors:[{id:'mentor-1',staffId:'staff-1',name:'Test Mentor',department:'CSE',active:true,capacity:10}],students:[{id:'student-1',name:'Test Student',mentorId:'mentor-1',milestones:[]}],faculty:[],logs:[],transfers:[],academicYears:[],access:{can_manage:!mentor,mentor_id:mentor?'mentor-1':null}}}));
 await page.route('**/v3/college/mentors/workspace**',r=>r.fulfill({json:data}));
}
async function attention(page:Page){
 const rows=page.locator('.mw-table tbody tr');
 await page.getByRole('tab',{name:/Needs Attention/}).click();
 await expect(rows).toHaveCount(3);
 for(const [i,title] of ['overdue task','today task','soon task'].entries())await expect(rows.nth(i)).toContainText(title);
 await expect(rows.nth(0)).toContainText('Overdue');await expect(rows.nth(1)).toContainText('Due today');
 await page.getByLabel('Search tasks').fill('unmatched');await expect(page.getByText('No tasks match your search.')).toBeVisible();
 await page.getByLabel('Search tasks').fill('');
 await page.getByRole('tab',{name:'Completed',exact:true}).click();await expect(rows).toHaveCount(1);await expect(rows).toContainText('done task');
 await page.getByRole('tab',{name:'My Tasks',exact:true}).click();await expect(rows).toHaveCount(6);
 await expect(page.getByRole('tab',{name:'All',exact:true})).toHaveCount(0);
}
test('mentor native navigation and attention boundaries',async({page})=>{
 await setup(page,true);await page.goto('/dashboard/placement-management?view=mentors&mentorSection=tasks');
 await expect(page.getByRole('heading',{name:'Tasks & Schedule',exact:true})).toBeVisible();
 await expect(page.locator('.mw-sidebar')).toHaveCount(0);await attention(page);
 await page.getByRole('navigation',{name:'Mentor navigation'}).getByText('Discussions',{exact:true}).click();
 await expect(page.getByRole('heading',{name:'Discussions',exact:true})).toBeVisible();
 await expect(page.getByText('Tasks needing attention',{exact:true})).toHaveCount(0);
 await page.setViewportSize({width:390,height:844});await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBeTruthy();
});
test('admin retains old navigation and Mentee 360',async({page})=>{
 await setup(page,false);await page.goto('/dashboard/placement-management?view=mentors');
 const nav=page.getByRole('navigation',{name:'Main navigation'});
 await expect(nav.getByText('Home',{exact:true})).toBeVisible();await expect(nav.getByText('Placement management',{exact:true})).toBeVisible();await expect(nav.getByText('Master Wizard',{exact:true})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Mentee 360°',exact:true})).toBeVisible();
});
test('student attention boundaries and old communications redirect',async({page})=>{
 await page.route('**/api/**',r=>{
 const path=new URL(r.request().url()).pathname;
 return r.fulfill({json:path==='/api/auth/student-me'?{student:{id:'student-1',full_name:'Test Student',email:'student@example.test',roll_number:'TEST1',college_name:'Test institute',current_resume_submission_id:'r1',photo_url:'/test-photo.png'},mentor_management_enabled:true}:path==='/api/student/mentor/workspace'?data:{}});
 });
 await page.goto('http://127.0.0.1:5197/mentor?section=tasks');await expect(page.getByRole('heading',{name:'Tasks & Schedule',exact:true})).toBeVisible();
 await expect(page.locator('.mw-sidebar')).toHaveCount(0);await expect(page.getByText('My Mentor Profile',{exact:true})).toHaveCount(0);await attention(page);
 await page.goto('http://127.0.0.1:5197/mentor?section=communications');await expect(page).toHaveURL(/section=discussions/);await expect(page.getByRole('heading',{name:'Discussions',exact:true})).toBeVisible();
 await page.setViewportSize({width:390,height:844});await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBeTruthy();
});
