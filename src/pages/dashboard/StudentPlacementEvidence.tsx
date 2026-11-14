import AssessmentStudentOverview from './AssessmentStudentOverview';
import CandidateReport from './CandidateReport';
import PlacementAssessmentTable from './PlacementAssessmentTable';
import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {useSearchParams} from 'react-router-dom';
import {ATSFitDetails} from './DriveManagement';
import {collegeError} from '@/api/collegeApi';
import {loadStudentAssessment,loadAllStudentAssessments,invalidateStudentAssessment,type FullBundle,type FullAssessment} from './assessmentClient';
import {atsKey,driveHistory,type ATSState} from './assessmentIntelligenceData';
import StudentScorecard from './StudentScorecard';
import AssessmentCoach from './AssessmentCoach';
import AssessmentCandidateDetails from './AssessmentCandidateDetails';
import './placement-student-workspace.css';

/** All placement surfaces read the Assessment Intelligence contract and its score rules. */
export default function StudentPlacementEvidence({studentId,readOnly=false,backLabel='Back to Candidate 360°'}:{studentId:string;readOnly?:boolean;backLabel?:string}){
 const [data,setData]=useState<{bundle:FullBundle;ats:Record<string,FullAssessment>}|null>(null),[error,setError]=useState(''),[version,setVersion]=useState(0),[pollNotice,setPollNotice]=useState('');
 const [,setParams]=useSearchParams();
 const surface=useRef<HTMLElement>(null),returnPosition=useRef<{scroll:number;label:string|null;text:string;drive:string|null}|null>(null);
 const [atsDrive,setATSDrive]=useState(''),[session,setSession]=useState(''),[progress,setProgress]=useState(''),[profile,setProfile]=useState<string|null>(null);
 const openScorecard=(id:string)=>{const button=document.activeElement as HTMLElement|null;returnPosition.current={scroll:window.scrollY,label:button?.getAttribute('aria-label')||null,text:button?.textContent?.trim()||'',drive:button?.closest<HTMLElement>('[data-drive-id]')?.dataset.driveId||null};setSession(id)};
 useLayoutEffect(()=>{
  if(session){window.scrollTo({top:0,behavior:'instant'});surface.current?.focus({preventScroll:true});return}
  const previous=returnPosition.current;if(!previous)return;
  window.scrollTo({top:previous.scroll,behavior:'instant'});
  const button=[...(surface.current?.querySelectorAll<HTMLButtonElement>('button')||[])].find(item=>(previous.label?item.getAttribute('aria-label')===previous.label:item.textContent?.trim()===previous.text)&&(!previous.drive||item.closest<HTMLElement>('[data-drive-id]')?.dataset.driveId===previous.drive));
  button?.focus({preventScroll:true});returnPosition.current=null;
 },[session]);
 useEffect(()=>{
  let active=true,timer:ReturnType<typeof setTimeout>|undefined;
  const deadline=Date.now()+120000;
  let lastRead=Date.now(),inflight=false;
  setData(null);setError('');setPollNotice('');
  const read=async(initial=false)=>{
   if(inflight)return;inflight=true;
   try{
    const bundle=await loadStudentAssessment(studentId),ats=await loadAllStudentAssessments(bundle);
    if(!active)return;
    lastRead=Date.now();setData({bundle,ats});
    if(Object.values(ats).some(row=>row.ats_status==='processing')){
     if(Date.now()<deadline)timer=setTimeout(()=>{void read()},5000);
     else setPollNotice('Some ATS assessments are taking longer than expected. You can continue reviewing available results or refresh assessments to check again.');
    }
   }catch(e){if(active){if(initial)setError(collegeError(e));else setPollNotice('Unable to refresh ATS status. Your loaded results are still available. Use Refresh assessments to try again.')}}finally{inflight=false}
  };
  void read(true);
  const refreshOnReturn=()=>{if(!active||document.hidden||Date.now()-lastRead<30000)return;invalidateStudentAssessment(studentId);if(timer)clearTimeout(timer);void read()};
  window.addEventListener('focus',refreshOnReturn);document.addEventListener('visibilitychange',refreshOnReturn);
  return()=>{active=false;if(timer)clearTimeout(timer);window.removeEventListener('focus',refreshOnReturn);document.removeEventListener('visibilitychange',refreshOnReturn)};
 },[studentId,version]);
 const refresh=()=>{invalidateStudentAssessment(studentId);setVersion(v=>v+1)};
 if(error)return <article className="pw-panel" role="alert"><h2>Placement assessments unavailable</h2><p>{error}</p><button onClick={refresh}>Retry assessments</button></article>;
 if(!data)return <article className="pw-panel" role="status">Loading placement assessments…</article>;
 const {bundle,ats}=data,rows=driveHistory(bundle);
 const states:Record<string,ATSState>=Object.fromEntries(rows.map(({drive})=>[atsKey(studentId,drive.drive_id),ats[drive.drive_id]?{row:ats[drive.drive_id]}:{error:'ATS assessment unavailable'}]));
 const selected=bundle.reports.find(row=>row.session_id===session),atsSelection=rows.find(row=>row.drive.drive_id===atsDrive);
 if(selected?.session_id&&selected.drive_id)return <section ref={surface} tabIndex={-1} className="assessment-intelligence" aria-label="Candidate interview scorecard"><button type="button" className="ai-button" onClick={()=>setSession('')}>← {backLabel}</button>{readOnly?<StudentScorecard key={selected.session_id} studentId={studentId} sessionId={selected.session_id} role={selected.role_title} assessedAt={selected.completed_at} readOnly/>:<CandidateReport key={selected.session_id} driveId={selected.drive_id} studentId={studentId} sessionId={selected.session_id} onBack={()=>setSession('')}/>}</section>;
 return <section ref={surface} className="assessment-intelligence placement-evidence pw-cumulative-assessment" aria-label="Placement assessment intelligence">
  <article className="ai-student-card expanded">
   <AssessmentStudentOverview readOnly={readOnly} student={bundle.student} bundle={bundle} ats={states} onProfile={drive=>setProfile(drive||'')} onScorecard={({report})=>{if(report?.session_id)openScorecard(report.session_id)}}/>
   <div id={`ai-history-${studentId}`} className="ai-student-history">
    <div className="ai-history-caption"><span>Current resume ATS fit · latest recorded interview per drive</span><button type="button" className="ai-text-button" onClick={refresh}>Refresh assessments</button></div>
    {pollNotice&&<p className="ai-empty" role="status">{pollNotice}</p>}
    {rows.length?<PlacementAssessmentTable bundle={bundle} rows={rows} ats={states} onATS={setATSDrive} onScorecard={({report})=>{if(report?.session_id)openScorecard(report.session_id)}} onProfile={setProfile} onProgress={setProgress} onRetry={refresh}/>:<p className="ai-empty">No placement assignments or drive reports have been recorded for this student.</p>}
   </div>
  </article>
  {atsSelection&&<ATSFitDetails key={`${studentId}:${atsDrive}`} driveId={atsDrive} drive={null} cutoff={ats[atsDrive]?.criteria_ats_fit??atsSelection.drive.criteria_ats_fit} candidate={{student_id:studentId,full_name:bundle.student.full_name,roll_number:bundle.student.roll_number,email:bundle.student.email,program:bundle.student.program,department_code:bundle.student.department_code||undefined,cgpa:bundle.student.cgpa??undefined,graduation_year:bundle.student.graduation_year,assignment_status:atsSelection.drive.assignment_status,overall_score:atsSelection.report?.overall_score??undefined,readiness:atsSelection.report?.readiness,placement_decision:atsSelection.drive.placement_decision||atsSelection.report?.placement_decision,criteria_interview_score:atsSelection.drive.criteria_interview_score}} initialAssessment={ats[atsDrive]} onClose={()=>setATSDrive('')} onReviewRequirements={readOnly?undefined:()=>{setATSDrive('');setParams(previous=>{const next=new URLSearchParams(previous);next.set('view','placements');next.set('drive',atsDrive);next.set('section','settings');for(const key of ['candidate','candidateTab','candidateAttempt'])next.delete(key);return next})}}/>}
  {progress&&<AssessmentCoach bundle={bundle} driveId={progress} onClose={()=>setProgress('')}/>}
  {profile!==null&&<AssessmentCandidateDetails student={bundle.student} bundle={bundle} driveId={profile} onClose={()=>setProfile(null)}/>}
 </section>;
}
