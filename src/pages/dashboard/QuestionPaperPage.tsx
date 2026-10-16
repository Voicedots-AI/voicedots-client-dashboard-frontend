import {extractCurriculum,waitForCurriculum} from '@/api/qpgCurriculumExtraction';
import QpgSyllabusExtractPanel, {type Course} from './QpgSyllabusExtractPanel';
import QpgReportsPanel from './QpgReportsPanel';
import QpgTemplatesPanel from './QpgTemplatesPanel';
import QpgQuestionIntelligencePanel from './QpgQuestionIntelligencePanel';
import QpgRepetitionPanel from './QpgRepetitionPanel';
import QpgGeneratePanel from './QpgGeneratePanel';
import QpgPaperPanel from './QpgPaperPanel';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { FormEvent, ReactNode } from 'react';
import { Plus, Upload, Sparkles, BookOpen, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, FieldLabel } from '@/components/ui/field';
import { useCollegeAccess } from '@/hooks/useCollegeAccess';
import { collegeApi, collegeError } from '@/api/collegeApi';
import type { Program } from '@/api/collegeApi';
import { qpgApi, questionTypes, blooms, difficulties, sourceTypes, label } from '@/api/qpgApi';
import type { Subject, SyllabusItem, Question, QuestionVersion } from '@/api/qpgApi';
import './erp.css';
import './qpg-bank.css';
import Dialog from './QpgDialog';
import QpgImportPanel from './QpgImportPanel';
import QpgSyllabusPanel from './QpgSyllabusPanel';
import QpgBlueprintPanel from './QpgBlueprintPanel';

const inputClass='w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';
type Academic = {institution_name:string;education_level:string;batch_name:string;specialization_name:string};
const emptyAcademic:Academic={institution_name:"",education_level:"",batch_name:"",specialization_name:""};
type Options = { academic_contexts?:(Academic&{program_code:string;branch_code:string})[]; programs:Program[]; erp_subjects:{id:string;code:string;name:string;department_code:string|null}[]; can_setup:boolean; can_write:boolean };
type Context = {program:string;branch:string;year:string;semester:string;subject:string};
type Filters = {q:string;unit_id:string;topic_id:string;bloom_level:string;difficulty:string;question_type:string;status:string};
const emptyFilters:Filters={q:'',unit_id:'',topic_id:'',bloom_level:'',difficulty:'',question_type:'',status:''};

export default function QuestionPaperPage(){
  const {access,loading,error,retry}=useCollegeAccess();
  if(loading)return <p role="status">Checking institution access…</p>;
  if(error)return <div role="alert">{error} <Button onClick={retry}>Retry</Button></div>;
  if(!access?.enabled)return <section className="erp-card"><h1>Institution access required</h1><p>Your administrator must link your account to an institution.</p></section>;
  return <QuestionWorkspace institution={access.college_name||'Your institution'}/>;
}

