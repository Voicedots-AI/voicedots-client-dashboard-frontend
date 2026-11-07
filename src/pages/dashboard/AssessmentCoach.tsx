import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {RefreshCw,TrendingUp,X} from 'lucide-react';
import {collegeApi,collegeError} from '@/api/collegeApi';
import {endpointMissing,type FullBundle} from './assessmentClient';
import {driveHistory} from './assessmentIntelligenceData';

import {JourneyReview} from '@/shared-journey/JourneyReview';
import {validateStudentJourney, type StudentJourneyResponse} from './studentJourneyContract';
import './assessmentJourney.css';

export default function AssessmentCoach({bundle,driveId,onClose}:{bundle:FullBundle;driveId:string;onClose:()=>void}){
 const [result,setResult]=useState<{key:string;data?:StudentJourneyResponse;error?:string}>(),[version,setVersion]=useState(0);
 const dialog=useRef<HTMLElement>(null),restoreFocus=useRef(document.activeElement as HTMLElement|null);
 const drive=driveHistory(bundle).find(row=>row.drive.drive_id===driveId)?.drive;
 const path=`students/${encodeURIComponent(bundle.student.id)}/journey?drive_id=${encodeURIComponent(driveId)}`;
 const key=`${path}:${version}`,loading=result?.key!==key,data=result?.key===key?result.data:null,error=result?.key===key?result.error:undefined;
 useEffect(()=>{
  const controller=new AbortController();
  // Progress changes during lessons: bypass the indefinite assessment cache.
  void collegeApi.get<StudentJourneyResponse>(path,controller.signal).then(value=>{
   if(controller.signal.aborted)return;
   validateStudentJourney(value,bundle.student.id,driveId);
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
 return createPortal(<div className="ai-coach-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)onClose()}}>
  <section ref={dialog} className="ai-coach-dialog ai-journey-dialog" role="dialog" aria-modal="true" aria-labelledby="ai-progress-title">
   <header><div><span className="ai-eyebrow">STUDENT PROGRESS</span><h2 id="ai-progress-title"><TrendingUp size={21}/>Progress · {bundle.student.full_name}</h2><p>{drive?.company_name} · {drive?.role_title}</p><p>The same nine-screen saved-progress view available in this student’s portal.</p></div><button autoFocus className="ai-button" onClick={onClose} aria-label="Close progress"><X size={18}/></button></header>
   <div className="ai-coach-content">
    <button className="ai-button" disabled={loading} onClick={()=>setVersion(value=>value+1)}><RefreshCw size={15}/>Refresh progress</button>
    {error?<div className="ai-empty ai-error" role="alert"><p>{error}</p><button className="ai-button" onClick={()=>setVersion(value=>value+1)}>Retry progress</button></div>:loading?<p role="status" className="ai-inline-loading">Loading student journey…</p>:data&&<JourneyReview key={key} journey={data.journey} studentName={bundle.student.full_name} companyName={drive?.company_name} roleTitle={drive?.role_title}/>}

   </div><footer><p>Read-only. The student completes learning and validation in their own portal.</p><button className="ai-button" onClick={onClose}>Close progress</button></footer>
  </section>
 </div>,document.body);
}
