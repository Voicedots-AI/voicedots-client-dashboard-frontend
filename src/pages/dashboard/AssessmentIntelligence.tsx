import AssessmentStudentOverview from './AssessmentStudentOverview';
import PlacementAssessmentTable from './PlacementAssessmentTable';
import { assessmentProgramOptions } from './assessmentProgramOptions';
import AssessmentCoach from './AssessmentCoach';
import {RosterExpandControl} from '@/shared-assessment/RosterExpandControl';
import {useCallback,useEffect,useRef,useState} from 'react';
import {useSearchParams} from 'react-router-dom';
import {ArrowUpRight,ChevronDown,FileText,RefreshCw,Search,Users,X} from 'lucide-react';
import {collegeError,type CollegeStudent,type Program} from '@/api/collegeApi';
import {ATSFitDetails} from './DriveManagement';
import CandidateReport from './CandidateReport';
import {displayName,formatPlacementDateTime} from './placementDisplay';
import {assessmentSummary,atsKey,currentATSScore,atsAboveDriveCutoff,atsDriveCutoff,driveHistory,initialFilters,matchesAssessmentFilters,validScore,type AssessmentATS,type AssessmentFilters,type ATSState} from './assessmentIntelligenceData';
import {cachedAssessmentRequest,peekAssessment,loadStudentAssessment,loadAllStudentAssessments,clearAssessmentCache,readAssessmentView,saveAssessmentView,invalidateStudentAssessment,type FullBundle} from './assessmentClient';
import AssessmentCandidateDetails from './AssessmentCandidateDetails';
import './assessmentIntelligence.css';