function savedPaperReview(){
  try{const saved=JSON.parse(sessionStorage.getItem('qpg-paper-review')||'null');const context=JSON.parse(sessionStorage.getItem('qpg-workspace-context')||'null');if(saved&&saved.subject===context?.subject&&Array.isArray(saved.ids)&&saved.ids.every((id:unknown)=>typeof id==='string'))return saved as {subject:string;ids:string[]};}catch{/* Ignore invalid local navigation state. */}
  return null;
}
function savedWorkspaceAcademic(){
  try{const saved=JSON.parse(sessionStorage.getItem('qpg-workspace-academic')||'null');if(saved&&Object.keys(emptyAcademic).every(key=>typeof saved[key]==='string')&&typeof saved.legacy==='boolean')return saved as Academic&{legacy:boolean};return {...emptyAcademic,legacy:false};}catch{return {...emptyAcademic,legacy:false};}
}
function QuestionWorkspace({institution}:{institution:string}){
  const location=useLocation();
  const navigate=useNavigate();
  const requestedView=new URLSearchParams(location.search).get('view');
  const generationPage=location.pathname.endsWith('/paper-generation');
  const routeTab=['review','drafts'].includes(requestedView||'')?'bank':requestedView==='home'?'academic':requestedView||(generationPage?'papers':'academic');
  const [tab,setTabState]=useState(routeTab);
  useEffect(()=>{setTabState(routeTab);},[routeTab]);
  const generationWorkspace=generationPage||(!location.pathname.endsWith('/question-bank')&&['blueprint','papers','templates'].includes(tab));
  const [changingContext,setChangingContext]=useState(false);
  const [returnToPaper,setReturnToPaper]=useState(()=>!!savedPaperReview());
  const [reviewQuestionIds,setReviewQuestionIds]=useState<string[]|undefined>(()=>savedPaperReview()?.ids);
  const [paperLibraryRequest,setPaperLibraryRequest]=useState(0);
  const [paperView,setPaperView]=useState<'create'|'drafts'|'review'|'final'>(()=>{const saved=sessionStorage.getItem('qpg-paper-view');return saved==='drafts'||saved==='review'||saved==='final'?saved:'create';});
  useEffect(()=>{sessionStorage.setItem('qpg-paper-view',paperView);},[paperView]);
  const module= ['academic','syllabus'].includes(tab)?'academic':['bank','drafts','generate','review','intelligence','imports'].includes(tab)?'bank':['blueprint','papers'].includes(tab)?'papers':tab;
  function setTab(value:string){
    if(['generate','imports','intelligence','drafts'].includes(value)){setReturnToPaper(false);setReviewQuestionIds(undefined);}
    setTabState(value);setError('');setNotice('');setOffset(0);
    const generation=['blueprint','papers','templates'].includes(value)||(value==='reports'&&generationWorkspace);
    navigate({pathname:`/dashboard/question-papers/${generation?'paper-generation':'question-bank'}`,search:`?view=${encodeURIComponent(value)}`});
  }
  const [curriculum,setCurriculum]=useState<Course[]>([]);
  const [savedCurricula,setSavedCurricula]=useState<{id:string;filename:string;course_count:number;course_slots?:number|null;structured_course_count?:number|null;elective_option_count?:number|null}[]>([]);
  const [curriculumId,setCurriculumId]=useState('');
  const [curriculumWarnings,setCurriculumWarnings]=useState<string[]>([]);
  const [curriculumSummary,setCurriculumSummary]=useState<{course_slots?:number;structured_course_count?:number;elective_option_count?:number}>({});
  const [curriculumFile,setCurriculumFile]=useState<File|null>(null);
  const [extracting,setExtracting]=useState(false);
  const [creatingCourse,setCreatingCourse]=useState(false);
  const [courseCode,setCourseCode]=useState('');
  const [reviewCourse,setReviewCourse]=useState<Course|null>(null);
  const [reviewSubject,setReviewSubject]=useState('');
  const [syllabusRefresh,setSyllabusRefresh]=useState(0);
  const [options,setOptions]=useState<Options|null>(null);
  const sectionTabs=generationWorkspace?[['papers','My Papers'],['reports','Reports']]:[['academic','Subject Master'],['syllabus','Syllabus Master'],['bank','Question bank']];
  const [context,setContext]=useState<Context>({program:'',branch:'',year:'',semester:'',subject:''});
  const [legacyContext,setLegacyContext]=useState(false);
  const [academic,setAcademic]=useState<Academic>(emptyAcademic);
  const metadata=curriculum[0]?.academic_metadata;
  const academicReady=Object.values(academic).every(value=>value.trim());
  function changeAcademic(key:keyof Academic,value:string){if(academic[key]===value)return;setAcademic(old=>{const next={...old,[key]:value};const order:(keyof Academic)[]=['institution_name','education_level','batch_name','specialization_name'];for(const field of order.slice(order.indexOf(key)+1))next[field]='';return next;});setContext({program:'',branch:'',year:'',semester:'',subject:''});setCourseCode('');setSubjects([]);setReviewCourse(null);setError('');}
  const [subjects,setSubjects]=useState<Subject[]>([]);
  // Question Bank / Prepare Paper keep their own subject selector. Syllabus
  // Master and Subject Master have a separate academic context above.
  function loadExtractedCourses(courses:Course[]){
    setCurriculum(courses);
    const detected=courses[0]?.academic_metadata;
    if(!detected||!options)return;
    const clean=(value:string)=>value.toLowerCase().replace(/[^a-z0-9]/g,'');
    const degreeAliases:Record<string,string>={btech:'bacheloroftechnology',mtech:'masteroftechnology',mba:'masterofbusinessadministration',mca:'masterofcomputerapplications',bca:'bachelorofcomputerapplications',bba:'bachelorofbusinessadministration'};
    const match=(value:string,code:string,title:string)=>{const raw=clean(value);const expanded=degreeAliases[raw]||raw;const abbreviation=title.split(/[^a-zA-Z]+/).filter(w=>w&&!['and','of','the'].includes(w.toLowerCase())).map(w=>w[0]).join('').toLowerCase();return raw===clean(code)||expanded===clean(title)||raw===clean(title)||raw===abbreviation;};
    const extractedDegree=detected.degree_name?.value||'';
    const degree=options.programs.find(p=>match(extractedDegree,p.code,p.display_name));
    const department=degree?.departments.find(d=>match(detected.department_name?.value||'',d.code,d.display_name));
    setLegacyContext(false);
    setAcademic({institution_name:detected.institution_name?.value||'',education_level:['Undergraduate','Postgraduate','Diploma','Doctoral'].includes(detected.education_level?.value||'')?detected.education_level.value:degree&&['MBA','MCA','MTECH'].includes(degree.code.toUpperCase())?'Postgraduate':degree&&['BTECH','BCA','BBA'].includes(degree.code.toUpperCase())?'Undergraduate':'',batch_name:detected.batch_name?.value||'',specialization_name:department?detected.specialization_name?.value||'':''});
    const years=[...new Set(courses.map(c=>c.year_number).filter(Boolean))];
    const semesters=[...new Set(courses.map(c=>c.semester_number).filter(Boolean))];
    const year=degree&&years.length===1&&Number(years[0])<=degree.duration_years?String(years[0]):'';const semester=year&&semesters.length===1&&[Number(year)*2-1,Number(year)*2].includes(Number(semesters[0]))?String(semesters[0]):'';
    setContext({program:degree?.code||'',branch:department?.code||'',year,semester,subject:''});
    setSubjects([]);
  }
  const [qpgContext,setQpgContext]=useState<Context>(()=>{try{const saved=JSON.parse(sessionStorage.getItem('qpg-workspace-context')||'null');if(saved&&['program','branch','year','semester','subject'].every(key=>typeof saved[key]==='string'))return saved;}catch{/* Start with an empty selector if stored context is invalid. */}return {program:'',branch:'',year:'',semester:'',subject:''};});
  const [qpgAcademic,setQpgAcademic]=useState<Academic>(()=>{const {legacy:_,...fields}=savedWorkspaceAcademic();void _;return fields;});
  const [qpgLegacy,setQpgLegacy]=useState(()=>savedWorkspaceAcademic().legacy);
  useEffect(()=>{sessionStorage.setItem('qpg-workspace-academic',JSON.stringify({...qpgAcademic,legacy:qpgLegacy}));},[qpgAcademic,qpgLegacy]);
  useEffect(()=>{sessionStorage.setItem('qpg-workspace-context',JSON.stringify(qpgContext));},[qpgContext]);
  useEffect(()=>{if(returnToPaper&&reviewQuestionIds)sessionStorage.setItem('qpg-paper-review',JSON.stringify({subject:qpgContext.subject,ids:reviewQuestionIds}));else sessionStorage.removeItem('qpg-paper-review');},[returnToPaper,reviewQuestionIds,qpgContext.subject]);
  const [qpgSubjects,setQpgSubjects]=useState<Subject[]>([]);
  const [cos,setCos]=useState<SyllabusItem[]>([]);
  const [units,setUnits]=useState<SyllabusItem[]>([]);
  const [topics,setTopics]=useState<SyllabusItem[]>([]);
  const [filters,setFilters]=useState<Filters>(emptyFilters);
  const activeFilterCount=Object.entries(filters).filter(([key,value])=>value&&(tab!=='drafts'||key!=='status')).length;
  const clearFilters=()=>{setFilters(emptyFilters);setOffset(0);};
  const [questions,setQuestions]=useState<Question[]>([]);
  const [studentReleases,setStudentReleases]=useState<Record<string,boolean>>({});
  const [studentSharingAvailable,setStudentSharingAvailable]=useState(false);
  const [releaseBusy,setReleaseBusy]=useState('');
  const [total,setTotal]=useState(0);const [offset,setOffset]=useState(0);
  const [loading,setLoading]=useState(true);const [bankLoading,setBankLoading]=useState(false);
  const [error,setError]=useState('');const [notice,setNotice]=useState('');const [refresh,setRefresh]=useState(0);
  const [dialog,setDialog]=useState<'question'|'subject'|'cos'|'units'|'topics'|'details'|'imports'|'degree'|'department'|null>(null);
  const [selected,setSelected]=useState<Question|null>(null);
  const program=options?.programs.find(p=>p.code===context.program);
  const qpgProgram=options?.programs.find(p=>p.code===qpgContext.program);
  const selectedSubject=qpgSubjects.find(s=>s.id===qpgContext.subject);
  const syllabusSubject=subjects.find(s=>s.id===context.subject);
  function changeContext(key:keyof Context,value:string){
    if(creatingCourse||extracting)return;
    setCourseCode('');
    if(key==='program'||key==='branch')setAcademic(old=>({...old,specialization_name:''}));
    const order:(keyof Context)[]=['program','branch','year','semester','subject'];
    const next={...context,[key]:value};for(const dependent of order.slice(order.indexOf(key)+1))next[dependent]='';
    if(key!=='subject')setSubjects([]);setContext(next);setNotice('');setError('');
  }
  function changeQpgAcademic(key:keyof Academic,value:string){
    const order:(keyof Academic)[]=['institution_name','education_level','batch_name','specialization_name'];
    setQpgAcademic(old=>{const next={...old,[key]:value};for(const field of order.slice(order.indexOf(key)+1))next[field]='';return next;});
    changeQpgContext(key==='specialization_name'?'year':'program','');
  }
  function changeQpgContext(key:keyof Context,value:string){
    if(key==='program'||key==='branch')setQpgAcademic(old=>({...old,specialization_name:''}));
    const order:(keyof Context)[]=['program','branch','year','semester','subject'];
    const next={...qpgContext,[key]:value};for(const dependent of order.slice(order.indexOf(key)+1))next[dependent]='';
    if(key!=='subject')setQpgSubjects([]);
    setCos([]);setUnits([]);setTopics([]);setQuestions([]);setTotal(0);setQpgContext(next);setFilters(emptyFilters);setOffset(0);setSelected(null);setReturnToPaper(false);setReviewQuestionIds(undefined);if(key==='subject')setChangingContext(false);setNotice('');setError('');
  }
  useEffect(()=>{const controller=new AbortController();qpgApi.get<{items:{id:string;filename:string;course_count:number;course_slots?:number|null;structured_course_count?:number|null;elective_option_count?:number|null}[]}>('curricula',controller.signal).then(r=>{if(!Array.isArray(r.items)){setError("Saved curricula could not be loaded. Please retry.");return;}setSavedCurricula(r.items);}).catch(()=>{if(!controller.signal.aborted)setError('Saved curricula could not be loaded. Please retry.');});return()=>controller.abort();},[]);
  useEffect(()=>{
    const controller=new AbortController();
    qpgApi.get<Options>('academic-options',controller.signal).then(setOptions).catch(e=>{if(!controller.signal.aborted)setError(collegeError(e));}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return ()=>controller.abort();
  },[refresh]);
  useEffect(()=>{
    if(!context.program||!context.branch||!context.year||!context.semester)return;
    const controller=new AbortController();
    const query=new URLSearchParams({program_code:context.program,branch_code:context.branch,year_number:context.year,semester_number:context.semester,...academic});
    qpgApi.get<{items:Subject[]}>(`subjects?${query}`,controller.signal).then(r=>setSubjects(r.items)).catch(e=>{if(!controller.signal.aborted)setError(collegeError(e));});
    return ()=>controller.abort();
  },[context.program,context.branch,context.year,context.semester,academic,refresh]);
  useEffect(()=>{
    if(!qpgContext.program||!qpgContext.branch||!qpgContext.year||!qpgContext.semester)return;
    const controller=new AbortController();
    const query=new URLSearchParams({program_code:qpgContext.program,branch_code:qpgContext.branch,year_number:qpgContext.year,semester_number:qpgContext.semester,...(qpgLegacy?{}:qpgAcademic)});
    qpgApi.get<{items:Subject[]}>(`subjects?${query}`,controller.signal).then(r=>{if(!controller.signal.aborted)setQpgSubjects(r.items);}).catch(e=>{if(!controller.signal.aborted)setError(collegeError(e));});
    return ()=>controller.abort();
  },[qpgContext.program,qpgContext.branch,qpgContext.year,qpgContext.semester,qpgAcademic,qpgLegacy,refresh]);
  useEffect(()=>{
    if(!qpgContext.subject)return;
    const controller=new AbortController();
    void (async()=>{
      try{
        const [c,u]=await Promise.all([qpgApi.get<{items:SyllabusItem[]}>(`subjects/${qpgContext.subject}/cos`,controller.signal),qpgApi.get<{items:SyllabusItem[]}>(`subjects/${qpgContext.subject}/units`,controller.signal)]);
        const t=await Promise.all(u.items.map(unit=>qpgApi.get<{items:SyllabusItem[]}>(`units/${unit.id}/topics`,controller.signal)));
        if(!controller.signal.aborted){setCos(c.items);setUnits(u.items);setTopics(t.flatMap(r=>r.items));}
      }catch(e){if(!controller.signal.aborted)setError(collegeError(e));}
    })();return ()=>controller.abort();
  },[qpgContext.subject,refresh]);
  useEffect(()=>{
    if(!qpgContext.subject||!['bank','drafts'].includes(tab))return;
    const controller=new AbortController();
    const timer=setTimeout(()=>{
      setBankLoading(true);
      const query=new URLSearchParams({subject_id:qpgContext.subject,limit:'50',offset:String(offset)});
      Object.entries(filters).forEach(([key,value])=>{if(value)query.set(key,value);});
      if(tab==='drafts')query.set('status','DRAFT');
      qpgApi.get<{items:Question[];total:number}>(`questions?${query}`,controller.signal).then(r=>{setQuestions(r.items);setTotal(r.total);}).catch(e=>{if(!controller.signal.aborted)setError(collegeError(e));}).finally(()=>{if(!controller.signal.aborted)setBankLoading(false);});
    },200);return ()=>{clearTimeout(timer);controller.abort();};
  },[qpgContext.subject,filters,offset,tab,refresh]);
  useEffect(()=>{
    if(!qpgContext.subject||!options?.can_setup||!['bank','drafts'].includes(tab))return;
    const controller=new AbortController();
    setStudentSharingAvailable(false);
    qpgApi.get<{items:{question_id:string;published:boolean}[]}>(`student-question-releases?subject_id=${encodeURIComponent(qpgContext.subject)}`,controller.signal)
      .then(result=>{if(!controller.signal.aborted){setStudentReleases(Object.fromEntries(result.items.map(item=>[item.question_id,item.published])));setStudentSharingAvailable(true);}})
      .catch(e=>{if(!controller.signal.aborted){setStudentSharingAvailable(false);if(e?.response?.status!==404)setError(collegeError(e));}});
    return ()=>controller.abort();
  },[qpgContext.subject,options?.can_setup,tab,refresh]);
  const saved=()=>{setDialog(null);setSelected(null);setRefresh(v=>v+1);setNotice('Saved successfully.');setError('');};
  function filter(key:keyof Filters,value:string){setFilters({...filters,[key]:value,...(key==='unit_id'?{topic_id:''}:{})});setOffset(0);}
  async function archive(question:Question){
    if(!window.confirm('Archive this question? It will remain available in history.'))return;
    try{await qpgApi.save(`questions/${question.id}/archive`,{expected_version:question.version});saved();}catch(e){setError(collegeError(e));}
  }
  async function toggleStudentRelease(question:Question){
    const publish=!studentReleases[question.id];
    if(publish&&question.status!=='APPROVED')return;
    setReleaseBusy(question.id);setError('');setNotice('');
    try{
      await qpgApi.save(`questions/${question.id}/${publish?'student-publish':'student-archive'}`,{});
      setStudentReleases(previous=>({...previous,[question.id]:publish}));
      setNotice(publish?'Question released to students for this subject and batch.':'Question removed from the student practice bank.');
    }catch(e){setError(collegeError(e));}
    finally{setReleaseBusy('');}
  }
  return <main className={`erp-workspace min-w-0 qpg-bank-workspace ${generationWorkspace?'qpg-paper-workspace':''}`}>
    <header className="mb-6"><p className="text-sm text-slate-500">{!generationWorkspace&&<BookOpen size={16} aria-hidden="true"/>}{institution} · Question Paper Generation</p><h1 className="mt-1 text-2xl font-bold">{generationWorkspace?'Paper Generation':'Master Question Bank'}</h1><p className="mt-2 text-sm text-slate-500">{generationWorkspace?'Choose an exam pattern, assemble and review your paper, then export the final document.':'Add, import or generate questions. Edit them whenever you need, then use them in your papers.'}</p></header>
    <nav aria-label="Question paper sections" className="mb-4 flex gap-1 overflow-x-auto border-b border-slate-200 pb-2">{sectionTabs.map(([key,title])=>{const active=key==='papers'?tab==='papers':key==='bank'?module==='bank':tab===key;return <Button key={key} className="shrink-0 focus-visible:ring-2 focus-visible:ring-indigo-600" aria-current={active?'page':undefined} variant={active?'default':'ghost'} onClick={()=>{if(key==='papers')setPaperLibraryRequest(n=>n+1);setTab(key);}}>{title}</Button>;})}</nav>

    {error&&<p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {notice&&<p role="status" className="mb-4 rounded-xl bg-indigo-50 p-3 text-sm text-indigo-700">{notice}</p>}
    {loading?<p role="status">Loading academic options…</p>:options&&<>
      {['bank','papers'].includes(module)&&selectedSubject&&!changingContext&&<section aria-label="Selected academic context" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 px-4 py-3"><p className="text-sm">{[selectedSubject.institution_name,selectedSubject.education_level,selectedSubject.batch_name,qpgProgram?.display_name||selectedSubject.program_code,qpgContext.branch,selectedSubject.specialization_name].filter(Boolean).join(' › ')} › Year {qpgContext.year} › Semester {qpgContext.semester} › {selectedSubject.code} · {selectedSubject.name}</p><Button variant="outline" size="sm" onClick={()=>setChangingContext(true)}>Change Subject</Button></section>}
      {['academic','syllabus'].includes(tab)&&syllabusSubject&&<section aria-label="Selected syllabus subject" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 px-4 py-3"><p className="text-sm">{syllabusSubject.institution_name||institution} › {syllabusSubject.education_level} › {syllabusSubject.batch_name} › {program?.display_name||syllabusSubject.program_code} › {context.branch} › {syllabusSubject.specialization_name} › Year {context.year} › Semester {context.semester} › {syllabusSubject.code} · {syllabusSubject.name}</p></section>}
      {tab==='academic'&&options.can_write&&<section className="erp-card mb-5 qpg-curriculum-card" aria-label="Choose curriculum"><div className="qpg-curriculum-heading"><span className="qpg-curriculum-icon"><BookOpen size={19} aria-hidden="true"/></span><div><h2>Curriculum</h2><p>Choose a saved file or upload a new one.</p></div></div><div className="qpg-curriculum-options"><label className="qpg-saved-curriculum">Saved curricula<select className="rounded-lg border bg-white p-3 dark:bg-slate-900" value={curriculumId} disabled={extracting||creatingCourse} onChange={e=>{const id=e.target.value;setCurriculumId(id);setCourseCode('');setReviewCourse(null);setCurriculum([]);setCurriculumSummary({});if(!id)return;setExtracting(true);void qpgApi.get<{courses:Course[];course_slots?:number;structured_course_count?:number;elective_option_count?:number}>(`curricula/${id}`).then(r=>waitForCurriculum(r,setNotice)).then(r=>{if(!Array.isArray(r.courses))throw new Error("Saved curriculum is unavailable. Please retry.");loadExtractedCourses(r.courses.map(c=>({...c,curriculum_id:r.id})));setCurriculumWarnings(r.warnings||[]);setCurriculumSummary({course_slots:r.course_slots,structured_course_count:r.structured_course_count,elective_option_count:r.elective_option_count});setSavedCurricula(old=>old.map(c=>c.id===id?{...c,course_count:r.courses.length,course_slots:r.course_slots,structured_course_count:r.structured_course_count,elective_option_count:r.elective_option_count}:c));setNotice('Saved curriculum loaded. Choose the academic context and subject.');}).catch(e=>{setNotice('');setError(collegeError(e));}).finally(()=>setExtracting(false));}}><option value="">Select a curriculum</option>{savedCurricula.map(c=><option key={c.id} value={c.id}>{c.filename} · {c.course_count} courses{c.elective_option_count?` (${c.elective_option_count} elective options)`:''}{c.course_slots?` · ${c.course_slots} semester slots`:''}</option>)}</select></label><div className="qpg-curriculum-upload"><label className={`qpg-curriculum-file ${extracting||creatingCourse?'is-disabled':''}`}><Upload size={16} aria-hidden="true"/><span>Upload curriculum</span><input aria-label="Curriculum document" type="file" accept=".pdf,.docx" disabled={extracting||creatingCourse} onChange={e=>{setCurriculumFile(e.target.files?.[0]||null);setCurriculum([]);setCurriculumId('');setCurriculumSummary({});setCourseCode('');setReviewCourse(null);}}/></label></div></div>{curriculumFile&&<div className="qpg-curriculum-selected"><div><span className="qpg-selected-label">Selected file</span><span className="qpg-selected-name">{curriculumFile.name}</span></div><Button disabled={extracting||creatingCourse||!curriculumFile} onClick={()=>void (async()=>{setExtracting(true);setCurriculum([]);setCourseCode('');setError('');try{if(!curriculumFile||curriculumFile.size>10*1024*1024||!curriculumFile.size)throw new Error('Choose a non-empty PDF or DOCX up to 10 MB.');const result={data:await extractCurriculum(curriculumFile,'syllabus/extract',setNotice,result=>{if(result.id){setCurriculumId(result.id);setSavedCurricula(old=>[{id:result.id!,filename:result.filename||curriculumFile!.name,course_count:result.courses.length},...old.filter(c=>c.id!==result.id)]);}})};loadExtractedCourses(result.data.courses.map(c=>({...c,curriculum_id:result.data.id})));setCurriculumWarnings(result.data.warnings||[]);setCurriculumId(result.data.id||'');setCurriculumSummary({course_slots:result.data.course_slots,structured_course_count:result.data.structured_course_count,elective_option_count:result.data.elective_option_count});setSavedCurricula(old=>[{id:result.data.id!,filename:result.data.filename||curriculumFile.name,course_count:result.data.courses.length,course_slots:result.data.course_slots,structured_course_count:result.data.structured_course_count,elective_option_count:result.data.elective_option_count},...old.filter(c=>c.id!==result.data.id)]);setCourseCode('');setReviewCourse(null);setNotice(result.data.elective_option_count!=null?`${result.data.courses.length} coded courses available, including ${result.data.elective_option_count} elective choices, across ${result.data.course_slots} semester slots. Select the academic context below.`:`${result.data.courses.length} courses extracted. Select the academic context below.`);}catch(e){setNotice('');setError(collegeError(e));}finally{setExtracting(false);}})()}>{extracting?'Extracting…':'Extract courses'}</Button></div>}<div className="qpg-curriculum-footer"><span>PDF or DOCX · Max. 10 MB</span><details><summary>How it works</summary><p>Your file and extracted courses are saved for reuse. Check each syllabus before publishing. Elective options are listed separately; students choose one per slot. A course code is required before saving a subject.</p></details></div>{curriculumWarnings.length>0&&<details className="mt-3 rounded-lg border border-amber-200 p-3 text-sm"><summary>Extraction notes · check before saving</summary><ul className="mt-2 list-disc pl-5">{curriculumWarnings.map((warning,i)=><li key={i}>{warning}</li>)}</ul></details>}{curriculum.length>0&&<><p className="mt-3 text-sm">Document: {curriculum[0].program_name||'Program not detected'} · {curriculum[0].branch_name||'Branch not detected'}. Confirm the academic fields below. Extracted values are suggestions.</p>{metadata&&<div className="mt-3 rounded-lg border p-3 text-sm"><p className="font-medium">Detected academic details · confirm before saving</p>{Object.entries(metadata).map(([key,item])=><p key={key}>{({institution_name:'Institution',education_level:'Education level',batch_name:'Batch',degree_name:'Degree',department_name:'Department',specialization_name:'Branch'} as Record<string,string>)[key]||key}: {item.value}<span className="ml-2 text-xs text-slate-500">From document: {item.source}</span></p>)}</div>}{curriculumSummary.elective_option_count!=null&&<p className="mt-1 text-xs text-slate-600">{curriculumSummary.structured_course_count} coded semester courses + {curriculumSummary.elective_option_count} elective choices = {curriculum.length} available courses; {curriculumSummary.course_slots} numbered semester slots. Students select one course from each elective group.</p>}</>}</section>}
      {tab==='syllabus'&&reviewCourse&&syllabusSubject&&reviewSubject===syllabusSubject.id&&<QpgSyllabusExtractPanel key={`${reviewSubject}:${reviewCourse.code}`} root="syllabus" initialCourse={reviewCourse} onCourseChange={setReviewCourse} revision={1} target={`${syllabusSubject.name} (${syllabusSubject.code})`} disabled={false} onImport={async payload=>{
        const root=`subjects/${syllabusSubject.id}/syllabus`;
          let syllabus=await qpgApi.get<{current:{status:string;revision:number}|null}>(root);
          if(!syllabus.current||syllabus.current.status!=='DRAFT')syllabus=await qpgApi.save(`${root}/draft`,{});
          await qpgApi.save(`${root}/import`,{...payload,expected_revision:syllabus.current!.revision});
          setRefresh(v=>v+1);setSyllabusRefresh(v=>v+1);setReviewCourse(null);setNotice('Draft saved. Next: check the Course Outcomes, Units and Topics below. Select Review & Publish, review the summary, then click Publish syllabus.');return true;
      }}/>}
      {(tab==='academic'||tab==='reports'||tab==='syllabus'&&!context.subject)&&!['home','templates'].includes(tab)&&<section id="qpg-subject-destination" className="erp-card"><h2>{tab==='academic'&&curriculum.length?"2. Choose academic context":"Select your subject"}</h2><p className="mb-4 mt-1 text-sm text-slate-500">Choose each field from left to right.</p>{tab==='academic'&&curriculum.length>0&&<p className="mb-4 text-sm text-slate-600">If the document does not state the institution, education level, batch or branch, use the matching “Add …” choice and enter the value after checking the source. Administrators can use “Add degree…” and “Add department…” to save missing catalog entries. Year and Semester follow the selected degree.</p>}<Button type="button" variant="outline" className="mb-4" onClick={()=>{setLegacyContext(v=>!v);setAcademic(emptyAcademic);setContext({program:'',branch:'',year:'',semester:'',subject:''});setSubjects([]);setCourseCode('');}}>{legacyContext?'Use full academic selection':'Open existing subjects'}</Button>{legacyContext&&<p className="mb-4 text-sm text-slate-500">Older subjects retain their original links. Their institution, batch and specialisation have not been guessed.</p>}<fieldset disabled={extracting||creatingCourse} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {!legacyContext&&<><AcademicChoice title="Institution" value={academic.institution_name} onChange={v=>changeAcademic('institution_name',v)} items={[institution,'JNTUH',metadata?.institution_name?.value,...(options.academic_contexts||[]).map(c=>c.institution_name)].filter(Boolean) as string[]}/>
        <AcademicChoice title="Education level" value={academic.education_level} disabled={!academic.institution_name} onChange={v=>changeAcademic('education_level',v)} items={['Undergraduate','Postgraduate','Diploma','Doctoral',...(options.academic_contexts||[]).map(c=>c.education_level)]}/>
        <AcademicChoice title="Batch" value={academic.batch_name} disabled={!academic.education_level} onChange={v=>changeAcademic('batch_name',v)} items={[metadata?.batch_name?.value,...(options.academic_contexts||[]).filter(c=>c.institution_name===academic.institution_name&&c.education_level===academic.education_level).map(c=>c.batch_name)].filter(Boolean) as string[]}/></>}
        <Select title="Degree" onAdd={options.can_setup?()=>setDialog('degree'):undefined} disabled={!legacyContext&&!academic.batch_name} value={context.program} onChange={v=>changeContext('program',v)} items={options.programs.map(p=>({value:p.code,title:p.display_name}))}/>
        <Select title="Department" onAdd={options.can_setup?()=>setDialog('department'):undefined} value={context.branch} disabled={!program} onChange={v=>changeContext('branch',v)} items={(program?.departments||[]).map(d=>({value:d.code,title:d.display_name}))}/>
        {!legacyContext&&<AcademicChoice title="Branch" value={academic.specialization_name} disabled={!context.branch} onChange={v=>{setAcademic(old=>({...old,specialization_name:v}));setContext(old=>({...old,year:'',semester:'',subject:''}));setCourseCode('');setSubjects([]);}} items={[metadata?.specialization_name?.value,context.branch==='CSE'?'Core CSE':context.branch,context.branch==='CSE'?'AI & ML':null,context.branch==='CSE'?'Data Science':null,...(!metadata?.specialization_name?.value?['General']:[]),...(options.academic_contexts||[]).filter(c=>c.program_code===context.program&&c.branch_code===context.branch&&c.institution_name===academic.institution_name).map(c=>c.specialization_name)].filter(Boolean) as string[]}/>}
        <Select title="Year" value={context.year} disabled={legacyContext?!context.branch:!academic.specialization_name} onChange={v=>changeContext('year',v)} items={Array.from({length:program?.duration_years||0},(_,i)=>({value:String(i+1),title:`Year ${i+1}`}))}/>
        <Select title="Semester" value={context.semester} disabled={!context.year} onChange={v=>changeContext('semester',v)} items={context.year?[1,2].map(n=>({value:String(Number(context.year)*2-2+n),title:`Semester ${Number(context.year)*2-2+n}`})):[]}/>
        {(tab!=='academic'||!curriculum.length)&&<Select title="Subject" value={context.subject} disabled={!context.semester} onChange={v=>changeContext('subject',v)} items={subjects.map(s=>({value:s.id,title:`${s.code} · ${s.name}${s.institution_name?` · ${s.institution_name} · ${s.batch_name} · ${s.specialization_name}`:""}`}))}/>}
      </fieldset>{(tab!=='academic'||!curriculum.length)&&options.can_setup&&context.semester&&<Button className="mt-4" variant="outline" onClick={()=>setDialog('subject')}><Plus size={15}/>Add Existing Subject</Button>}
      {(tab!=='academic'||!curriculum.length)&&context.semester&&!subjects.length&&<p className="mt-3">No subjects are linked to this context yet. An institution administrator can link an existing subject.</p>}
      {!options.programs.length&&<p>No academic program/branch is available to your account. Ask your institution administrator to configure or assign it in Institution Management.</p>}{curriculum.length>0&&metadata?.degree_name?.value&&!options.programs.some(p=>{const detected=metadata.degree_name.value.toLowerCase().replace(/[^a-z0-9]/g,'');return p.code.toLowerCase().replace(/[^a-z0-9]/g,'')===detected||p.display_name.toLowerCase().replace(/[^a-z0-9]/g,'')===detected;})&&!context.program&&<p role="alert" className="mt-3 text-sm text-amber-700">{metadata.degree_name.value} is not configured in this institution’s academic catalog. An institution administrator must add the degree and its department in Institution Management before you can continue.</p>}
      </section>}
      {['bank','papers'].includes(module)&&(!selectedSubject||changingContext)&&<section id="qpg-work-subject-picker" className="erp-card mb-4"><h2>{selectedSubject?'Change subject':'Choose your subject'}</h2><p className="mb-4 mt-1 text-sm text-slate-500">Select the subject for your questions and paper.</p>{selectedSubject&&changingContext&&<Button variant="ghost" className="mb-3" onClick={()=>setChangingContext(false)}>Cancel subject change</Button>}<Button type="button" variant="outline" className="mb-4" onClick={()=>{setQpgLegacy(v=>!v);setQpgAcademic(emptyAcademic);changeQpgContext('program','');}}>{qpgLegacy?'Use full academic selection':'Open existing subjects'}</Button><fieldset className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {!qpgLegacy&&<>
        <Select title="Institution" value={qpgAcademic.institution_name} onChange={v=>changeQpgAcademic('institution_name',v)} items={[...new Set((options.academic_contexts||[]).map(c=>c.institution_name).concat([institution,'JNTUH']).filter(Boolean))].map(value=>({value,title:value}))}/>
        <Select title="Education level" disabled={!qpgAcademic.institution_name} value={qpgAcademic.education_level} onChange={v=>changeQpgAcademic('education_level',v)} items={[...new Set((options.academic_contexts||[]).filter(c=>c.institution_name===qpgAcademic.institution_name).map(c=>c.education_level).filter(Boolean))].map(value=>({value,title:value}))}/>
        <Select title="Batch" disabled={!qpgAcademic.education_level} value={qpgAcademic.batch_name} onChange={v=>changeQpgAcademic('batch_name',v)} items={[...new Set((options.academic_contexts||[]).filter(c=>c.institution_name===qpgAcademic.institution_name&&c.education_level===qpgAcademic.education_level).map(c=>c.batch_name).filter(Boolean))].map(value=>({value,title:value}))}/>
        </>}
        <Select title={qpgLegacy?'Program':'Degree'} disabled={!qpgLegacy&&!qpgAcademic.batch_name} value={qpgContext.program} onChange={v=>changeQpgContext('program',v)} items={options.programs.filter(p=>qpgLegacy||(options.academic_contexts||[]).some(c=>c.institution_name===qpgAcademic.institution_name&&c.education_level===qpgAcademic.education_level&&c.batch_name===qpgAcademic.batch_name&&c.program_code===p.code)).map(p=>({value:p.code,title:p.display_name}))}/>
        <Select title={qpgLegacy?'Branch':'Department'} value={qpgContext.branch} disabled={!qpgProgram} onChange={v=>changeQpgContext('branch',v)} items={(qpgProgram?.departments||[]).filter(d=>qpgLegacy||(options.academic_contexts||[]).some(c=>c.institution_name===qpgAcademic.institution_name&&c.education_level===qpgAcademic.education_level&&c.batch_name===qpgAcademic.batch_name&&c.program_code===qpgContext.program&&c.branch_code===d.code)).map(d=>({value:d.code,title:d.display_name}))}/>
        {!qpgLegacy&&<Select title="Branch" disabled={!qpgContext.branch} value={qpgAcademic.specialization_name} onChange={v=>changeQpgAcademic('specialization_name',v)} items={[...new Set((options.academic_contexts||[]).filter(c=>c.institution_name===qpgAcademic.institution_name&&c.education_level===qpgAcademic.education_level&&c.batch_name===qpgAcademic.batch_name&&c.program_code===qpgContext.program&&c.branch_code===qpgContext.branch).map(c=>c.specialization_name).filter(Boolean))].map(value=>({value,title:value}))}/>}
        <Select title="Year" value={qpgContext.year} disabled={qpgLegacy?!qpgContext.branch:!qpgAcademic.specialization_name} onChange={v=>changeQpgContext('year',v)} items={Array.from({length:qpgProgram?.duration_years||0},(_,i)=>({value:String(i+1),title:`Year ${i+1}`}))}/>
        <Select title="Semester" value={qpgContext.semester} disabled={!qpgContext.year} onChange={v=>changeQpgContext('semester',v)} items={qpgContext.year?[1,2].map(n=>({value:String(Number(qpgContext.year)*2-2+n),title:`Semester ${Number(qpgContext.year)*2-2+n}`})):[]}/>
        <Select key={[qpgAcademic.institution_name,qpgAcademic.education_level,qpgAcademic.batch_name,qpgContext.program,qpgContext.branch,qpgContext.year,qpgContext.semester].join('|')} title="Subject" value={qpgContext.semester?qpgContext.subject:''} disabled={!qpgContext.semester} onChange={v=>changeQpgContext('subject',v)} items={(qpgContext.semester?qpgSubjects:[]).map(s=>({value:s.id,title:`${s.code} · ${s.name}${qpgLegacy&&s.institution_name?` · ${s.institution_name} · ${s.batch_name} · ${s.specialization_name}`:""}`}))}/>
      </fieldset>{selectedSubject&&changingContext&&<Button className="mt-4" onClick={()=>setChangingContext(false)}>Use this subject</Button>}{!qpgLegacy&&!(options.academic_contexts||[]).some(c=>c.institution_name)&&<p className="mt-3 text-sm">Save a subject with its academic details in Subject Master to make it available here. Use Open existing subjects for older records.</p>}{qpgContext.semester&&!qpgSubjects.length&&<p className="mt-3 text-sm">No subjects are available in this academic context yet.</p>}</section>}
      {tab==='academic'&&curriculum.length>0&&<section className="erp-card mt-4"><h2>3. Choose a subject</h2><p className="mt-1 text-sm text-slate-500">Continue to Syllabus Master to check its content. Nothing is published at this step.</p>{!context.program||!context.branch||!context.year||!context.semester?<p className="my-3 text-sm">Select Institution → Education level → Batch → Degree → Department → Branch → Year → Semester above to see the matching courses.</p>:<>
        <label className="my-3 grid gap-2 text-sm">Curriculum subject<select className="rounded-lg border bg-white p-3 dark:bg-slate-900" value={courseCode} disabled={extracting||creatingCourse} onChange={e=>{setCourseCode(e.target.value);}}><option value="">Choose subject</option>{curriculum.filter(c=>(!c.year_number||c.year_number===Number(context.year))&&(!c.semester_number||c.semester_number===Number(context.semester))).map((c,i)=><option key={`${c.code}:${i}`} value={c.extraction_id||c.code}>{c.code||'Code not provided'} · {c.name}{c.lecture_hours!=null||c.tutorial_hours!=null||c.practical_hours!=null||c.credits!=null?` · L/T/P ${c.lecture_hours??'–'}/${c.tutorial_hours??'–'}/${c.practical_hours??'–'} · ${c.credits??'–'} credits`:''}{!c.year_number||!c.semester_number?' · Confirm year/semester':''}</option>)}</select></label>
        {courseCode&&curriculum.find(c=>(c.extraction_id||c.code)===courseCode)?.code_missing&&<label className="my-3 grid gap-2 text-sm">Course code required before saving<input aria-label="Missing course code" className={inputClass} maxLength={80} placeholder="Enter the institution-approved course code" onChange={e=>setCurriculum(old=>old.map(c=>(c.extraction_id||c.code)===courseCode?{...c,code:e.target.value}:c))}/></label>}
        {courseCode&&curriculum.some(c=>(c.extraction_id||c.code)===courseCode&&(!c.year_number||c.year_number===Number(context.year))&&(!c.semester_number||c.semester_number===Number(context.semester)))&&<><Button disabled={!options.can_setup||(!legacyContext&&!academicReady)||extracting||creatingCourse||!curriculum.find(c=>(c.extraction_id||c.code)===courseCode)?.code.trim()} onClick={()=>void (async()=>{setCreatingCourse(true);setError('');try{const course=curriculum.find(c=>(c.extraction_id||c.code)===courseCode)!;const subject=await qpgApi.save<Subject>('subjects/from-curriculum',{code:course.code,name:course.name,...academic,program_code:context.program,branch_code:context.branch,year_number:Number(context.year),semester_number:Number(context.semester),lecture_hours:course.lecture_hours,tutorial_hours:course.tutorial_hours,practical_hours:course.practical_hours,credits:course.credits});setOptions(old=>old?{...old,academic_contexts:[...(old.academic_contexts||[]),{...academic,program_code:context.program,branch_code:context.branch}]}:old);setSubjects(old=>[...old.filter(x=>x.id!==subject.id),subject]);setContext(old=>({...old,subject:subject.id}));setReviewCourse(course);setReviewSubject(subject.id);setTab('syllabus');}catch(e){setError(collegeError(e));}finally{setCreatingCourse(false);}})()}>{creatingCourse?'Preparing syllabus review…':'Continue to Syllabus Master'}</Button>{!options.can_setup&&<p className="mt-2 text-sm">An administrator must create this subject context.</p>}</>}
      </>}</section>}
      {tab==='syllabus'&&syllabusSubject&&!(reviewCourse&&reviewSubject===syllabusSubject.id)&&<QpgSyllabusPanel key={syllabusSubject.id+syllabusRefresh} subject={syllabusSubject} onChange={()=>{setNotice('');setRefresh(v=>v+1);}}/>}
      {tab==='templates'&&<QpgTemplatesPanel/>}
      {tab==='reports'&&<QpgReportsPanel key={context.subject} subject={syllabusSubject}/>}
      {module==='bank'&&['imports','generate','intelligence'].includes(tab)&&<Button className="qpg-back-to-bank mb-4" variant="ghost" onClick={()=>setTab('bank')}><ArrowLeft size={16} aria-hidden="true"/>Back to Questions</Button>}
      {tab==='imports'&&<section className="erp-card qpg-bank-import" aria-label="Import questions"><div className="qpg-import-header"><span className="qpg-import-icon"><Upload size={22} aria-hidden="true"/></span><div><h2>Upload Question Bank</h2><p>Import questions into {selectedSubject?.name||'your subject'}.</p></div></div><ol className="qpg-import-flow">{[['1','Upload','Choose your question document'],['2','Check & edit','Correct any extracted details'],['3','Save to bank','Questions are ready to use']].map(([number,title,description])=><li key={number}><span className="qpg-import-step-number">{number}</span><div><h3>{title}</h3><p>{description}</p></div></li>)}</ol><div className="qpg-import-upload"><span className="qpg-import-icon"><Upload size={25} aria-hidden="true"/></span><h3>Choose your question document</h3><p>Excel, CSV, PDF or DOCX · Up to 10 MB</p><span className="qpg-import-limit">Up to 500 questions per import</span><Button disabled={!selectedSubject||!options.can_write} onClick={()=>setDialog('imports')}>Choose file</Button>{!selectedSubject&&<p className="text-xs text-amber-700">Select a subject first.</p>}{selectedSubject&&!options.can_write&&<p className="text-xs text-slate-500">Importing requires editing access.</p>}</div><p className="mt-3 text-xs text-slate-500">Check the extracted questions before saving. You can edit them later in your bank.</p></section>}
      {tab==='papers'&&selectedSubject&&<QpgPaperPanel key={selectedSubject.id+paperView} subject={selectedSubject} libraryRequest={paperLibraryRequest} view={paperView} onCreate={()=>setPaperView('create')} onPatterns={()=>setTab('blueprint')} onQuestionReview={ids=>{setReviewQuestionIds(ids);setReturnToPaper(true);setTab('bank');}} onReview={()=>{setPaperView('review');setTab('papers');}}/>}
      {tab==='papers'&&!qpgContext.subject&&!changingContext&&<p>Select a subject above to assemble a paper.</p>}
      {tab==='blueprint'&&selectedSubject&&<QpgBlueprintPanel key={selectedSubject.id} subject={selectedSubject} onSyllabus={()=>setTab("syllabus")}/>}
      {tab==='blueprint'&&!qpgContext.subject&&<p>Select a subject to configure its paper pattern.</p>}
      {tab==='generate'&&selectedSubject&&<QpgGeneratePanel key={selectedSubject.id} subject={selectedSubject} canWrite={options.can_write} onAccepted={()=>setRefresh(v=>v+1)} onReview={()=>setTab('bank')}/>}
      {tab==='generate'&&!selectedSubject&&<p>Select a subject to generate questions.</p>}
      {tab==='intelligence'&&selectedSubject&&<QpgRepetitionPanel key={selectedSubject.id} subject={selectedSubject}/>}
      {tab==='bank'&&returnToPaper&&<div className="mb-4 rounded-xl border border-indigo-200 p-4"><p className="mb-3 text-sm">Saved questions are ready. Return to your paper to assemble them.</p><Button onClick={()=>{setPaperView('create');setTab('papers');setReturnToPaper(false);}}>Back to paper draft</Button></div>}
      {['bank','drafts'].includes(tab)&&<section className="erp-card qpg-question-library"><div className="qpg-library-toolbar"><div><p className="qpg-library-eyebrow">YOUR QUESTION COLLECTION</p><h2>{tab==='drafts'?'Draft Questions':'Questions'}</h2><p className="qpg-library-description">Manual, AI-generated and imported questions in one place. Open any active question to edit its content.</p></div>{options.can_write&&<div className="qpg-library-actions"><Button variant="outline" disabled={!qpgContext.subject} onClick={()=>setTab('imports')}><Upload size={16} aria-hidden="true"/>Upload Question Bank</Button><Button variant="outline" disabled={!qpgContext.subject} onClick={()=>setTab('generate')}><Sparkles size={16} aria-hidden="true"/>Generate with AI</Button><Button disabled={!qpgContext.subject} onClick={()=>{setSelected(null);setDialog('question');}}><Plus size={16} aria-hidden="true"/>Add Question</Button></div>}</div>
        {tab==='drafts'&&<p className="mt-2 text-sm text-slate-500">Edit your saved questions at any time.</p>}
        {!qpgContext.subject?<p>Select a Question Bank subject above to view questions.</p>:<>
          <div className="my-5 max-w-xl"><Field><FieldLabel htmlFor="qpg-search">Search questions</FieldLabel><input id="qpg-search" className={inputClass} value={filters.q} onChange={e=>filter('q',e.target.value)} placeholder={tab==='drafts'?'Search draft questions':'Search question text'}/></Field></div>
          <details className="mb-5 rounded-xl border border-slate-200 p-4"><summary className="cursor-pointer text-sm font-medium">Filters{activeFilterCount>0?` · ${activeFilterCount} active`: ""}</summary><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Select title="Unit filter" value={filters.unit_id} onChange={v=>filter('unit_id',v)} items={units.map(x=>({value:x.id,title:x.code+' · '+x.title}))}/>
          <Select title="Topic filter" value={filters.topic_id} onChange={v=>filter('topic_id',v)} items={topics.filter(x=>!filters.unit_id||x.unit_id===filters.unit_id).map(x=>({value:x.id,title:x.title}))}/>
          <Select title="Bloom filter" value={filters.bloom_level} onChange={v=>filter('bloom_level',v)} items={blooms}/>
          <Select title="Difficulty filter" value={filters.difficulty} onChange={v=>filter('difficulty',v)} items={difficulties}/>
          <Select title="Question type filter" value={filters.question_type} onChange={v=>filter('question_type',v)} items={questionTypes}/>
          {tab!=='drafts'&&<Select title="Availability" value={filters.status} onChange={v=>filter('status',v)} items={[{value:'APPROVED',title:'Ready to use'},{value:'ARCHIVED',title:'Archived'}]}/>}</div>{activeFilterCount>0&&<Button className="mt-3" variant="ghost" onClick={clearFilters}>Clear filters</Button>}</details>
          {bankLoading?<p role="status">Loading questions…</p>:<>{questions.length>0&&<div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{['Question','Type','Marks','Difficulty','Source',...(options.can_setup&&studentSharingAvailable?['Student access']:[]),'Actions'].map(h=><th key={h} className="whitespace-nowrap border-b p-3">{h}</th>)}</tr></thead><tbody>{questions.map(question=><tr key={question.id} className="border-b border-slate-100">
            <td className="min-w-60 max-w-sm p-3"><button className="text-left font-medium text-indigo-600 hover:underline" onClick={()=>{setSelected(question);setDialog('details');}}>{question.question_text}</button><p className="mt-1 text-xs text-slate-500">{[cos.find(x=>x.id===question.co_id)?.code,units.find(x=>x.id===question.unit_id)?.code,question.bloom_level,`Version ${question.version}`].filter(Boolean).join(' · ')}</p></td>
            {[label(question.question_type),question.marks,label(question.difficulty)].map((value,i)=><td key={i} className="p-3">{value}</td>)}
            <td className="p-3">{question.source_type==='AI_GENERATED'?'AI':label(question.source_type)}</td>{options.can_setup&&studentSharingAvailable&&<td className="p-3"><div className="flex items-center gap-2"><span className={`rounded-full px-2 py-1 text-xs ${studentReleases[question.id]?'bg-emerald-100 text-emerald-800':'bg-slate-100 text-slate-600'}`}>{studentReleases[question.id]?'Released':'Private'}</span><Button size="sm" variant="outline" disabled={releaseBusy===question.id||(!studentReleases[question.id]&&question.status!=='APPROVED')} title={!studentReleases[question.id]&&question.status!=='APPROVED'?'Faculty approval is required before release.':undefined} onClick={()=>void toggleStudentRelease(question)}>{releaseBusy===question.id?'Saving…':studentReleases[question.id]?'Remove':'Release'}</Button></div></td>}<td className="p-3"><div className="flex gap-2">{options.can_write&&question.status!=='ARCHIVED'&&<><Button size="sm" variant="outline" onClick={()=>{setSelected(question);setDialog('question');}}>Edit</Button><Button size="sm" variant="ghost" onClick={()=>void archive(question)}>Archive</Button></>}</div></td>
          </tr>)}</tbody></table></div>}{!questions.length&&!error&&<div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-10 text-center dark:border-slate-700 dark:bg-slate-900"><h3 className="font-semibold">{activeFilterCount?'No matching questions':tab==='drafts'?'No draft questions yet':'No questions yet'}</h3><p className="mt-2 text-sm text-slate-500">{activeFilterCount?'Try another search or clear your filters.':tab==='drafts'?'Save a question as a draft to continue working on it here.':'Add your first question to get started.'}</p>{activeFilterCount>0?<Button className="mt-4" variant="outline" onClick={clearFilters}>Clear filters</Button>:options.can_write&&<Button className="mt-4" variant="outline" onClick={()=>{setSelected(null);setDialog('question');}}><Plus size={16}/>Add Question</Button>}</div>}{total>0&&<div className="mt-4 flex items-center justify-between"><p className="text-sm text-slate-500">{total} questions</p><div className="flex gap-2"><Button variant="outline" disabled={offset===0} onClick={()=>setOffset(v=>Math.max(0,v-50))}>Previous</Button><Button variant="outline" disabled={offset+50>=total} onClick={()=>setOffset(v=>v+50)}>Next</Button></div></div>}</>}
        </>}
      </section>}
      {dialog==='imports'&&selectedSubject&&<QpgImportPanel subject={selectedSubject} cos={cos} units={units} topics={topics} onClose={()=>{setDialog(null);setRefresh(v=>v+1);}} onViewQuestions={()=>{setDialog(null);setTab('bank');setRefresh(v=>v+1);}}/>}
      {dialog==='question'&&selectedSubject&&<QuestionForm subject={selectedSubject} question={selected} cos={cos} units={units} topics={topics} onClose={()=>setDialog(null)} onSaved={saved}/>}
      {dialog==='details'&&selected&&<QuestionDetails question={selected} cos={cos} units={units} topics={topics} canWrite={options.can_write} onClose={()=>setDialog(null)}/>}
      {dialog==='degree'&&options.can_setup&&<SetupForm title="Add Degree" onClose={()=>setDialog(null)} onSubmit={async data=>{
        const code=data.code.trim();if(options.programs.some(p=>p.code.toLowerCase()===code.toLowerCase()))throw new Error('This degree code already exists. Select the existing degree.');
        await collegeApi.save('academic-catalog/programs',{code,display_name:data.name.trim(),duration_years:Number(data.duration)});
        setOptions(await qpgApi.get<Options>('academic-options'));changeContext('program',code);setDialog(null);
      }}>
        <p className="text-sm text-slate-500">Save a degree in your institution’s academic catalog, then add its department.</p>
        <label className="grid gap-2 text-sm">Degree code<input name="code" className={inputClass} required maxLength={40} placeholder="e.g. BE"/></label>
        <label className="grid gap-2 text-sm">Degree name<input name="name" className={inputClass} required maxLength={120} defaultValue={metadata?.degree_name?.value||''} placeholder="e.g. Bachelor of Engineering"/></label>
        <label className="grid gap-2 text-sm">Duration (years)<input name="duration" className={inputClass} required type="number" min="1" max="8"/></label>
      </SetupForm>}
      {dialog==='department'&&options.can_setup&&program&&<SetupForm title="Add Department" onClose={()=>setDialog(null)} onSubmit={async data=>{
        const code=data.code.trim().replace(/[^A-Za-z0-9_-]/g,'').toUpperCase();if(!code)throw new Error('Enter a department code using letters, numbers, hyphens or underscores.');
        if(program.departments.some(d=>d.code.toUpperCase()===code))throw new Error('This department is already available. Select it from the dropdown.');
        await collegeApi.save('academic-catalog/departments',{program_code:program.code,code,display_name:data.name.trim()});
        setOptions(await qpgApi.get<Options>('academic-options'));changeContext('branch',code);setDialog(null);
      }}>
        <p className="text-sm text-slate-500">Add a department to {program.display_name}. The saved department will be available in the subject selectors.</p>
        <label className="grid gap-2 text-sm">Department code<input name="code" className={inputClass} required maxLength={40} placeholder="e.g. CE"/></label>
        <label className="grid gap-2 text-sm">Department name<input name="name" className={inputClass} required maxLength={120} defaultValue={metadata?.department_name?.value||''}/></label>
      </SetupForm>}
      {dialog==='subject'&&<SetupForm title="Add Existing Subject" onClose={()=>setDialog(null)} onSubmit={async data=>{await qpgApi.save('subjects',{erp_subject_id:data.subject,...academic,program_code:context.program,branch_code:context.branch,year_number:Number(context.year),semester_number:Number(context.semester)});saved();}}>
        <label className="grid gap-2 text-sm">Existing subject<select className={inputClass} name="subject" required><option value="">Select subject</option>{options.erp_subjects.filter(s=>!s.department_code||s.department_code===context.branch).map(s=><option key={s.id} value={s.id}>{s.code} · {s.name}</option>)}</select></label><p className="text-sm text-slate-500">Create new subject identities in Institution Management. This links an existing subject to the selected year and semester.</p>
      </SetupForm>}
      {dialog&&['cos','units','topics'].includes(dialog)&&<SetupForm title={`Add ${dialog==='cos'?'course outcome':dialog==='units'?'unit':'topic'}`} onClose={()=>setDialog(null)} onSubmit={async data=>{const path=dialog==='topics'?`units/${data.unit}/topics`:`subjects/${qpgContext.subject}/${dialog}`;await qpgApi.save(path,{code:data.code,title:data.title});saved();}}>
        {dialog==='topics'&&<label className="grid gap-2 text-sm">Unit<select name="unit" className={inputClass} required><option value="">Select unit</option>{units.map(u=><option key={u.id} value={u.id}>{u.code} · {u.title}</option>)}</select></label>}
        <label className="grid gap-2 text-sm">Code<input name="code" className={inputClass} required maxLength={80}/></label><label className="grid gap-2 text-sm">Title / description<textarea name="title" className={inputClass} required maxLength={500}/></label>
      </SetupForm>}
    </>}
  </main>;
}

function Select({title,value,onChange,items,disabled=false,onAdd}:{title:string;value:string;onChange:(v:string)=>void;items:(string|{value:string;title:string})[];disabled?:boolean;onAdd?:()=>void}){
  return <label className="grid min-w-0 gap-2 text-sm">{title}<select aria-label={title} className={inputClass} value={value} disabled={disabled} onChange={e=>{if(e.target.value==='__add__'){onAdd?.();return;}onChange(e.target.value);}}><option value="">Select / all</option>{items.map(item=>{const v=typeof item==='string'?item:item.value;return <option key={v} value={v}>{typeof item==='string'?label(item):item.title}</option>;})}{onAdd&&<option value="__add__">Add {title.toLowerCase()}…</option>}</select></label>;
}


function SetupForm({title,onClose,onSubmit,children}:{title:string;onClose:()=>void;onSubmit:(data:Record<string,string>)=>Promise<void>;children:ReactNode}){
  const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  async function save(e:FormEvent<HTMLFormElement>){e.preventDefault();setBusy(true);setError('');try{await onSubmit(Object.fromEntries(new FormData(e.currentTarget)) as Record<string,string>);}catch(e){setError(collegeError(e));}finally{setBusy(false);}}
  return <Dialog title={title} onClose={onClose}><form className="grid gap-4" onSubmit={save}>{error&&<p role="alert" className="text-red-700">{error}</p>}{children}<Button disabled={busy} type="submit">{busy?'Saving…':'Save'}</Button></form></Dialog>;
}

function QuestionForm({subject,question,cos,units,topics,onClose,onSaved}:{subject:Subject;question:Question|null;cos:SyllabusItem[];units:SyllabusItem[];topics:SyllabusItem[];onClose:()=>void;onSaved:()=>void}){
  const [type,setType]=useState(question?.question_type||'SHORT_ANSWER');const [unit,setUnit]=useState(question?.unit_id||'');const [topic,setTopic]=useState(question?.topic_id||'');
  const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  async function save(e:FormEvent<HTMLFormElement>){
    e.preventDefault();setError('');const data=Object.fromEntries(new FormData(e.currentTarget)) as Record<string,string>;
    const body={subject_id:subject.id,question_text:data.question_text.trim(),question_type:type,marks:Number(data.marks),co_id:data.co_id||null,unit_id:unit||null,topic_id:topic||null,bloom_level:data.bloom_level,difficulty:data.difficulty,answer:data.answer,options:type==='MCQ'?data.options.split('\n').map(s=>s.trim()).filter(Boolean):[],source_type:question?.source_type||'MANUAL',source_reference:data.source_reference,change_reason:data.change_reason||'',...(question?{expected_version:question.version}:{})};
    if(body.question_text.length<3){setError('Enter a question of at least three characters.');return;}
    setBusy(true);try{await qpgApi.save(question?`questions/${question.id}`:'questions',body,Boolean(question));onSaved();}catch(e){setError(collegeError(e));}finally{setBusy(false);}
  }
  return <Dialog title={question?'Edit Question':'Add Question'} onClose={onClose}><form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
    <p className="text-sm text-slate-500 sm:col-span-2">{subject.code} · {subject.name}{question?` · Version ${question.version}; edits are saved as a new version.`:' · Saved questions are ready to use.'}</p>
    {error&&<p role="alert" className="text-red-700 sm:col-span-2">{error}</p>}
    <label className="grid gap-2 text-sm sm:col-span-2">Question Text<textarea name="question_text" className={`${inputClass} min-h-28`} required minLength={3} maxLength={20000} defaultValue={question?.question_text}/></label>
    <Select title="Question Type" value={type} onChange={setType} items={questionTypes}/>
    <label className="grid gap-2 text-sm">Marks<input name="marks" className={inputClass} type="number" min="0.01" max="1000" step="0.01" required defaultValue={question?.marks||2}/></label>
    <label className="grid gap-2 text-sm">Course Outcome (CO)<select name="co_id" className={inputClass} defaultValue={question?.co_id||''}><option value="">Not assigned</option>{cos.map(c=><option key={c.id} value={c.id}>{c.code} · {c.title}</option>)}</select></label>
    <Select title="Unit" value={unit} onChange={v=>{setUnit(v);setTopic('');}} items={units.map(u=>({value:u.id,title:u.code+' · '+u.title}))}/>
    <Select title="Topic" value={topic} disabled={!unit} onChange={setTopic} items={topics.filter(t=>t.unit_id===unit).map(t=>({value:t.id,title:t.title}))}/>
    <label className="grid gap-2 text-sm">Bloom level<select className={inputClass} name="bloom_level" required defaultValue={question?.bloom_level||'K1'}>{blooms.map(b=><option key={b} value={b}>{label(b)}</option>)}</select></label>
    <label className="grid gap-2 text-sm">Difficulty<select className={inputClass} name="difficulty" required defaultValue={question?.difficulty||'MEDIUM'}>{difficulties.map(d=><option key={d} value={d}>{label(d)}</option>)}</select></label>
    <label className="grid gap-2 text-sm">Source Type<select className={inputClass} disabled value={question?.source_type||'MANUAL'}>{sourceTypes.map(s=><option key={s} value={s}>{label(s)}</option>)}</select></label>
    {type==='MCQ'&&<label className="grid gap-2 text-sm sm:col-span-2">MCQ options — one per line<textarea name="options" required className={inputClass} defaultValue={question?.options.join('\n')||''}/></label>}
    <label className="grid gap-2 text-sm sm:col-span-2">Answer / Solution<textarea name="answer" className={`${inputClass} min-h-24`} maxLength={30000} defaultValue={question?.answer||''}/></label>
    <label className="grid gap-2 text-sm sm:col-span-2">Source Reference<input name="source_reference" className={inputClass} maxLength={1000} defaultValue={question?.source_reference||''}/></label>
    {question&&<label className="grid gap-2 text-sm sm:col-span-2">Change reason<input name="change_reason" className={inputClass} maxLength={1000}/></label>}
    <div className="flex justify-end gap-2 sm:col-span-2"><Button variant="outline" type="button" onClick={onClose}>Cancel</Button><Button type="submit" disabled={busy||!type}>{busy?'Saving…':question?'Save changes':'Save Question'}</Button></div>
  </form></Dialog>;
}

function QuestionDetails({question,cos,units,topics,onClose,canWrite}:{question:Question;cos:SyllabusItem[];units:SyllabusItem[];topics:SyllabusItem[];onClose:()=>void;canWrite:boolean}){
  const [current,setCurrent]=useState(question);const [history,setHistory]=useState<QuestionVersion[]>([]);const [error,setError]=useState('');
  useEffect(()=>{const c=new AbortController();Promise.all([qpgApi.get<Question>(`questions/${question.id}`,c.signal),qpgApi.get<{items:QuestionVersion[]}>(`questions/${question.id}/versions`,c.signal)]).then(([q,h])=>{setCurrent(q);setHistory(h.items);}).catch(e=>{if(!c.signal.aborted)setError(collegeError(e));});return ()=>c.abort();},[question.id]);
  return <Dialog title="Question Details" onClose={onClose}>{error&&<p role="alert">{error}</p>}<p className="mb-4 whitespace-pre-wrap text-lg font-medium">{current.question_text}</p><dl className="grid gap-3 text-sm sm:grid-cols-2">{Object.entries({Type:label(current.question_type),Marks:current.marks,CO:cos.find(c=>c.id===current.co_id)?.code||'—',Unit:units.find(u=>u.id===current.unit_id)?.title||'—',Topic:topics.find(t=>t.id===current.topic_id)?.title||'—',Bloom:current.bloom_level,Difficulty:label(current.difficulty),Status:current.status==='APPROVED'?'Ready to use':label(current.status),Source:label(current.source_type),'Source reference':canWrite?(current.source_reference||'—'):'Restricted',Version:current.version,'Updated by':current.updated_by,'Updated at':new Date(current.updated_at).toLocaleString()}).map(([k,v])=><div key={k}><dt className="text-slate-500">{k}</dt><dd className="break-words">{v}</dd></div>)}</dl>{current.options.length>0&&<ol className="my-4 list-inside list-decimal">{current.options.map((o,i)=><li key={i}>{o}</li>)}</ol>}<h3 className="mb-2 mt-5 font-semibold">Answer / Solution</h3><p className="whitespace-pre-wrap">{canWrite?(current.answer||'Not provided'):'Answer access requires academic write permission.'}</p><details className="my-4 rounded-xl border p-3"><summary className="cursor-pointer font-semibold">Advanced: similarity and usage</summary><QpgQuestionIntelligencePanel question={current} canWrite={canWrite}/></details><h3 className="mb-2 mt-6 font-semibold">Version history</h3>{history.map(v=><details key={v.id} className="mb-3 rounded-xl border border-slate-200 p-3"><summary className="cursor-pointer text-sm">Version {v.version} · {new Date(v.created_at).toLocaleString()} · {canWrite?(v.change_reason||'Question saved'):'Question saved'}</summary><p className="mt-2 text-xs text-slate-500">Actor: {canWrite?v.actor:'Restricted'}</p><p className="mt-2 whitespace-pre-wrap">{v.content.question_text}</p><p className="text-sm">{v.content.marks} marks · {v.content.bloom_level} · {v.content.status==='APPROVED'?'Ready to use':label(v.content.status)}</p><pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap break-words text-xs">{canWrite?JSON.stringify(v.content,null,2):'Answer details are restricted.'}</pre></details>)}</Dialog>;
}

function AcademicChoice({title,value,items,disabled,onChange}:{title:string;value:string;items:string[];disabled?:boolean;onChange:(value:string)=>void}){
  const [adding,setAdding]=useState(false);
  const choices=[...new Set([...items,value].filter(Boolean))];
  return <label className="grid gap-2 text-sm">{title}<select aria-label={title} className={inputClass} disabled={disabled} value={adding?'__new__':value} onChange={e=>{if(e.target.value==='__new__'){setAdding(true);return;}setAdding(false);onChange(e.target.value);}}><option value="">Select {title.toLowerCase()}</option>{choices.map(item=><option key={item} value={item}>{item}</option>)}<option value="__new__">Add {title.toLowerCase()}…</option></select>{adding&&<input aria-label={`New ${title.toLowerCase()}`} className={inputClass} maxLength={200} placeholder={`Enter ${title.toLowerCase()}`} value={value} onChange={e=>onChange(e.target.value)} onBlur={()=>{if(value.trim())setAdding(false);}}/>}</label>;
}
