import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {BookOpen,CheckCircle2,RefreshCw,TrendingUp,X} from 'lucide-react';
import {UserFacingError} from '@/lib/userFacingError';
import {collegeApi,collegeError} from '@/api/collegeApi';
import {endpointMissing,type FullBundle} from './assessmentClient';
import {displayName,formatPlacementDateTime} from './placementDisplay';
import {driveHistory} from './assessmentIntelligenceData';

type Lesson={session_id?:string;day?:number;title?:string;focus?:string;objective?:string;activities?:string[];scheduled_at?:string;schedule_status?:string;stage?:string;teaching_completed?:boolean;lesson_completed_at?:string;validation_status?:string;weak_sub_skills?:string[];validated_at?:string};
type Skill={skill:string;state:string;training_stage:string;evidence_note?:string;source?:string;resume_evidence?:string;last_assessed_at?:string;drive_ready?:boolean;strong_evidence_count?:number;independent_context_count?:number;objectives?:{task_id:string;question?:string;answer?:string;status:string;feedback?:{feedback?:string;gaps?:string[]}}[]};
type Plan={id:string;drive_id?:string;company_name?:string;role_title?:string;target_date?:string;goal?:string;summary?:string;lessons:Lesson[];skills_progress?:{score?:number;skills:Skill[]}};
type Journey={drive_id:string;progress_tracking:Record<string,unknown>;weekly_metrics?:Record<string,unknown>;daily_schedule?:Record<string,unknown>[]};
type ProgressData={journey?:Journey|null;student_id:string;drive_id?:string;plans:Plan[];cycles:{id:string;drive_id?:string;status?:string;call_completed_at?:string;validation_completed_at?:string}[]};
function ProgressFacts({values}:{values:Record<string,unknown>}){
 return <dl className="ai-progress-facts">{Object.entries(values).filter(([key,value])=>value!=null&&key!=="id"&&!key.endsWith("_id")).map(([key,value])=><div key={key}><dt>{displayName(key)}</dt><dd>{Array.isArray(value)?value.length?value.map((item,index)=><div key={index}>{item&&typeof item==='object'?<ProgressFacts values={item as Record<string,unknown>}/>:String(item)}</div>):'No records yet':typeof value==='object'?<ProgressFacts values={value as Record<string,unknown>}/>:typeof value==='boolean'?value?'Yes':'No':String(value)}</dd></div>)}</dl>;
}
const label=(value?:string)=>value?displayName(value.replaceAll('_',' ')):'Not started';
const skillLabel=(value:string)=>({unassessed:'Needs evaluation',strong_evidence:'Demonstrated in diagnostic',some_evidence:'Partly demonstrated',weak_evidence:'Needs improvement',validated:'Validated',drive_ready:'Drive Ready',stale_evidence:'Needs review'} as Record<string,string>)[value]||label(value);

