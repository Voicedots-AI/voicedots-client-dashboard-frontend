import {expect,type Page} from '@playwright/test';
import {setupStudio,model,openDraft,fixtures} from './paper-studio';
import type {PaperTemplate} from '../../src/pages/dashboard/QpgTemplatesPanel';

type Options={empty?:boolean;readonly?:boolean;previewFails?:number;activationFails?:boolean};
export async function setupTemplates(page:Page,options:Options={}){
 const initial=fixtures();initial.readOnly=!!options.readonly;const studio=await setupStudio(page,initial);const state=studio.state;
 const layout=structuredClone(state.templates[0]) as PaperTemplate;
 const combined={...structuredClone(layout),id:'combined-template',name:'Combined College Exam',configuration:{...layout.configuration,paper_pattern:{title:'20 marks',total_marks:20,duration_minutes:90,coverage:{cos:[],units:[],topics:[],bloom:[],difficulty:[]},sections:[{id:'part',name:'Part A',order:1,offered:10,attempted:10,marks_each:2,question_type:'SHORT_ANSWER',format:'STANDARD',mandatory:true,choice_groups:[],main_questions:[],time_minutes:null}]}}} as PaperTemplate;
 const inactive={...structuredClone(layout),id:'inactive-template',name:'Inactive exam',status:'INACTIVE'} as PaperTemplate;
 const rows:PaperTemplate[]=options.empty?[]:[layout,combined,inactive];const calls:{path:string;body:any}[]=[];let previewFails=options.previewFails||0;
 await page.route('**/question-papers/templates',async route=>{
  if(route.request().method()==='POST'){const body=route.request().postDataJSON();calls.push({path:'save',body});const row={...body,id:`saved-${rows.length}`,version:1,revision:1,status:'DRAFT',used:false,has_logo:false};rows.push(row);return route.fulfill({status:201,json:row});}
  return route.fulfill({json:{items:rows,can_write:!options.readonly,branding:{name:'Test College'}}});
 });
 await page.route('**/question-papers/templates/**',async route=>{
  const path=new URL(route.request().url()).pathname;const body=route.request().method()==='POST'&&route.request().headers()['content-type']?.includes('application/json')?route.request().postDataJSON():null;calls.push({path,body});
  if(path.endsWith('/inspect'))return route.fulfill({json:{name:'Uploaded reference',institution_name:'Uploaded College',total_marks:null,duration_minutes:null,sections:[],warnings:['Check the source document.'],text:'Sample reference paper',text_truncated:false}});
  if(path.endsWith('/format-preview')){
   if(previewFails-->0)return route.fulfill({status:503,json:{detail:'Preview service unavailable'}});
   const preview=model(state);preview.institution.name=body.configuration.institution_name;preview.title=body.name;preview.sections=body.configuration.paper_pattern.sections.map((s:any)=>({title:s.name,instruction:`Attempt ${s.attempted}`,attempted_marks:String(s.attempted*s.marks_each),questions:[{number:1,text:'[Question not yet selected]',marks:String(s.marks_each),options:[],choice_instruction:'',or_before:false}]}));return route.fulfill({json:{render_model:preview}});
  }
  if(path.endsWith('/activate')){if(options.activationFails)return route.fulfill({status:409,json:{detail:'Activation failed'}});const row=rows.find(r=>path.includes('/'+r.id+'/'))!;row.status='ACTIVE';row.revision++;return route.fulfill({json:row});}
  if(path.endsWith('/prepare-pattern'))return route.fulfill({json:{id:'selected-pattern',version:1,status:'PUBLISHED',syllabus_version_id:'sv',config:combined.configuration.paper_pattern}});
  return route.fulfill({json:{render_model:model(state)}});
 });
 if(options.readonly){await page.getByRole('button',{name:'Software Engineering Midterm',exact:true}).click();await expect(page.getByRole('navigation',{name:'Paper editing sections'})).toBeVisible();}else await openDraft(page);
 return {...studio,rows,calls};
}
