import {useEffect,useRef,useState} from 'react';
import {ArrowRight,RefreshCw} from 'lucide-react';
import {invalidateStudentAssessment,loadStudentAssessment,type FullBundle} from './assessmentClient';
import {displayName} from './placementDisplay';
import {type ProfileStudent} from './CandidateProfileOverview';

type Student=ProfileStudent&{student_id?:string};
export default function CandidateSummaryCard({student,photo,onOpen,onPhotoError,children}:{student:Student;photo?:string;driveId?:string;onOpen:()=>void;onPhotoError:()=>void;children?:React.ReactNode}){
 const id=student.student_id||student.id||'',ref=useRef<HTMLElement>(null);
 const [visible,setVisible]=useState(false),[bundle,setBundle]=useState<FullBundle|null>(null),[loading,setLoading]=useState(true),[failed,setFailed]=useState(false),[version,setVersion]=useState(0);
 useEffect(()=>{const node=ref.current;if(!node)return;if(typeof IntersectionObserver==='undefined'){setVisible(true);return}const observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){setVisible(true);observer.disconnect()}},{rootMargin:'240px'});observer.observe(node);return()=>observer.disconnect()},[id]);
 useEffect(()=>{if(!visible||!id)return;let active=true;setLoading(true);setFailed(false);setBundle(null);
  void loadStudentAssessment(id).then(data=>{if(active)setBundle(data)}).catch(()=>{if(active)setFailed(true)}).finally(()=>{if(active)setLoading(false)});
  return()=>{active=false};
 },[id,visible,version]);
 const profile={...student,...bundle?.student};
 const competencies=new Map<string,{label:string;total:number;count:number}>(),sessions=new Set<string>();
 for(const report of bundle?.reports||[]){
  if(report.session_id&&sessions.has(report.session_id))continue;
  if(report.session_id)sessions.add(report.session_id);
  const detail=report.detail as Record<string,unknown>|undefined;
  const dimensions=[...(Array.isArray(detail?.core_dimensions)?detail.core_dimensions:[]),...(Array.isArray(detail?.domain_dimensions)?detail.domain_dimensions:[])];
  for(const item of dimensions){
   if(!item||typeof item!=='object')continue;
   const row=item as Record<string,unknown>,key=typeof row.dimension==='string'?row.dimension:'';
   const score=typeof row.percentage==='number'?row.percentage:typeof row.band==='number'?row.band*25:null;
   if(!key||score===null||!Number.isFinite(score)||score<0||score>100)continue;
   const prior=competencies.get(key)||{label:typeof row.label==='string'?row.label:displayName(key),total:0,count:0};
   competencies.set(key,{...prior,total:prior.total+score,count:prior.count+1});
  }
 }
 const competencyRows=[...competencies.entries()].sort(([a],[b])=>a.localeCompare(b));
 const cgpa=profile.cgpa!=null&&String(profile.cgpa).trim()!==''&&Number.isFinite(Number(profile.cgpa))?Number(profile.cgpa).toFixed(2):'Not recorded';
 const status=profile.status?displayName(profile.status):'Status not recorded';
 return <article ref={ref} className="c360-candidate-card" aria-label={`Candidate ${profile.full_name}`} aria-busy={loading}>
  <header className="c360-card-header"><span className="c360-card-avatar">{photo?<img src={photo} alt={`${profile.full_name} profile`} loading="lazy" onError={onPhotoError}/>:profile.full_name.split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join('')}</span><div className="c360-card-identity"><h2><button type="button" className="c360-person-link" onClick={onOpen}>{profile.full_name}</button></h2><span title={profile.roll_number}>ID {profile.roll_number||'Not recorded'}</span>{profile.email&&<a href={`mailto:${profile.email}`} title={profile.email}>{profile.email}</a>}</div><span className={`c360-student-status ${profile.status==='active'?'is-active':''}`}>{status}</span></header>
  <dl className="c360-card-tags" aria-label="Academic profile"><div><dt>Course</dt><dd title={profile.program||''}>{profile.program||'Not recorded'}</dd></div><div><dt>Department</dt><dd><abbr title={profile.department_display_name||profile.department_code||'Department not recorded'}>{profile.department_code||profile.department_display_name||'Not recorded'}</abbr></dd></div><div><dt>Class of</dt><dd>{profile.graduation_year||'Not recorded'}</dd></div><div><dt>CGPA</dt><dd>{cgpa}{cgpa!=='Not recorded'&&<small> / 10</small>}</dd></div></dl>
  <section className="c360-card-competencies" aria-label="Cumulative competency profile"><h3>Competency Profile</h3>
   {competencyRows.length?<><dl className="c360-competency-bars">{competencyRows.map(([key,row],index)=>{const score=Math.round(row.total/row.count);return <div key={key} className={`c360-competency-tone-${index%5}`}><dt>{row.label}</dt><dd><progress max={100} value={score} aria-label={`${row.label} cumulative score`} aria-valuetext={`${score}%`}/><strong>{score}%</strong></dd></div>})}</dl><p>Average across recorded assessments</p></>:<p>{loading?'Loading competency evidence…':failed?'Competency evidence unavailable.':'No competency scores recorded yet.'}</p>}
  </section>
  <div className="c360-card-data-note" aria-live="polite">{failed?<span>Profile unavailable <button type="button" onClick={()=>{invalidateStudentAssessment(id);setVersion(v=>v+1)}}>Retry</button></span>:loading?<span><RefreshCw size={11} className="c360-loading-icon"/> Loading candidate profile…</span>:null}</div>
  {children}<footer><button className="c360-view-profile" type="button" onClick={onOpen}>View details <ArrowRight size={15}/></button></footer>
 </article>;
}