export default function AssessmentCoach({bundle,driveId,onClose}:{bundle:FullBundle;driveId:string;onClose:()=>void}){
 const [result,setResult]=useState<{key:string;data?:ProgressData;error?:string}>(),[version,setVersion]=useState(0);
 const dialog=useRef<HTMLElement>(null),restoreFocus=useRef(document.activeElement as HTMLElement|null);
 const drive=driveHistory(bundle).find(row=>row.drive.drive_id===driveId)?.drive;
 const path=`students/${encodeURIComponent(bundle.student.id)}/coach?drive_id=${encodeURIComponent(driveId)}`;
 const key=`${path}:${version}`,loading=result?.key!==key,data=result?.key===key?result.data:null,error=result?.key===key?result.error:undefined;
 useEffect(()=>{
  const controller=new AbortController();
  // Progress changes during lessons: bypass the indefinite assessment cache.
  void collegeApi.get<ProgressData>(path,controller.signal).then(value=>{
   if(controller.signal.aborted)return;
   if(value.student_id!==bundle.student.id||value.drive_id!==driveId||value.plans.some(plan=>plan.drive_id!==driveId)||value.cycles.some(cycle=>cycle.drive_id!==driveId)||(value.journey&&value.journey.drive_id!==driveId))throw new UserFacingError('The progress response does not match this student and drive.');
   setResult({key,data:value});
  }).catch(reason=>{if(!controller.signal.aborted)setResult({key,error:endpointMissing(reason)?'Progress is not available on this server yet.':collegeError(reason)})});
  return()=>controller.abort();
 },[path,bundle.student.id,driveId,key]);
 useEffect(()=>{
  const focus=restoreFocus.current,previous=document.body.style.overflow;document.body.style.overflow='hidden';
  const keydown=(event:KeyboardEvent)=>{
   if(event.key==='Escape'){event.stopPropagation();event.preventDefault();onClose()}
   if(event.key==='Tab'){
    const elements=dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],summary,[tabindex="0"]');
    if(!elements?.length)return;const first=elements[0],last=elements[elements.length-1];
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
   }
  };
  window.addEventListener('keydown',keydown,true);
  return()=>{window.removeEventListener('keydown',keydown,true);document.body.style.overflow=previous;focus?.focus()};
 },[onClose]);
 const lessons=data?.plans.flatMap(plan=>plan.lessons)||[],completed=lessons.filter(lesson=>lesson.stage==='completed').length;
 return createPortal(<div className="ai-coach-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)onClose()}}>
  <section ref={dialog} className="ai-coach-dialog" role="dialog" aria-modal="true" aria-labelledby="ai-progress-title">
   <header><div><span className="ai-eyebrow">STUDENT PROGRESS</span><h2 id="ai-progress-title"><TrendingUp size={21}/>Progress · {bundle.student.full_name}</h2><p>{drive?.company_name} · {drive?.role_title}</p><p>Saved learning progress and evidence from this student’s portal.</p></div><button autoFocus className="ai-button" onClick={onClose} aria-label="Close progress"><X size={18}/></button></header>
   <div className="ai-coach-content">
    <button className="ai-button" disabled={loading} onClick={()=>setVersion(value=>value+1)}><RefreshCw size={15}/>Refresh progress</button>
    {error?<div className="ai-empty ai-error" role="alert"><p>{error}</p><button className="ai-button" onClick={()=>setVersion(value=>value+1)}>Retry progress</button></div>:loading?<p role="status" className="ai-inline-loading">Loading progress…</p>:data&&<>
     {!!data.plans.length&&<div className="ai-coach-summary"><span><BookOpen size={18}/><strong>{data.plans.length}</strong> saved plans</span><span><CheckCircle2 size={18}/><strong>{completed} / {lessons.length}</strong> lessons completed</span></div>}
     {data.journey&&<article className="ai-coach-plan"><h3>Progress tracking</h3><ProgressFacts values={data.journey.progress_tracking}/>{data.journey.weekly_metrics&&<><h4>Weekly progress</h4><ProgressFacts values={data.journey.weekly_metrics}/></>}{!!data.journey.daily_schedule?.length&&<><h4>Daily learning schedule</h4>{data.journey.daily_schedule.map((task,index)=><section className="ai-progress-skill" key={String(task.id||index)}><ProgressFacts values={task}/></section>)}</>}</article>}
     {!data.plans.length&&!data.journey?<div className="ai-empty"><TrendingUp size={26}/><h3>No progress recorded for this drive</h3><p>A saved plan and its progress will appear after the student creates one in their portal.</p></div>:data.plans.map(plan=><article key={plan.id} className="ai-coach-plan">
      <h3>{plan.company_name} · {plan.role_title}</h3>{plan.target_date&&<p>Target date: {plan.target_date.slice(0,10)}</p>}{plan.goal&&<h4>{plan.goal}</h4>}{plan.summary&&<p>{plan.summary}</p>}
      <h4>Learning plan</h4><ol>{plan.lessons.map((lesson,index)=><li key={lesson.session_id||index}><span className={`ai-status ${lesson.stage==='completed'?'good':'neutral'}`}>{label(lesson.stage)}</span><div><strong>Day {lesson.day||index+1} · {lesson.title||lesson.focus||'Lesson'}</strong>{lesson.objective&&<p>Learning objective: {lesson.objective}</p>}{lesson.activities?.map((activity,i)=><p key={i}>{activity}</p>)}<p>{lesson.schedule_status==='cancelled'?'Booking cancelled':lesson.scheduled_at?`Scheduled · ${formatPlacementDateTime(lesson.scheduled_at)}`:'Not scheduled'}</p><p>Teaching: {lesson.teaching_completed===true?'Completed':lesson.teaching_completed===false?'Not completed':'Not recorded'} · Validation: {lesson.validation_status?label(lesson.validation_status):'Not assessed'}</p>{!!lesson.weak_sub_skills?.length&&<p>Needs practice: {lesson.weak_sub_skills.join(', ')}</p>}{lesson.validated_at&&<small>Validated: {formatPlacementDateTime(lesson.validated_at)}</small>}</div></li>)}</ol>
      <h4>What your evidence shows</h4>{plan.skills_progress? <>{typeof plan.skills_progress.score==='number'&&<p>{plan.skills_progress.score}% readiness from recorded evidence</p>}{!plan.skills_progress.skills.length&&<p>No skill assessments recorded.</p>}{plan.skills_progress.skills.map(skill=><section key={skill.skill} className="ai-progress-skill"><h5>{skill.skill} <span className="ai-status neutral">{skillLabel(skill.state)}</span></h5><p>{skill.evidence_note}</p><p>Main Resume: {skill.resume_evidence==='none'?'No evidence found':skill.resume_evidence?'Declared evidence':'Not assessed'} · Training: {label(skill.training_stage)}</p>{skill.drive_ready&&<p>Drive Ready · {skill.strong_evidence_count} independent evaluations across {skill.independent_context_count} question contexts</p>}{skill.last_assessed_at&&<p>Last assessed: {formatPlacementDateTime(skill.last_assessed_at)}</p>}{!!skill.objectives?.length&&<details><summary>Assessment details · {skill.objectives.length} tasks</summary>{skill.objectives.map(objective=><div key={objective.task_id}><strong>{objective.question||'Assessment task'}</strong><p>{skillLabel(objective.status)}</p><p>{objective.answer||'Not answered yet.'}</p>{objective.feedback?.feedback&&<p>{objective.feedback.feedback}</p>}{objective.feedback?.gaps?.map(gap=><p key={gap}>Needs work: {gap}</p>)}</div>)}</details>}</section>)}</>:<p>Skill progress is unavailable. Refresh after the progress API is updated.</p>}
     </article>)}
     {!!data.cycles.length&&<section className="ai-coach-plan"><h3>Focused improvement cycles</h3>{data.cycles.map(cycle=><p key={cycle.id}>{label(cycle.status)} · {cycle.call_completed_at?'Teaching completed':'Teaching not completed'} · {cycle.validation_completed_at?'Validation completed':'Validation pending'}</p>)}</section>}
    </>}
   </div><footer><p>Read-only. The student completes learning and validation in their own portal.</p><button className="ai-button" onClick={onClose}>Close progress</button></footer>
  </section>
 </div>,document.body);
}