type Roster={items?:CollegeStudent[];total?:number;assigned_groups?:{program?:string;department_code?:string;batch_label?:string;graduation_year?:number}[]};
type ViewState={expansionMode?:boolean|null;contract:"student-ats-v1";draft:AssessmentFilters;filters:AssessmentFilters;offset:number;showFilters:boolean;roster:CollegeStudent[];total:number;groups:NonNullable<Roster['assigned_groups']>;catalog:{programs:Program[];graduation_years:number[]};bundles:Record<string,FullBundle>;ats:Record<string,ATSState>;historyErrors:Record<string,string>;expanded:string[];drivePages:Record<string,number>};
const pageSize=25;
const scoreLabel=(value:unknown)=>validScore(value)?`${Math.round(value*10)/10}/100`:'Not assessed';
const date=(value?:string)=>value?formatPlacementDateTime(value):'—';
const shortDate=(value?:string)=>value?new Date(value).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric',timeZone:'Asia/Kolkata'}):'—';
export default function AssessmentIntelligence(){
 const [params,setParams]=useSearchParams();
 const studentId=params.get('student'),assessmentDrive=params.get('assessment_drive');
 const [saved]=useState(()=>{const value=readAssessmentView<ViewState>();return value?.contract==='student-ats-v1'?value:undefined});
 const globalExpansion=useRef<boolean|null>(saved?.expansionMode??null);
 const [draft,setDraft]=useState<AssessmentFilters>(saved?.draft||{...initialFilters}),[filters,setFilters]=useState<AssessmentFilters>(saved?.filters||{...initialFilters});
 const [showFilters,setShowFilters]=useState(saved?.showFilters??true),[offset,setOffset]=useState(saved?.offset??0),[version,setVersion]=useState(0);
 const [roster,setRoster]=useState<CollegeStudent[]>(saved?.roster||[]),[total,setTotal]=useState(saved?.total||0),[groups,setGroups]=useState<NonNullable<Roster['assigned_groups']>>(saved?.groups||[]);
 const [catalog,setCatalog]=useState<{programs:Program[];graduation_years:number[]}>(saved?.catalog||{programs:[],graduation_years:[]});
 const [bundles,setBundles]=useState<Record<string,FullBundle>>(saved?.bundles||{}),[historyErrors,setHistoryErrors]=useState<Record<string,string>>(saved?.historyErrors||{}),[ats,setATS]=useState<Record<string,ATSState>>(saved?.ats||{});
 const [loading,setLoading]=useState(!saved),[background,setBackground]=useState(0),[error,setError]=useState('');
 const [expandedStudents,setExpandedStudents]=useState<Set<string>>(new Set(saved?.expanded||[]));
 const expandedRef=useRef(expandedStudents);expandedRef.current=expandedStudents;
 const [drivePages,setDrivePages]=useState<Record<string,number>>(saved?.drivePages||{});
 const [progress,setProgress]=useState<{bundle:FullBundle;driveId:string}|null>(null);
 const closeProgress=useCallback(()=>setProgress(null),[]);
 const [profile,setProfile]=useState<{student:CollegeStudent;drive?:string}|null>(null);
 const [scorecard,setScorecard]=useState<{student:string;drive:string;session:string;role?:string;assessedAt?:string}|null>(null);
 // Automatic filtering is debounced so typing and slider movement do not flood requests.
 useEffect(()=>{
  if(JSON.stringify(draft)===JSON.stringify(filters)||(draft.from&&draft.to&&draft.from>draft.to))return;
  const timer=window.setTimeout(()=>{setOffset(0);setDrivePages({});setFilters({...draft});setParams(current=>{if(!current.has('student')&&!current.has('assessment_drive'))return current;const next=new URLSearchParams(current);next.delete('student');next.delete('assessment_drive');return next})},250);
  return()=>window.clearTimeout(timer);
 },[draft,filters,setParams]);
 const academicKey=JSON.stringify({q:filters.q,minCGPA:filters.minCGPA,program:filters.program,year:filters.year,active:filters.active});
 useEffect(()=>{
  let alive=true;void cachedAssessmentRequest<{programs:Program[];graduation_years:number[]}>('academic-catalog').then(result=>{if(alive)setCatalog({programs:result.programs||[],graduation_years:result.graduation_years||[]})}).catch(()=>{});return()=>{alive=false};
 },[]);
 useEffect(()=>{
  let alive=true,lastRefresh=Date.now();
  let loadedIds:string[]=[];
  const timers=new Set<ReturnType<typeof setTimeout>>();
  const selectedAtLoad=new URLSearchParams(window.location.search).get('student');
  const values=JSON.parse(academicKey) as Pick<AssessmentFilters,'q'|'minCGPA'|'program'|'year'|'active'>;
  const query=new URLSearchParams({limit:String(pageSize),offset:String(offset),sort:'roll_number',order:'asc'});
  if(values.q.trim())query.set('q',values.q.trim());if(values.minCGPA)query.set('min_cgpa',String(values.minCGPA));if(values.program)query.set('program',values.program);if(values.year)query.set('graduation_year',values.year);if(values.active)query.set('status','active');
  const path=`students?${query}`;
  if(!peekAssessment<Roster>(path))setLoading(true);
  setError('');setBackground(0);
  const commit=async(id:string,refresh=false)=>{
   if(refresh)invalidateStudentAssessment(id);
   try{
    const bundle=await loadStudentAssessment(id);
    if(!alive)return;
    setBundles(current=>({...current,[id]:bundle}));
    setHistoryErrors(current=>{const next={...current};delete next[id];return next});
    const rows=await loadAllStudentAssessments(bundle);
    if(!alive)return;
    setATS(current=>{const next={...current};for(const {drive} of driveHistory(bundle))next[atsKey(id,drive.drive_id)]=rows[drive.drive_id]?{row:rows[drive.drive_id]}:{error:'Assessment unavailable'};return next});
    if(Object.values(rows).some(row=>row.ats_status==='processing')){
     const poll=()=>{const timer=setTimeout(()=>{timers.delete(timer);if(!alive)return;if(document.visibilityState==='hidden'){poll();return}void commit(id,true)},15000);timers.add(timer)};poll();
    }
   }catch(reason){if(alive)setHistoryErrors(current=>({...current,[id]:collegeError(reason)}))}
  };
  void cachedAssessmentRequest<Roster>(path).then(result=>{
   if(!alive)return;
   const students=Array.isArray(result.items)?result.items:[];
   setRoster(students);setTotal(Number.isFinite(result.total)?Number(result.total):students.length);setGroups(result.assigned_groups||[]);setLoading(false);
   setExpandedStudents(current=>{if(globalExpansion.current!==null)return new Set(globalExpansion.current?students.map(student=>student.id):[]);const next=[...current].filter(id=>students.some(student=>student.id===id)||id===selectedAtLoad);if(selectedAtLoad)next.push(selectedAtLoad);return new Set(next.length?next:students.slice(0,2).map(student=>student.id))});
   const ids=[...new Set([...(selectedAtLoad?[selectedAtLoad]:[]),...students.map(student=>student.id)])];
   loadedIds=ids;
   setBackground(ids.length);
   // Every record loads independently of scroll position. One batched response
   // carries all drive scores and the shared resume parse for each student.
   for(const id of ids)void commit(id).finally(()=>{if(alive)setBackground(value=>Math.max(0,value-1))});
  }).catch(reason=>{if(alive){setError(collegeError(reason));setLoading(false)}});
  const refreshVisible=()=>{if(document.hidden||Date.now()-lastRefresh<30000)return;lastRefresh=Date.now();for(const id of loadedIds.filter(id=>expandedRef.current.has(id)))void commit(id,true)};
  window.addEventListener('focus',refreshVisible);document.addEventListener('visibilitychange',refreshVisible);
  return()=>{alive=false;timers.forEach(clearTimeout);window.removeEventListener('focus',refreshVisible);document.removeEventListener('visibilitychange',refreshVisible)};
 },[academicKey,offset,version]);
 useEffect(()=>saveAssessmentView<ViewState>({expansionMode:globalExpansion.current,contract:"student-ats-v1",draft,filters,offset,showFilters,roster,total,groups,catalog,bundles,ats,historyErrors,expanded:[...expandedStudents],drivePages}),[draft,filters,offset,showFilters,roster,total,groups,catalog,bundles,ats,historyErrors,expandedStudents,drivePages]);
 const refresh=()=>{clearAssessmentCache();setVersion(value=>value+1)};
 const update=<K extends keyof AssessmentFilters>(key:K,value:AssessmentFilters[K])=>setDraft(current=>({...current,[key]:value}));

 const clear=()=>{setDraft({...initialFilters});setFilters({...initialFilters});setOffset(0);setParams(current=>{current.delete('student');current.delete('assessment_drive');return current})};
  const toggleStudent=(id:string)=>{const collapsing=expandedStudents.has(id);setExpandedStudents(current=>{const next=new Set(current);if(next.has(id))next.delete(id);else next.add(id);return next});setParams(current=>{if(collapsing){if(current.get('student')===id)current.delete('student')}else current.set('student',id);current.delete('assessment_drive');return current})};
  const toggleAllStudents=()=>{
   const all=visible.length>0&&visible.every(student=>expandedStudents.has(student.id));
   globalExpansion.current=!all;
   setExpandedStudents(all?new Set():new Set(visible.map(student=>student.id)));
  };
  const openAssessment=(id:string,drive:string)=>{setExpandedStudents(current=>new Set([...current,id]));setParams(current=>{current.set('student',id);current.set('assessment_drive',drive);return current})};
 const closeAssessment=()=>setParams(current=>{current.delete('assessment_drive');return current});
 const selectedBundle=studentId?bundles[studentId]:undefined;
 const selected=selectedBundle?driveHistory(selectedBundle).find(row=>row.drive.drive_id===assessmentDrive):undefined;
 const students=selectedBundle&&!roster.some(student=>student.id===studentId)?[selectedBundle.student,...roster]:roster;
 const visible=students.filter(student=>matchesAssessmentFilters(bundles[student.id],ats,filters));
 const companies=[...new Set(students.flatMap(student=>bundles[student.id]?driveHistory(bundles[student.id]).map(({drive})=>drive.company_name||''):[]).filter(Boolean))].sort();
 const programs=assessmentProgramOptions(catalog.programs,roster.map(student=>student.program));
 const years=catalog.graduation_years.length?catalog.graduation_years:[...new Set(roster.map(student=>student.graduation_year).filter(Boolean))];
 const tags=[filters.minCGPA?`CGPA ≥ ${filters.minCGPA}`:'',filters.program,filters.year?`Class of ${filters.year}`:'',filters.active?'Active students':'',filters.skill?`Skill: ${filters.skill}`:'',filters.minATS?`Avg. ATS ≥ ${filters.minATS}%`:'',filters.minScore?`Best score ≥ ${filters.minScore}`:'',filters.minDrives?`Drives ≥ ${filters.minDrives}`:'',filters.company,filters.driveStatus?displayName(filters.driveStatus):''].filter(Boolean);
 if(scorecard)return <section className="assessment-intelligence"><button className="ai-button" onClick={()=>setScorecard(null)}>← Back to Assessment Intelligence</button><CandidateReport key={`${scorecard.student}:${scorecard.session}`} studentId={scorecard.student} driveId={scorecard.drive} sessionId={scorecard.session} onBack={()=>setScorecard(null)}/></section>;
  return <section className="assessment-intelligence" aria-label="Assessment Intelligence">
  <header className="ai-page-heading"><div><p className="ai-eyebrow">PLACEMENT MANAGEMENT</p><h1>Assessment Intelligence</h1><p>Track student performance, ATS fit, and drive-wise readiness.</p><p>Review resume evidence, interview results, and placement progress in one place.</p></div><div className="ai-heading-actions"><button className="ai-button" onClick={refresh} disabled={loading}><RefreshCw size={15} className={loading?'ai-spin':''}/>Refresh</button></div></header>
  <div className="ai-roster-toolbar"><span>Roster controls</span><RosterExpandControl expanded={visible.length>0&&visible.every(student=>expandedStudents.has(student.id))} onChange={()=>toggleAllStudents()} disabled={!visible.length}/></div>
  <form onSubmit={event=>event.preventDefault()} className="ai-filter-shell">
   <div className="ai-search-toolbar"><label className="ai-search"><Search size={18}/><input aria-label="Search students" value={draft.q} onChange={event=>update('q',event.target.value)} placeholder="Search by name, email, or student ID…"/></label><button type="button" className="ai-button" aria-expanded={showFilters} aria-controls="ai-filter-grid" onClick={()=>setShowFilters(value=>!value)}>{showFilters?'Hide filters':'Show filters'}<ChevronDown size={14}/></button></div>
   {showFilters&&<div id="ai-filter-grid" className="ai-filter-grid">
    <fieldset><legend>Search &amp; tags</legend><p>Quick selections</p>{[{label:'High ATS match',key:'minATS',value:75},{label:'CGPA ≥ 8',key:'minCGPA',value:8},{label:'Interview score ≥ 70',key:'minScore',value:70}].map(tag=><button type="button" key={tag.label} className={`ai-quick-tag ${draft[tag.key as 'minATS'|'minCGPA'|'minScore']===tag.value?'selected':''}`} onClick={()=>setDraft(current=>({...current,[tag.key]:current[tag.key as 'minATS'|'minCGPA'|'minScore']===tag.value?0:tag.value}))}>{tag.label}</button>)}</fieldset>
    <fieldset><legend>Academics</legend><p>CGPA &amp; program</p><label>Minimum CGPA <strong>{draft.minCGPA.toFixed(1)}</strong><input type="range" min="0" max="10" step="0.1" value={draft.minCGPA} onChange={event=>update('minCGPA',Number(event.target.value))}/></label><label>Degree program<select value={draft.program} onChange={event=>update('program',event.target.value)}><option value="">All programs</option>{programs.map(program=><option key={program.value} value={program.value}>{program.label}</option>)}</select></label><label>Graduation year<select value={draft.year} onChange={event=>update('year',event.target.value)}><option value="">All years</option>{years.map(year=><option key={year}>{year}</option>)}</select></label></fieldset>
    <fieldset><legend>Skills</legend><p>Resume requirement evidence</p><label>Requirement keyword<input value={draft.skill} onChange={event=>update('skill',event.target.value)} placeholder="e.g. Python, SQL"/></label><div className="ai-filter-explainer"><FileText size={16}/><span>Search the skills and requirements assessed for each placement drive.</span></div></fieldset>
    <fieldset><legend>Placement readiness</legend><p>Assessment thresholds</p><label>Average ATS fit <strong>{draft.minATS}%</strong><input type="range" min="0" max="100" step="5" value={draft.minATS} onChange={event=>update('minATS',Number(event.target.value))}/></label><label>Best interview score <strong>{draft.minScore}/100</strong><input type="range" min="0" max="100" step="5" value={draft.minScore} onChange={event=>update('minScore',Number(event.target.value))}/></label><small>ATS fit and interview performance measure different aspects of readiness.</small></fieldset>
    <fieldset><legend>Placement history</legend><p>Drives &amp; companies</p><label>Drives recorded<select value={draft.minDrives} onChange={event=>update('minDrives',Number(event.target.value))}><option value="0">Any count</option><option value="1">1 or more</option><option value="3">3 or more</option><option value="5">5 or more</option></select></label><label>Companies<select value={draft.company} onChange={event=>update('company',event.target.value)}><option value="">All companies on this page</option>{companies.map(company=><option key={company}>{company}</option>)}</select></label><label>Drive status<select value={draft.driveStatus} onChange={event=>update('driveStatus',event.target.value)}><option value="">All statuses</option>{['invited','in_progress','completed','expired'].map(status=><option key={status} value={status}>{displayName(status)}</option>)}</select></label></fieldset>
    <fieldset><legend>Advanced</legend><p>Status &amp; participation date</p><label className="ai-checkbox"><input type="checkbox" checked={draft.active} onChange={event=>update('active',event.target.checked)}/>Only active students</label><label>Assigned from<input type="date" value={draft.from} max={draft.to||undefined} onChange={event=>update('from',event.target.value)}/></label><label>Assigned through<input type="date" value={draft.to} min={draft.from||undefined} onChange={event=>update('to',event.target.value)}/></label><button type="button" className="ai-text-button" onClick={clear}>Clear all</button></fieldset>
   </div>}
   <p className="ai-filter-scope">Academic filters search the full roster. Skill, score, company, and history filters apply to the {students.length} records on this page.</p>{draft.from&&draft.to&&draft.from>draft.to&&<p role="alert" className="ai-error">The end date must follow the start date.</p>}
  </form>
  {groups.length>0&&<div className="ai-assigned-groups"><span>Your assigned groups</span>{groups.map((group,index)=><span key={index}>{[group.program,group.department_code,group.batch_label,group.graduation_year].filter(Boolean).join(' · ')}</span>)}</div>}
  <div className="ai-roster-heading"><h2>Student roster <span className="ai-roster-count">{total} Students</span></h2><div className="ai-active-tags">{tags.map(tag=><span key={tag}>{tag}</span>)}{tags.length>0&&<button className="ai-text-button" onClick={clear}><X size={12}/>Clear</button>}</div><p aria-live="polite">{loading?'Loading roster…':`${visible.length} shown · ${total} in roster`}{background>0&&<small>Updating assessments…</small>}</p></div>
  {error&&<div className="ai-empty ai-error" role="alert"><p>{error}</p><button className="ai-button" onClick={refresh}>Retry roster</button></div>}
  {studentId&&historyErrors[studentId]&&!roster.some(student=>student.id===studentId)&&<div className="ai-empty ai-error" role="alert"><p>{historyErrors[studentId]}</p><button className="ai-button" onClick={refresh}>Retry history</button></div>}
  {loading?<div className="ai-empty" role="status">Loading students…</div>:!error&&<div className="ai-student-list">{visible.map(student=>{
   const bundle=bundles[student.id],rows=bundle?driveHistory(bundle):[],summary=bundle?assessmentSummary(bundle,ats):null,expanded=expandedStudents.has(student.id);
   const drivePage=Math.min(drivePages[student.id]||0,Math.max(0,Math.ceil(rows.length/6)-1));
   const visibleDrives=rows.slice(drivePage*6,drivePage*6+6);

   return <article className={`ai-student-card ${expanded?'expanded':''}`} key={student.id}>
    <AssessmentStudentOverview student={student} bundle={bundle} ats={ats} expanded={expanded} onToggle={()=>toggleStudent(student.id)} onProfile={drive=>setProfile({student,drive})} onScorecard={({drive,report})=>{if(report?.session_id)setScorecard({student:student.id,drive:drive.drive_id,session:report.session_id,role:drive.role_title||report.role_title,assessedAt:report.completed_at})}}/>
    {expanded&&<div id={`ai-history-${student.id}`} className="ai-student-history">
     {historyErrors[student.id]?<div className="ai-empty ai-error" role="alert">{historyErrors[student.id]}<button className="ai-button" onClick={refresh}>Retry history</button></div>:!bundle?<p className="ai-inline-loading" role="status">Loading student history…</p>:!rows.length?<div className="ai-empty"><h3>No assessment history yet</h3><p>No placement assignments or drive reports have been recorded for this student.</p></div>:<>
      <div className="ai-history-caption"><span>Current resume ATS fit · all saved interview attempts per drive</span><button className="ai-text-button" onClick={refresh}>Refresh assessments</button></div>
      <PlacementAssessmentTable bundle={bundle} rows={visibleDrives} ats={ats} onATS={drive=>openAssessment(student.id,drive)} onScorecard={({drive,report})=>{if(report?.session_id)setScorecard({student:student.id,drive:drive.drive_id,session:report.session_id,role:drive.role_title||report.role_title,assessedAt:report.completed_at})}} onProfile={drive=>setProfile({student,drive})} onProgress={driveId=>setProgress({bundle,driveId})} onRetry={refresh}/>
      {rows.length>6&&<nav className="ai-drive-pagination" aria-label={`${student.full_name} drive pages`}><span>{drivePage*6+1}–{Math.min(rows.length,drivePage*6+6)} of {rows.length} drives</span><div><button className="ai-button ai-small" disabled={drivePage===0} onClick={()=>setDrivePages(current=>({...current,[student.id]:drivePage-1}))}>Previous drives</button><button className="ai-button ai-small" disabled={(drivePage+1)*6>=rows.length} onClick={()=>setDrivePages(current=>({...current,[student.id]:drivePage+1}))}>Next drives</button></div></nav>}
     </>}
    </div>}
   </article>;
  })}{!visible.length&&!loading&&<div className="ai-empty"><Users size={24}/><h3>{students.length?'No students match these filters':'No students in the roster yet'}</h3><p>{background>0?'Assessment records are still loading. Results update as they arrive.':'Adjust the filters or try a different search.'}</p><button className="ai-button" onClick={clear}>Clear filters</button></div>}</div>}
  <footer className="ai-pagination"><span>Roster page {Math.floor(offset/pageSize)+1} · {Math.min(offset+1,total)}–{Math.min(offset+pageSize,total)} of {total}</span><div><button className="ai-button" disabled={offset===0||loading} onClick={()=>{setOffset(value=>Math.max(0,value-pageSize));setParams(current=>{current.delete('student');current.delete('assessment_drive');return current})}}>Previous</button><button className="ai-button" disabled={offset+pageSize>=total||loading} onClick={()=>{setOffset(value=>value+pageSize);setParams(current=>{current.delete('student');current.delete('assessment_drive');return current})}}>Next</button></div></footer>
  <p className="ai-provenance">ATS values use the same current resume/JD matcher as the student portal. Interview results follow each portal’s release permissions.</p>
  {selectedBundle&&selected&&studentId&&<ATSFitDetails cutoff={ats[atsKey(studentId,selected.drive.drive_id)]?.row?.criteria_ats_fit??selected.drive.criteria_ats_fit} key={`${studentId}:${selected.drive.drive_id}`} driveId={selected.drive.drive_id} drive={null} candidate={{student_id:studentId,full_name:selectedBundle.student.full_name,roll_number:selectedBundle.student.roll_number,email:selectedBundle.student.email,program:selectedBundle.student.program,department_code:selectedBundle.student.department_code||undefined,cgpa:selectedBundle.student.cgpa??undefined,graduation_year:selectedBundle.student.graduation_year,assignment_status:selected.drive.assignment_status,overall_score:selected.report?.overall_score??undefined,readiness:selected.report?.readiness,placement_decision:selected.drive.placement_decision||selected.report?.placement_decision,criteria_interview_score:selected.drive.criteria_interview_score}} initialAssessment={selectedBundle.assessment_contract==='student-ats-v1'&&selectedBundle.assessments?.[selected.drive.drive_id]?{...selectedBundle.assessments[selected.drive.drive_id],resume_sections:selectedBundle.resume_sections,resume_parse_ready:selectedBundle.resume_parse_ready}:undefined} onClose={closeAssessment} onReviewRequirements={()=>setParams(current=>{current.set('view','placements');current.set('drive',selected.drive.drive_id);current.set('section','settings');current.delete('student');current.delete('assessment_drive');return current})}/>}
  {progress&&<AssessmentCoach key={`${progress.bundle.student.id}:${progress.driveId}`} bundle={progress.bundle} driveId={progress.driveId} onClose={closeProgress}/>}
  {profile&&<AssessmentCandidateDetails student={profile.student} bundle={bundles[profile.student.id]} driveId={profile.drive} onClose={()=>setProfile(null)}/>}
  {assessmentDrive&&selectedBundle&&!selected&&<p className="ai-error" role="alert">This drive is not in this student’s placement history.</p>}
 </section>;
}
