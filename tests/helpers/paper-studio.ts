import {expect,type Page} from '@playwright/test';
export const subject={id:'studio-subject',code:'CS304PC',name:'Software Engineering',program_code:'BTECH',branch_code:'CSE',year_number:2,semester_number:3,institution_name:'Test College'};
export function fixtures(){
 const syllabus={cos:[{id:'co',code:'CO1',title:'Engineering',position:1}],units:[{id:'u',code:'U1',title:'Design',position:1}],topics:[{id:'t',unit_id:'u',code:'T1',title:'Risk',position:1}]};
 const sections=[{id:'a',name:'Part A',offered:2,attempted:2,marks_each:'2',question_type:'SHORT_ANSWER',format:'STANDARD',choice_groups:[]},{id:'b',name:'Part B',offered:1,attempted:1,marks_each:'16',question_type:'DESCRIPTIVE',format:'STANDARD',choice_groups:[]}];
 const structure=['1','2','3a','3b'].map((label,i)=>({position:i+1,label,marks:i<2?'2':'16',branch_id:i<2?'':`branch-${i}`,branch_label:i===3?'b':'a',constraints:{co_id:'co',unit_id:'u',topic_id:'t',bloom_level:'K2',difficulty:'MEDIUM'}}));
 const items=structure.map((node,i)=>({id:`slot-${node.label}`,section_id:i<2?'a':'b',position:node.position,choice_group:null,snapshot:null as any,question_version:null as number|null}));
 const base={id:'draft',title:'Software Engineering Midterm',version:1,revision:4,status:'DRAFT',updated_at:'2026-10-16T04:00:00Z',syllabus_version_id:'sv',blueprint_id:'bp',blueprint_version:1,duration_minutes:180,metadata:{instructions:'Answer all questions.',examination_session:'October 2026'},structure,blueprint_snapshot:{title:'20 marks',duration_minutes:180,sections},syllabus_snapshot:syllabus,items,validation:{valid:false,errors:['All questions must be assigned'],checks:[]},totals:{offered_marks:'36',attempted_marks:'20'}};
 const questions=items.map((item,i)=>({id:`q-${i}`,subject_id:subject.id,question_text:i<2?`Explain software engineering concept ${i+1}.`:'Analyze risk management with examples.',answer:'An evidence-based model answer.',marks:i<2?2:16,question_type:i<2?'SHORT_ANSWER':'DESCRIPTIVE',options:[],co_id:'co',unit_id:'u',topic_id:'t',bloom_level:'K2',difficulty:'MEDIUM',status:'APPROVED',version:1,source_type:'AI',rationale:'Suitable for the selected topic.'}));
 const build={id:'build',status:'COMPLETED',revision:9,failure_reason:'',stale:false,paper_revision:4,total_positions:4,positions:items.map((item,i)=>({item_id:item.id,label:structure[i].label,section:i<2?'Part A':'Part B',request:{marks:i<2?'2':'16',question_type:questions[i].question_type,co_id:'co',unit_id:'u',topic_id:'t',bloom_level:'K2',difficulty:'MEDIUM'},job:{id:`job-${i}`,status:'COMPLETED',revision:1,failure_reason:'',results:[{id:`result-${i}`,decision:i===3?'PENDING':'ACCEPTED',duplicate:i===3,warnings:[],question:questions[i],provenance:[],marking_scheme:'Credit relevant points.',question_id:i===3?null:questions[i].id,question_version:i===3?undefined:1,review_status:i===3?undefined:'APPROVED'}]}}))};
 const filled=items.map((item,i)=>({...item,snapshot:{...questions[i],question_text:i===3?'Assess proactive software risks with a worked example.':questions[i].question_text},question_version:1}));
 const papers=[base,{...structuredClone(base),id:'review',title:'Faculty review paper',status:'FACULTY_REVIEW',items:filled},{...structuredClone(base),id:'approved',title:'Approved exam',status:'APPROVED',items:filled},{...structuredClone(base),id:'locked',title:'Final exam',status:'LOCKED',items:filled,revision:8},{...structuredClone(base),id:'changes',title:'Returned for correction',status:'CHANGES_REQUESTED'}];
 const config={layout_style:'UNIVERSITY',institution_name:'Test College',institution_short_name:'TC',header_alignment:'CENTER',institution_alignment:'CENTER',logo_placement:'CENTER',show_logo:false,show_address:false,show_page_numbers:true,show_fields:['program','branch','year','semester','examination_session','course_code','course_name','duration','maximum_marks'],address_text:'',contact_text:'',header_text:'',footer_text:'',section_style:'NORMAL',numbering:'CONTINUOUS'};
 const templates=[{id:'college-template',name:'Test College Exam',description:'Test layout',configuration:config,version:1,revision:1,status:'ACTIVE',used:false,has_logo:false}];
 return {papers,questions,build,syllabus,sections,templates,config,mutations:[] as {path:string;body:any}[],previewFails:0,listFails:0,readOnly:false,active:false,conflict:false,rebaseFails:false};
}
export type StudioState=ReturnType<typeof fixtures>;
export function model(state:StudioState,paper=state.papers[0],candidate=false,kind='STUDENT'){
 return {institution:{name:'Test College',address:'',contact:''},title:paper.title,paper_version:paper.version,revision:paper.revision,document_type:kind,layout:state.config,fields:[{label:'Program',value:'BTECH'},{label:'Branch',value:'CSE'},{label:'Semester',value:'3'},{label:'Course Code',value:subject.code},{label:'Course Name',value:subject.name},{label:'Examination Session',value:paper.metadata.examination_session},{label:'Duration',value:'180 minutes'},{label:'Maximum marks',value:'20'}],instructions:paper.metadata.instructions,offered_marks:'36',warnings:[],sections:state.sections.map(section=>({title:section.name,instruction:'Answer the required questions.',attempted_marks:section.id==='a'?'4':'16',questions:paper.items.filter(i=>i.section_id===section.id).map(item=>{const index=paper.items.indexOf(item);const q=candidate?state.build.positions[index].job.results[0].question:item.snapshot;return {number:paper.structure[index].label.replace(/(\d+)([ab])/,'$1($2)'),text:q?.question_text||'[Question not yet selected]',marks:String(q?.marks||paper.structure[index].marks),options:q?.options||[],mapping:{marks:String(q?.marks||2),k_level:'K2',co:'CO1'},answer:kind==='ANSWER'?q?.answer:undefined,choice_instruction:'',or_before:index===3};})}))};
}
export async function setupStudio(page:Page,state=fixtures()){
 await page.addInitScript(({id})=>{localStorage.setItem('access_token','studio-test');sessionStorage.setItem('qpg-workspace-context',JSON.stringify({program:'BTECH',branch:'CSE',year:'2',semester:'3',subject:id}));sessionStorage.setItem('qpg-workspace-academic',JSON.stringify({institution_name:'',education_level:'',batch_name:'',specialization_name:'',legacy:true}));}, {id:subject.id});
 const pageErrors:string[]=[];page.on('pageerror',e=>pageErrors.push(e.message));
 await page.route(/\/v[13]\//,async route=>{
  const req=route.request(),url=new URL(req.url()),path=url.pathname,method=req.method();let data:any={items:[],enabled:false};const body=method==='GET'?null:req.postDataJSON();
  if(method!=='GET')state.mutations.push({path,body});
  const fail=(status:number,detail:string)=>route.fulfill({status,json:{detail}});
  if(path.endsWith('/users/me'))data={user_id:'faculty',name:'Faculty',email:'faculty@local.test'};
  else if(path.endsWith('/college/access'))data={enabled:true,college_name:'Test College'};
  else if(path.endsWith('/academic-options'))data={programs:[{code:'BTECH',display_name:'B.Tech',duration_years:4,departments:[{code:'CSE',display_name:'Computer Science'}]}],erp_subjects:[],can_setup:false,can_write:!state.readOnly};
  else if(path.endsWith('/subjects'))data={items:[subject]};
  else if(path.endsWith('/syllabus/versions'))data={items:[{id:'sv',version:1,status:'PUBLISHED'}]};
  else if(path.endsWith('/blueprints'))data={items:[{id:'bp',version:1,status:'PUBLISHED',syllabus_version_id:'sv',config:{title:'20 marks',duration_minutes:180,sections:state.sections}}]};
  else if(path.endsWith('/templates'))data={items:state.templates,branding:{name:'Test College'}};
  else if(path.includes('/templates/')&&path.endsWith('/preview'))data={render_model:model(state)};
  else if(path.endsWith('/generation-config'))data={enabled:!state.readOnly};
  else if(path.includes('/generation-jobs/')){
   const job=state.build.positions.find(p=>path.includes(p.job.id))?.job;
   if(!job)return fail(404,'Job not found');
   const result=job.results[0];
   if(path.endsWith('/accept')){if(result.duplicate)return fail(409,'Exact normalized duplicate exists. Edit the candidate or reject it.');result.decision='ACCEPTED';result.question_id=result.question.id;result.question_version=1;result.review_status='APPROVED';job.revision++;}
   else if(method==='PUT'){if(body.expected_revision!==job.revision)return fail(409,'The question changed. Reload before saving.');result.question={...result.question,question_text:body.question_text,answer:body.answer,options:body.options};result.duplicate=false;job.revision++;}
   data=job;
  }
  else if(path.includes('/papers')){
   const match=path.match(/\/papers\/([^/]+)/),paper=state.papers.find(p=>p.id===match?.[1]);
   if(!match){if(method==='GET'){if(state.listFails-->0)return fail(500,'Paper list unavailable');data={items:state.papers};}else{const created={...structuredClone(state.papers[0]),id:'created',title:'New paper',revision:1};state.papers.push(created);data=created;}}
   else if(!paper)return fail(404,'Paper not found');
   else if(path.endsWith('/ai-build'))data={build:paper.id==='draft'?state.build:null};
   else if(path.endsWith('/rebase')){if(state.rebaseFails)return fail(409,'The syllabus or pattern changed. Start a new build; existing candidates remain saved.');state.build.stale=false;state.build.paper_revision=paper.revision;state.build.revision++;data=state.build;}
   else if(path.includes('/regenerate'))return fail(400,'Paid generation intentionally blocked by test');
   else if(path.endsWith('/assemble')){if(state.build.positions.some(p=>p.job.results[0].decision!=='ACCEPTED'))return fail(422,'Resolve all questions before assembly');paper.items=paper.items.map((item,i)=>({...item,snapshot:state.build.positions[i].job.results[0].question,question_version:1}));paper.revision++;paper.status='VALIDATED';paper.validation={valid:true,errors:[],checks:['All questions assigned']};data=paper;}
   else if(path.endsWith('/preview')||path.endsWith('/export-preview')){if(state.previewFails-->0)return fail(500,'Preview temporarily unavailable');data={render_model:model(state,paper,path.includes('/ai-build/'),url.searchParams.get('document_type')||'STUDENT')};}
   else if(path.endsWith('/history'))data={items:[]};
   else if(path.endsWith('/availability'))data={sections:state.sections.map(s=>({section_id:s.id,name:s.name,counts:{APPROVED:10,NEEDS_REVIEW:0,DRAFT:0,ARCHIVED:0},available_distinct:10,required:2,sufficient:true}))};
   else if(path.endsWith('/exports'))data={items:[],can_export_answers:!state.readOnly};
   else if(path.endsWith('/eligible'))data={items:state.questions.filter(q=>q.marks===Number(url.searchParams.get('marks'))),total:4,available_distinct:4,required:2,sufficient:true,counts:{APPROVED:4,ARCHIVED:0}};
   else if(path.endsWith('/new-version')){const draft={...structuredClone(paper),id:'new-version',version:paper.version+1,revision:1,status:'DRAFT'};state.papers.push(draft);data=draft;}
   else if(path.endsWith('/validate')){paper.status='VALIDATED';paper.revision++;paper.validation={valid:true,errors:[],checks:['All questions assigned']};data=paper;}
   else if(path.endsWith('/review')){paper.status='FACULTY_REVIEW';paper.revision++;data=paper;}
   else if(path.endsWith('/lock')){paper.status='LOCKED';paper.revision++;data=paper;}
   else if(method==='PUT'&&path.includes('/items/')){const item=paper.items.find(i=>path.endsWith('/'+i.id));const q=state.questions.find(q=>q.id===body.question_id);if(!item||!q)return fail(422,'Invalid selection');if(body.expected_revision!==paper.revision)return fail(409,'Paper changed');item.snapshot=q;item.question_version=q.version;paper.revision++;data=paper;}
   else if(method==='PUT'){if(state.conflict||body.expected_revision!==paper.revision)return fail(409,'The paper changed. Reload before saving.');paper.title=body.title;paper.metadata={...paper.metadata,instructions:body.instructions,examination_session:body.examination_session};Object.assign(paper.metadata,...(body.document_details!==undefined?[{document_details:body.document_details}]:[]),...(body.document_style!==undefined?[{document_style:body.document_style}]:[]));paper.revision++;data=paper;}
   else data=paper;
  }
  await route.fulfill({json:data});
 });
 await page.goto('/dashboard/question-papers/paper-generation?view=papers');
 await expect(page.getByRole('region',{name:'My papers'})).toBeVisible();
 return {state,pageErrors};
}
export async function openDraft(page:Page){await page.getByRole('button',{name:'Software Engineering Midterm',exact:true}).click();await expect(page.getByRole('navigation',{name:'Paper editing sections'})).toBeVisible();await expect(page.getByRole('button',{name:'1 need attention ↗',exact:true}).first()).toBeVisible();}
