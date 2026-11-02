import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {RefreshCw,TrendingUp,X} from 'lucide-react';
import {UserFacingError} from '@/lib/userFacingError';
import {collegeApi,collegeError} from '@/api/collegeApi';
import {endpointMissing,type FullBundle} from './assessmentClient';
import {DriveProgress,selectDriveTrajectory,type ProgressReport,type ProgressMetrics} from '@/shared-assessment/DriveProgress';
import {driveHistory} from './assessmentIntelligenceData';

type Lesson={session_id?:string;day?:number;title?:string;focus?:string;objective?:string;activities?:string[];scheduled_at?:string;schedule_status?:string;stage?:string;teaching_completed?:boolean;lesson_completed_at?:string;validation_status?:string;weak_sub_skills?:string[];validated_at?:string};
type Skill={skill:string;state:string;training_stage:string;evidence_note?:string;source?:string;resume_evidence?:string;last_assessed_at?:string;drive_ready?:boolean;strong_evidence_count?:number;independent_context_count?:number;objectives?:{task_id:string;question?:string;answer?:string;status:string;feedback?:{feedback?:string;gaps?:string[]}}[]};
type Plan={id:string;drive_id?:string;company_name?:string;role_title?:string;target_date?:string;goal?:string;summary?:string;lessons:Lesson[];skills_progress?:{score?:number;skills:Skill[]}};
type Journey={drive_id:string;progress_tracking:ProgressMetrics&{trajectory_points?:unknown};weekly_metrics?:Record<string,unknown>;daily_schedule?:Record<string,unknown>[]};
type ProgressData={journey_unlocked?:boolean;progress_reports?:ProgressReport[];journey?:Journey|null;student_id:string;drive_id?:string;plans:Plan[];cycles:{id:string;drive_id?:string;status?:string;call_completed_at?:string;validation_completed_at?:string}[]};
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
 const points=selectDriveTrajectory(data?.progress_reports||[],driveId,data?.journey?.progress_tracking?.trajectory_points);
 const [showReports,setShowReports]=useState(false);
 return createPortal(<div className="ai-coach-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)onClose()}}>
  <section ref={dialog} className="ai-coach-dialog" role="dialog" aria-modal="true" aria-labelledby="ai-progress-title">
   <header><div><span className="ai-eyebrow">STUDENT PROGRESS</span><h2 id="ai-progress-title"><TrendingUp size={21}/>Progress · {bundle.student.full_name}</h2><p>{drive?.company_name} · {drive?.role_title}</p><p>Saved learning progress and evidence from this student’s portal.</p></div><button autoFocus className="ai-button" onClick={onClose} aria-label="Close progress"><X size={18}/></button></header>
   <div className="ai-coach-content">
    <button className="ai-button" disabled={loading} onClick={()=>setVersion(value=>value+1)}><RefreshCw size={15}/>Refresh progress</button>
    {error?<div className="ai-empty ai-error" role="alert"><p>{error}</p><button className="ai-button" onClick={()=>setVersion(value=>value+1)}>Retry progress</button></div>:loading?<p role="status" className="ai-inline-loading">Loading progress…</p>:data&&<>
     {data.journey_unlocked===false?<section className="ai-coach-plan"><h3>Your improvement journey starts with an interview</h3><p>Complete your first interview for this placement drive to unlock your AI Coach, learning plan, practice resources and progress dashboard.</p><p>Starting an interview alone doesn’t unlock coaching. Once completed, your journey stays available for later attempts and after the drive ends.</p></section>:<>
     <DriveProgress points={points} progressMetrics={data.journey?.progress_tracking} onReport={()=>setShowReports(value=>!value)}/>
     {showReports&&<section className="ai-coach-plan" aria-label="Recorded interview scores"><h3>Recorded interview scores</h3>{points.length?<table><thead><tr><th>Attempt</th><th>Overall score</th><th>Technical</th><th>Communication</th></tr></thead><tbody>{points.map((point,index)=><tr key={index}><td>{point.milestone}</td><td>{point.overall}/100</td><td>{point.technical}/100</td><td>{point.communication}/100</td></tr>)}</tbody></table>:<p>No released interview scores for this drive.</p>}</section>}
     </>}
    </>}
   </div><footer><p>Read-only. The student completes learning and validation in their own portal.</p><button className="ai-button" onClick={onClose}>Close progress</button></footer>
  </section>
 </div>,document.body);
}
