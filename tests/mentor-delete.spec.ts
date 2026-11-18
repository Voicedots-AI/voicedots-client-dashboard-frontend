import {test,expect} from '@playwright/test';
for (const rejected of [false,true]) {
 test(`mentor delete confirmation and ${rejected?'concurrent assignment rejection':'successful refresh'}`,async({page})=>{
  await page.addInitScript(()=>{localStorage.setItem('access_token','test');localStorage.setItem('user',JSON.stringify({email:'officer@example.test',full_name:'Placement Officer',role:'client'}))});
  await page.route(/^https?:\/\/[^/]+\/api\//,r=>r.fulfill({json:{}}));
  await page.route('**/v1/users/me',r=>r.fulfill({json:{name:'Placement Officer',portal_role:'placement_staff'}}));
  await page.route('**/v3/college/access',r=>r.fulfill({json:{enabled:true,mentor_management_enabled:true,is_mentor:false,erp_role:'placement_staff'}}));
  let deleted=false,writes=0;
  const free={id:'free-mentor',staffId:'staff-1',name:'Free Mentor',active:true,capacity:10,assignedCount:0};
  const busy={id:'busy-mentor',staffId:'staff-2',name:'Busy Mentor',active:true,capacity:10,assignedCount:2};
  await page.route('**/v3/college/mentors/state',r=>r.fulfill({json:{mentors:deleted?[busy]:[free,busy],students:[],faculty:[],logs:[],transfers:[],academicYears:[],access:{can_manage:true,mentor_id:null}}}));
  await page.route('**/v3/college/mentors/profiles/free-mentor',async r=>{
   expect(r.request().method()).toBe('DELETE');writes++;
   if(rejected){free.assignedCount=1;return r.fulfill({status:409,json:{detail:'Reassign all mentees before deleting this mentor.'}})}
   deleted=true;return r.fulfill({json:{status:'deleted'}});
  });
  await page.goto('/dashboard/placement-management?view=mentors');
  await expect(page.getByRole('button',{name:'Delete Busy Mentor',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'Delete Free Mentor',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Delete mentor',exact:true});
  await expect(dialog).toContainText('Free Mentor');
  await dialog.getByRole('button',{name:'Cancel',exact:true}).click();expect(writes).toBe(0);
  await page.getByRole('button',{name:'Delete Free Mentor',exact:true}).click();
  await dialog.getByRole('button',{name:'Delete mentor',exact:true}).click();
  await expect(dialog).toHaveCount(0);expect(writes).toBe(1);
  if(rejected){await expect(page.getByRole('alert')).toContainText('Reassign all mentees before deleting this mentor.');await expect(page.getByRole('button',{name:'Delete Free Mentor',exact:true})).toBeDisabled()}
  else {await expect(page.getByText('Mentor deleted.',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Delete Free Mentor',exact:true})).toHaveCount(0)}
 });
}

test('newly added staff appears by name in Add Mentor without reloading the page',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('access_token','test'));
 await page.route(/^https?:\/\/[^/]+\/api\//,r=>r.fulfill({json:{}}));
 await page.route('**/v1/users/me',r=>r.fulfill({json:{name:'Placement Officer',portal_role:'client'}}));
 await page.route('**/v3/college/access',r=>r.fulfill({json:{enabled:true,mentor_management_enabled:true,is_mentor:false,erp_role:'college_admin'}}));
 let reads=0;
 await page.route('**/v3/college/mentors/state',r=>r.fulfill({json:{mentors:[],students:[],faculty:++reads>1?[{id:'ram-staff',name:'Ram',email:'ram@example.com',employee_code:'',mentor_id:null}]:[],logs:[],transfers:[],academicYears:[],access:{can_manage:true,mentor_id:null}}}));
 await page.route('**/v3/college/academic-catalog',r=>r.fulfill({json:{programs:[]}}));
 await page.goto('/dashboard/placement-management?view=mentors');
 await page.getByRole('button',{name:'Add Mentor',exact:true}).click();
 const picker=page.getByLabel('Existing faculty');
 await expect(picker.locator('option',{hasText:'Ram · ram@example.com'})).toHaveCount(1);
 await picker.selectOption('ram-staff');
 await expect(page.getByLabel('Mentor Name *',{exact:true})).toHaveValue('Ram');
});

test('assignment filters and search apply immediately and preserve selected students',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('access_token','test'));
 await page.route(/^https?:\/\/[^/]+\/api\//,r=>r.fulfill({json:{}}));
 await page.route('**/v1/users/me',r=>r.fulfill({json:{name:'Officer',portal_role:'client'}}));
 await page.route('**/v3/college/access',r=>r.fulfill({json:{enabled:true,mentor_management_enabled:true,is_mentor:false,erp_role:'college_admin'}}));
 const students=[
 {id:'alice',name:'Alice',rollNumber:'REG-A',email:'alice@example.com',batch:'2023-2027',degree:'B.Tech',department:'CSE',semester:'5',mentorId:''},
 {id:'bob',name:'Bob',rollNumber:'REG-B',email:'bob@example.com',batch:'2024-2028',degree:'BBA',department:'BBA',semester:'3',mentorId:''},
 {id:'carol',name:'Carol',rollNumber:'REG-C',email:'carol@example.com',batch:'2023-2027',degree:'B.Tech',department:'IT',semester:'5',mentorId:''}];
 await page.route('**/v3/college/mentors/state',r=>r.fulfill({json:{mentors:[{id:'mentor',staffId:'staff',name:'Test Mentor',active:true,capacity:60,assignedCount:0}],students,faculty:[],logs:[],transfers:[],academicYears:[],access:{can_manage:true,mentor_id:null}}}));
 await page.goto('/dashboard/placement-management?view=mentors');
 await page.getByRole('button',{name:'Assign Mentee',exact:true}).click();
 await page.getByRole('button',{name:'Choose Students',exact:true}).last().click();
 const rows=page.locator('.mm-assignment-roster tbody tr');
 await expect(rows).toHaveCount(3);
 await page.getByRole('checkbox',{name:'Select Alice',exact:true}).check();
 for(const [field,value,count] of [['batch','2024-2028',1],['degree','BBA',1],['department','CSE',1],['semester','5',2]] as const){
  await page.getByLabel('Filter students by '+field,{exact:true}).selectOption(value);
  await expect(rows).toHaveCount(count);
  await page.getByRole('button',{name:'Clear filters',exact:true}).click();
  await expect(rows).toHaveCount(3);
 }
 await page.getByLabel('Filter students by degree',{exact:true}).selectOption('B.Tech');
 await page.getByLabel('Search students',{exact:true}).fill('REG-C');
 await expect(rows).toHaveCount(1);await expect(rows).toContainText('Carol');
 await page.getByLabel('Search students',{exact:true}).fill('unmatched');
 await expect(page.getByText('No students match these filters. Try another selection or clear the filters.',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Clear filters',exact:true}).click();
 await expect(rows).toHaveCount(3);await expect(page.getByRole('checkbox',{name:'Select Alice',exact:true})).toBeChecked();
 await expect(page.getByRole('button',{name:'Search Students',exact:true})).toHaveCount(0);
});
