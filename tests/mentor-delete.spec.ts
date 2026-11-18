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
