import {useEffect,useRef,useState} from 'react';
import {ArrowRight,RefreshCw} from 'lucide-react';
import {assessmentSummary,atsKey,driveHistory,type ATSState} from './assessmentIntelligenceData';
import {invalidateStudentAssessment,loadStudentAssessment,loadAllStudentAssessments,type FullBundle} from './assessmentClient';
import {displayName} from './placementDisplay';
import {attendanceLabel,type ProfileStudent} from './CandidateProfileOverview';

type Student=ProfileStudent&{student_id?:string};
export default function CandidateSummaryCard({student,photo,driveId,onOpen,onPhotoError,children}:{student:Student;photo?:string;driveId?:string;onOpen:()=>void;onPhotoError:()=>void;children?:React.ReactNode}){
 const id=student.student_id||student.id||'',ref=useRef<HTMLElement>(null);
 const [visible,setVisible]=useState(false),[bundle,setBundle]=useState<FullBundle|null>(null),[ats,setATS]=useState<Record<string,ATSState>>({}),[loading,setLoading]=useState(true),[failed,setFailed]=useState(false),[version,setVersion]=useState(0);
 useEffect(()=>{const node=ref.current;if(!node)return;if(typeof IntersectionObserver==='undefined'){setVisible(true);return}const observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){setVisible(true);observer.disconnect()}},{rootMargin:'240px'});observer.observe(node);return()=>observer.disconnect()},[id]);
 useEffect(()=>{if(!visible||!id)return;let active=true;setLoading(true);setFailed(false);setBundle(null);setATS({});
  void loadStudentAssessment(id).then(async data=>{if(!active)return;setBundle(data);const values=await loadAllStudentAssessments(data);if(active)setATS(Object.fromEntries(Object.entries(values).map(([drive,row])=>[atsKey(id,drive),{row}])))}).catch(()=>{if(active)setFailed(true)}).finally(()=>{if(active)setLoading(false)});
  return()=>{active=false};
 },[id,visible,version]);
 const profile={...student,...bundle?.student};
 const scoped=bundle&&driveId?{...bundle,drives:bundle.drives.filter(row=>row.drive_id===driveId),reports:bundle.reports.filter(row=>row.drive_id===driveId)}:bundle;
 const summary=scoped?assessmentSummary(scoped,ats):null;
 const readiness=scoped?driveHistory(scoped).find(row=>row.report?.readiness)?.report?.readiness:null;
 const cgpa=profile.cgpa!=null&&String(profile.cgpa).trim()!==''&&Number.isFinite(Number(profile.cgpa))?Number(profile.cgpa).toFixed(2):'Not recorded';
 const status=profile.status?displayName(profile.status):'Status not recorded';
 const metric=(n:number|undefined)=>n==null?'—':String(n);
 return <article ref={ref} className="c360-candidate-card" aria-label={`Candidate ${profile.full_name}`} aria-busy={loading}>
  <header className="c360-card-header"><span className="c360-card-avatar">{photo?<img src={photo} alt={`${profile.full_name} profile`} loading="lazy" onError={onPhotoError}/>:profile.full_name.split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join('')}</span><div className="c360-card-identity"><h2>{profile.full_name}</h2><span title={profile.roll_number}>ID {profile.roll_number||'Not recorded'}</span>{profile.email&&<a href={`mailto:${profile.email}`} title={profile.email}>{profile.email}</a>}</div><span className={`c360-student-status ${profile.status==='active'?'is-active':''}`}>{status}</span></header>
  <dl className="c360-card-academics"><div><dt>Course</dt><dd title={profile.program||''}>{profile.program||'Not recorded'}</dd></div><div><dt>Department</dt><dd title={profile.department_display_name||profile.department_code||''}>{profile.department_display_name||profile.department_code||'Not recorded'}</dd></div><div><dt>Graduation year</dt><dd>{profile.graduation_year||'Not recorded'}</dd></div><div><dt>CGPA</dt><dd>{cgpa}{cgpa!=='Not recorded'&&<small> / 10</small>}</dd></div><div><dt>Overall attendance</dt><dd title="Current semester academic attendance; present and on-duty classes count as attended.">{loading&&!profile.overall_attendance?'Loading…':failed&&!profile.overall_attendance?'Unavailable':attendanceLabel(profile)}</dd></div></dl>
  <div className="c360-card-metrics" aria-label="Placement summary"><span>ATS above cutoff <b>{metric(summary?.eligible)}</b></span><span>Participated <b>{metric(summary?.participated)}</b></span><span>Avg. ATS <b>{summary?.averageATS==null?'—':`${Math.round(summary.averageATS)}%`}</b></span><span>Assigned drives <b>{metric(summary?.drives)}</b></span></div>
  <section className="c360-card-score" aria-label="Interview summary"><div><span>Best interview score</span><strong>{summary?.bestScore==null?'Not assessed':`${summary.bestScore}/100`}</strong></div><progress max={100} value={summary?.bestScore??0} aria-label={`${profile.full_name} best interview score`}/><p>{readiness?displayName(readiness):'No interview readiness recorded.'}</p></section>
  <div className="c360-card-data-note" aria-live="polite">{failed?<span>Summary unavailable <button type="button" onClick={()=>{invalidateStudentAssessment(id);setVersion(v=>v+1)}}>Retry</button></span>:loading?<span><RefreshCw size={11} className="c360-loading-icon"/> Loading assessment summary…</span>:summary?<span>ATS assessed: {summary.assessed} of {summary.drives} drives{summary.pending?' · Processing remaining results':''}</span>:<span>No assessment history recorded.</span>}</div>
  {children}<footer><button className="c360-view-profile" type="button" onClick={onOpen}>View details <ArrowRight size={15}/></button></footer>
 </article>;
}
