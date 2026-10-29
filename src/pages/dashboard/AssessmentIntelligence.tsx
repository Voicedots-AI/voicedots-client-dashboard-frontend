import {useEffect,useState,type FormEvent} from 'react';
import {useSearchParams} from 'react-router-dom';
import {ArrowUpRight,ChevronDown,ChevronUp,FileText,Filter,RefreshCw,Search,Users,X,Sparkles} from 'lucide-react';
import {collegeError,type CollegeStudent,type Program} from '@/api/collegeApi';
import {ATSFitDetails} from './DriveManagement';
import CandidateReport from './CandidateReport';
import {displayName,formatPlacementDateTime} from './placementDisplay';
import {assessmentSummary,atsKey,currentATSScore,driveHistory,initialFilters,matchesAssessmentFilters,validScore,type AssessmentATS,type AssessmentFilters,type ATSState} from './assessmentIntelligenceData';
import {cachedAssessmentRequest,peekAssessment,loadStudentAssessment,loadAllStudentAssessments,clearAssessmentCache,readAssessmentView,saveAssessmentView,invalidateStudentAssessment,type FullBundle} from './assessmentClient';
import AssessmentCoach from './AssessmentCoach';
import './assessmentIntelligence.css';

type Roster={items?:CollegeStudent[];total?:number;assigned_groups?:{program?:string;department_code?:string;batch_label?:string;graduation_year?:number}[]};
type ViewState={contract:"student-ats-v1";draft:AssessmentFilters;filters:AssessmentFilters;offset:number;showFilters:boolean;roster:CollegeStudent[];total:number;groups:NonNullable<Roster['assigned_groups']>;catalog:{programs:Program[];graduation_years:number[]};bundles:Record<string,FullBundle>;ats:Record<string,ATSState>;historyErrors:Record<string,string>;expanded:string[];drivePages:Record<string,number>};
const pageSize=25;
const scoreLabel=(value:unknown)=>validScore(value)?`${Math.round(value*10)/10}/100`:'Not assessed';
const date=(value?:string)=>value?formatPlacementDateTime(value):'—';
function StudentAvatar({student}:{student:CollegeStudent}){
 const [photo,setPhoto]=useState<{id:string;url:string}|null>(null);
 useEffect(()=>{if(!student.has_photo)return;const controller=new AbortController();void cachedAssessmentRequest<{photo?:string}>(`attendance/photos/students/${encodeURIComponent(student.id)}?optional=true`).then(result=>{if(!controller.signal.aborted&&result.photo)setPhoto({id:student.id,url:result.photo})}).catch(()=>{});return()=>controller.abort()},[student.id,student.has_photo]);
 const url=photo?.id===student.id?photo.url:null;
 return url?<img className="ai-student-avatar" src={url} alt=""/>:<span className="ai-student-avatar" aria-hidden="true">{student.full_name.split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join('').toUpperCase()||'—'}</span>;
}
function ATSChip({row,loading,onOpen}:{row?:AssessmentATS;loading:boolean;onOpen:()=>void}){
 const score=currentATSScore(row);
 return <button type="button" className={`ai-ats-chip ${score===null?'neutral':score>=75?'good':score>=50?'partial':'low'}`} onClick={onOpen} aria-label={`View ATS Fit ${score===null?'assessment':`${score}%`}`}>{score===null?loading?'Loading…':row?.ats_status==='processing'?'Processing…':'Not assessed':`${score}%`}<ArrowUpRight size={12}/></button>;
}
export default function AssessmentIntelligence(){
 const [params,setParams]=useSearchParams();
 const studentId=params.get('student'),assessmentDrive=params.get('assessment_drive');
 const [saved]=useState(()=>{const value=readAssessmentView<ViewState>();return value?.contract==='student-ats-v1'?value:undefined});
 const [draft,setDraft]=useState<AssessmentFilters>(saved?.draft||{...initialFilters}),[filters,setFilters]=useState<AssessmentFilters>(saved?.filters||{...initialFilters});
 const [showFilters,setShowFilters]=useState(saved?.showFilters??true),[offset,setOffset]=useState(saved?.offset??0),[version,setVersion]=useState(0);
 const [roster,setRoster]=useState<CollegeStudent[]>(saved?.roster||[]),[total,setTotal]=useState(saved?.total||0),[groups,setGroups]=useState<NonNullable<Roster['assigned_groups']>>(saved?.groups||[]);
 const [catalog,setCatalog]=useState<{programs:Program[];graduation_years:number[]}>(saved?.catalog||{programs:[],graduation_years:[]});
 const [bundles,setBundles]=useState<Record<string,FullBundle>>(saved?.bundles||{}),[historyErrors,setHistoryErrors]=useState<Record<string,string>>(saved?.historyErrors||{}),[ats,setATS]=useState<Record<string,ATSState>>(saved?.ats||{});
 const [loading,setLoading]=useState(!saved),[background,setBackground]=useState(0),[error,setError]=useState('');
 const [expandedStudents,setExpandedStudents]=useState<Set<string>>(new Set(saved?.expanded||[]));
 const [drivePages,setDrivePages]=useState<Record<string,number>>(saved?.drivePages||{});
 const [coach,setCoach]=useState<{student:string;drive?:string}|null>(null);
 const [scorecard,setScorecard]=useState<{student:string;drive:string}|null>(null);
 const academicKey=JSON.stringify({q:filters.q,minCGPA:filters.minCGPA,program:filters.program,year:filters.year,active:filters.active});
 useEffect(()=>{
  let alive=true;void cachedAssessmentRequest<{programs:Program[];graduation_years:number[]}>('academic-catalog').then(result=>{if(alive)setCatalog({programs:result.programs||[],graduation_years:result.graduation_years||[]})}).catch(()=>{});return()=>{alive=false};
 },[]);
 useEffect(()=>{
  let alive=true;
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
   setExpandedStudents(current=>{const next=[...current].filter(id=>students.some(student=>student.id===id)||id===selectedAtLoad);if(selectedAtLoad)next.push(selectedAtLoad);return new Set(next.length?next:students.slice(0,2).map(student=>student.id))});
   const ids=[...new Set([...(selectedAtLoad?[selectedAtLoad]:[]),...students.map(student=>student.id)])];
   setBackground(ids.length);
   // Every record loads independently of scroll position. One batched response
   // carries all drive scores and the shared resume parse for each student.
   for(const id of ids)void commit(id).finally(()=>{if(alive)setBackground(value=>Math.max(0,value-1))});
  }).catch(reason=>{if(alive){setError(collegeError(reason));setLoading(false)}});
  return()=>{alive=false;timers.forEach(clearTimeout)};
 },[academicKey,offset,version]);
 useEffect(()=>saveAssessmentView<ViewState>({contract:"student-ats-v1",draft,filters,offset,showFilters,roster,total,groups,catalog,bundles,ats,historyErrors,expanded:[...expandedStudents],drivePages}),[draft,filters,offset,showFilters,roster,total,groups,catalog,bundles,ats,historyErrors,expandedStudents,drivePages]);
 const refresh=()=>{clearAssessmentCache();setVersion(value=>value+1)};
 const update=<K extends keyof AssessmentFilters>(key:K,value:AssessmentFilters[K])=>setDraft(current=>({...current,[key]:value}));
 const apply=(event?:FormEvent)=>{event?.preventDefault();if(draft.from&&draft.to&&draft.from>draft.to)return;setOffset(0);setFilters({...draft});setParams(current=>{current.delete('student');current.delete('assessment_drive');return current})};
 const clear=()=>{setDraft({...initialFilters});setFilters({...initialFilters});setOffset(0);setParams(current=>{current.delete('student');current.delete('assessment_drive');return current})};
 const toggleStudent=(id:string)=>{const collapsing=expandedStudents.has(id);setExpandedStudents(current=>{const next=new Set(current);if(next.has(id))next.delete(id);else next.add(id);return next});setParams(current=>{if(collapsing){if(current.get('student')===id)current.delete('student')}else current.set('student',id);current.delete('assessment_drive');return current})};
 const openAssessment=(id:string,drive:string)=>{setExpandedStudents(current=>new Set([...current,id]));setParams(current=>{current.set('student',id);current.set('assessment_drive',drive);return current})};
 const closeAssessment=()=>setParams(current=>{current.delete('assessment_drive');return current});
 const selectedBundle=studentId?bundles[studentId]:undefined;
 const selected=selectedBundle?driveHistory(selectedBundle).find(row=>row.drive.drive_id===assessmentDrive):undefined;
 const students=selectedBundle&&!roster.some(student=>student.id===studentId)?[selectedBundle.student,...roster]:roster;
 const visible=students.filter(student=>matchesAssessmentFilters(bundles[student.id],ats,filters));
 const companies=[...new Set(students.flatMap(student=>bundles[student.id]?driveHistory(bundles[student.id]).map(({drive})=>drive.company_name||''):[]).filter(Boolean))].sort();
 const programs=catalog.programs.length?catalog.programs.map(program=>program.code):[...new Set(roster.map(student=>student.program).filter(Boolean))];
 const years=catalog.graduation_years.length?catalog.graduation_years:[...new Set(roster.map(student=>student.graduation_year).filter(Boolean))];
 const tags=[filters.minCGPA?`CGPA ≥ ${filters.minCGPA}`:'',filters.program,filters.year?`Class of ${filters.year}`:'',filters.active?'Active students':'',filters.skill?`Skill: ${filters.skill}`:'',filters.minATS?`Avg. ATS ≥ ${filters.minATS}%`:'',filters.minScore?`Best score ≥ ${filters.minScore}`:'',filters.minDrives?`Drives ≥ ${filters.minDrives}`:'',filters.company,filters.driveStatus?displayName(filters.driveStatus):''].filter(Boolean);
 if(scorecard)return <section className="assessment-intelligence"><button className="ai-button" onClick={()=>setScorecard(null)}>← Back to Assessment Intelligence</button><CandidateReport driveId={scorecard.drive} studentId={scorecard.student} onBack={()=>setScorecard(null)}/></section>;
 return <section className="assessment-intelligence" aria-label="Assessment Intelligence">
  <header className="ai-page-heading"><div><p className="ai-eyebrow">PLACEMENT MANAGEMENT</p><h1>Assessment Intelligence</h1><p>Track student performance, ATS fit, and drive-wise readiness.</p><p>Review resume evidence, interview results, and placement progress in one place.</p></div><button className="ai-button" onClick={refresh} disabled={loading}><RefreshCw size={15} className={loading?'ai-spin':''}/>Refresh</button></header>
  <form onSubmit={apply} className="ai-filter-shell">
   <div className="ai-search-toolbar"><label className="ai-search"><Search size={18}/><input aria-label="Search students" value={draft.q} onChange={event=>update('q',event.target.value)} placeholder="Search by name, email, or student ID…"/></label><button type="submit" className="ai-button ai-primary"><Filter size={16}/>Apply filters</button><button type="button" className="ai-button" aria-expanded={showFilters} aria-controls="ai-filter-grid" onClick={()=>setShowFilters(value=>!value)}>{showFilters?'Hide filters':'Show filters'}<ChevronDown size={14}/></button></div>
   {showFilters&&<div id="ai-filter-grid" className="ai-filter-grid">
    <fieldset><legend>Search &amp; tags</legend><p>Quick selections</p>{[{label:'High ATS match',key:'minATS',value:75},{label:'CGPA ≥ 8',key:'minCGPA',value:8},{label:'Interview score ≥ 70',key:'minScore',value:70}].map(tag=><button type="button" key={tag.label} className={`ai-quick-tag ${draft[tag.key as 'minATS'|'minCGPA'|'minScore']===tag.value?'selected':''}`} onClick={()=>setDraft(current=>({...current,[tag.key]:current[tag.key as 'minATS'|'minCGPA'|'minScore']===tag.value?0:tag.value}))}>{tag.label}</button>)}</fieldset>
    <fieldset><legend>Academics</legend><p>CGPA &amp; program</p><label>Minimum CGPA <strong>{draft.minCGPA.toFixed(1)}</strong><input type="range" min="0" max="10" step="0.1" value={draft.minCGPA} onChange={event=>update('minCGPA',Number(event.target.value))}/></label><label>Degree program<select value={draft.program} onChange={event=>update('program',event.target.value)}><option value="">All programs</option>{programs.map(program=><option key={program}>{program}</option>)}</select></label><label>Graduation year<select value={draft.year} onChange={event=>update('year',event.target.value)}><option value="">All years</option>{years.map(year=><option key={year}>{year}</option>)}</select></label></fieldset>
    <fieldset><legend>Skills</legend><p>Resume requirement evidence</p><label>Requirement keyword<input value={draft.skill} onChange={event=>update('skill',event.target.value)} placeholder="e.g. Python, SQL"/></label><div className="ai-filter-explainer"><FileText size={16}/><span>Search the skills and requirements assessed for each placement drive.</span></div></fieldset>
    <fieldset><legend>Placement readiness</legend><p>Assessment thresholds</p><label>Average ATS fit <strong>{draft.minATS}%</strong><input type="range" min="0" max="100" step="5" value={draft.minATS} onChange={event=>update('minATS',Number(event.target.value))}/></label><label>Best interview score <strong>{draft.minScore}/100</strong><input type="range" min="0" max="100" step="5" value={draft.minScore} onChange={event=>update('minScore',Number(event.target.value))}/></label><small>ATS fit and interview performance measure different aspects of readiness.</small></fieldset>
    <fieldset><legend>Placement history</legend><p>Drives &amp; companies</p><label>Drives recorded<select value={draft.minDrives} onChange={event=>update('minDrives',Number(event.target.value))}><option value="0">Any count</option><option value="1">1 or more</option><option value="3">3 or more</option><option value="5">5 or more</option></select></label><label>Companies<select value={draft.company} onChange={event=>update('company',event.target.value)}><option value="">All companies on this page</option>{companies.map(company=><option key={company}>{company}</option>)}</select></label><label>Drive status<select value={draft.driveStatus} onChange={event=>update('driveStatus',event.target.value)}><option value="">All statuses</option>{['invited','in_progress','completed','expired'].map(status=><option key={status} value={status}>{displayName(status)}</option>)}</select></label></fieldset>
    <fieldset><legend>Advanced</legend><p>Status &amp; participation date</p><label className="ai-checkbox"><input type="checkbox" checked={draft.active} onChange={event=>update('active',event.target.checked)}/>Only active students</label><label>Assigned from<input type="date" value={draft.from} max={draft.to||undefined} onChange={event=>update('from',event.target.value)}/></label><label>Assigned through<input type="date" value={draft.to} min={draft.from||undefined} onChange={event=>update('to',event.target.value)}/></label><button type="button" className="ai-text-button" onClick={clear}>Clear all</button></fieldset>
   </div>}
   <p className="ai-filter-scope">Academic filters search the full roster. Skill, score, company, and history filters apply to the {students.length} records on this page.</p>{draft.from&&draft.to&&draft.from>draft.to&&<p role="alert" className="ai-error">The end date must follow the start date.</p>}
  </form>
  {groups.length>0&&<div className="ai-assigned-groups"><span>Your assigned groups</span>{groups.map((group,index)=><span key={index}>{[group.program,group.department_code,group.batch_label,group.graduation_year].filter(Boolean).join(' · ')}</span>)}</div>}
  <div className="ai-roster-heading"><h2><Users size={18}/>Student roster</h2><div className="ai-active-tags">{tags.map(tag=><span key={tag}>{tag}</span>)}{tags.length>0&&<button className="ai-text-button" onClick={clear}><X size={12}/>Clear</button>}</div><p aria-live="polite">{loading?'Loading roster…':`${visible.length} shown · ${total} in roster`}{background>0&&<small>Updating assessments…</small>}</p></div>
  {error&&<div className="ai-empty ai-error" role="alert"><p>{error}</p><button className="ai-button" onClick={refresh}>Retry roster</button></div>}
  {studentId&&historyErrors[studentId]&&!roster.some(student=>student.id===studentId)&&<div className="ai-empty ai-error" role="alert"><p>{historyErrors[studentId]}</p><button className="ai-button" onClick={refresh}>Retry history</button></div>}
  {loading?<div className="ai-empty" role="status">Loading students…</div>:!error&&<div className="ai-student-list">{visible.map(student=>{
   const bundle=bundles[student.id],rows=bundle?driveHistory(bundle):[],summary=bundle?assessmentSummary(bundle,ats):null,expanded=expandedStudents.has(student.id);
   const drivePage=Math.min(drivePages[student.id]||0,Math.max(0,Math.ceil(rows.length/6)-1));
   const visibleDrives=rows.slice(drivePage*6,drivePage*6+6);
   const topReport=rows.find(row=>validScore(row.report?.overall_score));
   return <article className={`ai-student-card ${expanded?'expanded':''}`} key={student.id}>
    <div className="ai-student-overview"><div className="ai-student-identity"><StudentAvatar student={student}/><div><button className="ai-student-name" onClick={()=>toggleStudent(student.id)} aria-expanded={expanded} aria-controls={`ai-history-${student.id}`}>{student.full_name}</button><p>{student.email||student.roll_number}</p></div></div>
     <div className="ai-student-academics"><p>{[student.program,student.department_code,student.graduation_year,student.cgpa!=null?`CGPA ${student.cgpa}`:null].filter(Boolean).map((text,index)=><span key={index}>{text}</span>)}<span className={`ai-status ${student.status==='active'?'good':'neutral'}`}>{displayName(student.status)}</span></p><div className="ai-student-metrics"><span>Drives <b>{summary?.drives??'—'}</b></span><span>Participated <b>{summary?.participated??'—'}</b></span><span title="Average of currently evaluated ATS results only">Avg. ATS <b>{summary?.averageATS!=null?`${Math.round(summary.averageATS)}%`:'—'}</b></span><span>Best score <b>{summary?.bestScore!=null?`${summary.bestScore}/100`:'—'}</b></span></div>{summary&&(summary.pending||summary.failed)&&<small className="ai-data-note">{summary.failed?'Some ATS results unavailable':`ATS: ${summary.assessed} of ${summary.drives} assessed`}</small>}</div>
     <div className="ai-student-performance"><div><span>Best interview score</span><strong>{summary?.bestScore!=null?`${summary.bestScore}%`:'Not assessed'}</strong></div><progress max="100" value={summary?.bestScore??0} aria-label={`${student.full_name} best interview score`}/><div className="ai-student-actions"><button className="ai-button ai-coach-button ai-small" onClick={()=>setCoach({student:student.id})}><Sparkles size={13}/>AI Coach</button><button className="ai-button ai-small" onClick={()=>toggleStudent(student.id)} aria-expanded={expanded}>{expanded?'Collapse':'Expand'}{expanded?<ChevronUp size={13}/>:<ChevronDown size={13}/>}</button><button className="ai-button ai-primary ai-small" disabled={!topReport} onClick={()=>topReport&&setScorecard({student:student.id,drive:topReport.drive.drive_id})}><FileText size={13}/>View scorecards</button></div></div>
    </div>
    {expanded&&<div id={`ai-history-${student.id}`} className="ai-student-history">
     {historyErrors[student.id]?<div className="ai-empty ai-error" role="alert">{historyErrors[student.id]}<button className="ai-button" onClick={refresh}>Retry history</button></div>:!bundle?<p className="ai-inline-loading" role="status">Loading student history…</p>:!rows.length?<div className="ai-empty"><h3>No assessment history yet</h3><p>No placement assignments or drive reports have been recorded for this student.</p></div>:<>
      <div className="ai-history-caption"><span>Current resume ATS fit · latest recorded interview per drive</span><button className="ai-text-button" onClick={refresh}>Refresh assessments</button></div>
      <div className="ai-drive-table-wrap"><table className="ai-drive-table"><caption className="ai-sr-only">{student.full_name} placement assessment history</caption><thead><tr>{['Drive / company','Interview window','ATS Fit','Scorecard','Interview status','Readiness','Actions'].map(label=><th key={label} scope="col">{label}</th>)}</tr></thead><tbody>{visibleDrives.map(({drive,report})=>{
       const state=ats[atsKey(student.id,drive.drive_id)];
       return <tr key={drive.drive_id}><td><strong>{drive.company_name||report?.company_name||'Company unavailable'}</strong><small>{drive.role_title||report?.role_title||'Role unavailable'}</small></td><td>{drive.campaign_opens_at?`${date(drive.campaign_opens_at)} – ${date(drive.campaign_deadline_at)}`:'Not supplied'}<small>Assigned {date(drive.assigned_at)}</small></td><td><ATSChip row={state?.row} loading={!state} onOpen={()=>openAssessment(student.id,drive.drive_id)}/>{state?.error&&<button className="ai-text-button ai-error" title={state.error} onClick={refresh}>Retry ATS</button>}</td><td>{scoreLabel(report?.overall_score)}</td><td><span className={`ai-status ${drive.assignment_status==='completed'?'good':drive.assignment_status==='in_progress'?'partial':'neutral'}`}>{displayName(drive.assignment_status||report?.assignment_status||drive.drive_status||'not_assessed')}</span></td><td>{report?.readiness?displayName(report.readiness):'Not assessed'}</td><td><div className="ai-drive-actions"><button className="ai-text-button" onClick={()=>setCoach({student:student.id,drive:drive.drive_id})}><Sparkles size={12}/>AI Coach</button><button className="ai-text-button" onClick={()=>openAssessment(student.id,drive.drive_id)}>ATS assessment <ArrowUpRight size={12}/></button>{report&&<button className="ai-text-button" onClick={()=>setScorecard({student:student.id,drive:drive.drive_id})}>View scorecard <ArrowUpRight size={12}/></button>}</div></td></tr>;
      })}</tbody></table></div>{rows.length>6&&<nav className="ai-drive-pagination" aria-label={`${student.full_name} drive pages`}><span>{drivePage*6+1}–{Math.min(rows.length,drivePage*6+6)} of {rows.length} drives</span><div><button className="ai-button ai-small" disabled={drivePage===0} onClick={()=>setDrivePages(current=>({...current,[student.id]:drivePage-1}))}>Previous drives</button><button className="ai-button ai-small" disabled={(drivePage+1)*6>=rows.length} onClick={()=>setDrivePages(current=>({...current,[student.id]:drivePage+1}))}>Next drives</button></div></nav>}
     </>}
    </div>}
   </article>;
  })}{!visible.length&&!loading&&<div className="ai-empty"><Users size={24}/><h3>{students.length?'No students match these filters':'No students in the roster yet'}</h3><p>{background>0?'Assessment records are still loading. Results update as they arrive.':'Adjust the filters or try a different search.'}</p><button className="ai-button" onClick={clear}>Clear filters</button></div>}</div>}
  <footer className="ai-pagination"><span>Roster page {Math.floor(offset/pageSize)+1} · {Math.min(offset+1,total)}–{Math.min(offset+pageSize,total)} of {total}</span><div><button className="ai-button" disabled={offset===0||loading} onClick={()=>{setOffset(value=>Math.max(0,value-pageSize));setParams(current=>{current.delete('student');current.delete('assessment_drive');return current})}}>Previous</button><button className="ai-button" disabled={offset+pageSize>=total||loading} onClick={()=>{setOffset(value=>value+pageSize);setParams(current=>{current.delete('student');current.delete('assessment_drive');return current})}}>Next</button></div></footer>
  <p className="ai-provenance">ATS values use the same current resume/JD matcher as the student portal. Interview results follow each portal’s release permissions.</p>
  {selectedBundle&&selected&&studentId&&<ATSFitDetails key={`${studentId}:${selected.drive.drive_id}`} driveId={selected.drive.drive_id} drive={null} candidate={{student_id:studentId,full_name:selectedBundle.student.full_name,roll_number:selectedBundle.student.roll_number,email:selectedBundle.student.email,program:selectedBundle.student.program,department_code:selectedBundle.student.department_code||undefined,cgpa:selectedBundle.student.cgpa??undefined,graduation_year:selectedBundle.student.graduation_year,assignment_status:selected.drive.assignment_status}} initialAssessment={selectedBundle.assessment_contract==='student-ats-v1'&&selectedBundle.assessments?.[selected.drive.drive_id]?{...selectedBundle.assessments[selected.drive.drive_id],resume_sections:selectedBundle.resume_sections,resume_parse_ready:selectedBundle.resume_parse_ready}:undefined} onClose={closeAssessment} onOpenCoach={()=>setCoach({student:studentId,drive:selected.drive.drive_id})} onReviewRequirements={()=>setParams(current=>{current.set('view','placements');current.set('drive',selected.drive.drive_id);current.set('section','settings');current.delete('student');current.delete('assessment_drive');return current})}/>}
  {coach&&bundles[coach.student]&&<AssessmentCoach bundle={bundles[coach.student]} driveId={coach.drive} onClose={()=>setCoach(null)}/>}
  {assessmentDrive&&selectedBundle&&!selected&&<p className="ai-error" role="alert">This drive is not in this student’s placement history.</p>}
 </section>;
}
