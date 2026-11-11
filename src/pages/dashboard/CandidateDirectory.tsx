import StudentScorecard from './StudentScorecard';
import CandidateSummaryCard from './CandidateSummaryCard';
import { CandidateProfileOverview, CandidatePlacementHistory, type ProfileStudent, type ProfileContext, type PlacementRecord } from './CandidateProfileOverview';
import { displayName } from './placementDisplay';
import { AttemptBadge, type CandidateAttempt } from "./CandidateAttemptBadge";
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Download, Search, UserRound, FileText, ContactRound, LayoutDashboard, GraduationCap, BriefcaseBusiness, WalletCards, RefreshCw } from 'lucide-react';
import { collegeApi, collegeError } from '@/api/collegeApi';

import CandidateReport from './CandidateReport';
import { collectCandidatePages, type CandidateDirectoryPage } from './candidate-directory-data';
import './placement-intelligence.css';
import './candidate-directory.css';
import './placement-dashboard-theme.css';
import './placement-intelligence-extension.css';
import './candidate360-ui.css';
import CandidateFees from './CandidateFees';
import {candidateProfileTab,candidateReportIndex,openCandidate,closeCandidate,type CandidateProfileTab} from './candidate-profile-navigation';
type Student=CandidateAttempt & ProfileStudent & {id?:string;student_id?:string;full_name:string;roll_number:string;live_session_status?:string;live_session_termination_source?:string;email?:string;program?:string;department_code?:string;graduation_year?:number};
type AssignedGroup={program?:string;department_code?:string;batch_label?:string;graduation_year?:number};
type Report={session_id:string;drive_id?:string;role_title?:string;completed_at:string;label:string;overall_score:number|null;readiness?:string;detail:Record<string,any>};
type Bundle={student:Student;reports:Report[];drives:PlacementRecord[];profile_context?:ProfileContext};
export default function CandidateDirectory({driveId,driveMaxAttempts,onCandidateDetails}:{driveId?:string;driveMaxAttempts?:number;onCandidateDetails?:(candidate:Student)=>void}){
 const [params,setParams]=useSearchParams(),[students,setStudents]=useState<Student[]>([]),[assignedGroups,setAssignedGroups]=useState<AssignedGroup[]>([]),[total,setTotal]=useState(0),[query,setQuery]=useState(''),[search,setSearch]=useState(''),[bundle,setBundle]=useState<Bundle|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[full,setFull]=useState(false),[photo,setPhoto]=useState(''),[targets,setTargets]=useState<Record<string,Record<string,number>>>({});
 const [directoryPhotos,setDirectoryPhotos]=useState<Record<string,string>>({});
 const candidate=params.get('candidate'),profileTab=candidateProfileTab(params.get('candidateTab'));
 const [profileBusy,setProfileBusy]=useState(false),[profileVersion,setProfileVersion]=useState(0);
 const showTab=(tab:CandidateProfileTab,session?:string)=>setParams(previous=>{const next=new URLSearchParams(previous);next.set('candidateTab',tab);if(session)next.set('candidateAttempt',session);return next});
 const index=candidateReportIndex(bundle?.student.id===candidate?bundle.reports:[],params.get('candidateAttempt'),driveId);
 useEffect(()=>{setFull(false)},[candidate,profileTab,params.get('candidateAttempt')]);
 const setIndex=(index:number)=>{const selected=bundle?.reports[index];if(selected)showTab('assessments',selected.session_id)};

 useEffect(()=>{setPhoto('');if(!candidate)return;const c=new AbortController();collegeApi.get<{photo?:string}>(`attendance/photos/students/${encodeURIComponent(candidate)}?optional=true`,c.signal).then(v=>{if(!c.signal.aborted)setPhoto(v.photo||'')}).catch(()=>{});return()=>c.abort()},[candidate]);
 useEffect(()=>{
  if(candidate)return;
  const controller=new AbortController();setBusy(true);setError('');setStudents([]);setAssignedGroups([]);setTotal(0);setDirectoryPhotos({});
  collectCandidatePages<Student,AssignedGroup>(async(offset,limit)=>{
   const qs=new URLSearchParams({limit:String(limit),offset:String(offset)});
   if(search)qs.set('q',search);
   const path=driveId?`drives/${encodeURIComponent(driveId)}/dashboard/ranking?${qs}`:`students?${qs}`;
   return collegeApi.get<CandidateDirectoryPage<Student,AssignedGroup>>(path,controller.signal);
  },controller.signal).then(result=>{if(!controller.signal.aborted){setStudents(result.students);setAssignedGroups(result.assignedGroups);setTotal(result.total);}})
   .catch(cause=>{if(!controller.signal.aborted)setError(collegeError(cause));})
   .finally(()=>{if(!controller.signal.aborted)setBusy(false);});
  return()=>controller.abort();
 },[driveId,search,candidate]);
 useEffect(()=>{
  if(candidate||!students.length)return;
  const controller=new AbortController();let next=0;
  const worker=async()=>{
   while(!controller.signal.aborted){
    const student=students[next++];if(!student)return;
    const id=student.student_id||student.id;if(!id)continue;
    try{
     const value=await collegeApi.get<{photo?:string}>(`attendance/photos/students/${encodeURIComponent(id)}?optional=true`,controller.signal);
     if(!controller.signal.aborted)setDirectoryPhotos(previous=>({...previous,[id]:value.photo||''}));
    }catch{ /* Optional photos fall back to initials; directory access is unchanged. */ }
   }
  };
  void Promise.all(Array.from({length:Math.min(4,students.length)},worker));
  return()=>controller.abort();
 },[students,candidate]);
 useEffect(()=>{if(!candidate){setBundle(null);return}const c=new AbortController();setProfileBusy(true);setError('');setBundle(null);setFull(false);collegeApi.get<Bundle>(`students/${encodeURIComponent(candidate)}/reports?profile=true`,c.signal).then(value=>{if(!c.signal.aborted){if(String(value.student?.id)!==candidate)throw new Error('The returned profile does not match the selected student. Please retry.');setBundle(value)}}).catch(error=>{if(!c.signal.aborted)setError(collegeError(error))}).finally(()=>{if(!c.signal.aborted)setProfileBusy(false)});return()=>c.abort()},[candidate,driveId,profileVersion]);
 useEffect(()=>{const c=new AbortController();collegeApi.get<{role_targets:Record<string,Record<string,number>>}>('intelligence/settings',c.signal).then(v=>setTargets(v.role_targets||{})).catch(()=>{});return()=>c.abort()},[]);
 const open=(id:string)=>{setParams(previous=>openCandidate(previous,id));window.scrollTo({top:0,behavior:'instant'})};const back=()=>{setFull(false);setParams(closeCandidate)};
 const report=bundle?.student.id===candidate?bundle.reports[index]:undefined;
 if(full&&profileTab==='assessments'&&report?.drive_id&&candidate)return <CandidateReport driveId={report.drive_id} studentId={candidate} onBack={()=>setFull(false)}/>;
 const breakdown:Record<string,number|null>=report?.detail.score_breakdown||Object.fromEntries([...(report?.detail.core_dimensions||[]),...(report?.detail.domain_dimensions||[])].map(d=>[String(d.dimension||'').toLowerCase().replaceAll(' ','_'),d.percentage??null]));
 const csv=()=>{if(!bundle)return;const quote=(v:unknown)=>`"${(/^[=+@-]/.test(String(v??''))?"'":'')+String(v??'').replaceAll('"','""')}"`;const content=[['Candidate',bundle.student.full_name],['Role',report?.role_title||''],['Competency','Score','Role target'],...Object.entries(breakdown).map(([k,v])=>[k,v,targets[report?.role_title||'']?.[k]??'Not configured'])].map(r=>r.map(quote).join(',')).join('\r\n');const blob=new Blob([content],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='candidate-scorecard.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
 return <section className="placement-intelligence candidate-directory placement-scheme candidate360-ui" aria-label="Candidate 360 profiles">
 {candidate?<>
  <header className="c360-profile-toolbar"><button type="button" onClick={back}><ArrowLeft size={17}/>All candidates</button><span>Candidate 360° <span>/</span> Student profile</span>{report&&<button type="button" className="c360-download" onClick={csv}><Download size={16}/>Download selected scorecard</button>}</header>
  {profileBusy&&<div className="c360-state" role="status"><RefreshCw size={25}/><h3>Loading candidate profile</h3><p>Fetching saved student records and assessment evidence.</p></div>}
  {error&&<div className="c360-state" role="alert"><h3>Profile unavailable</h3><p>{error}</p><button type="button" onClick={()=>setProfileVersion(value=>value+1)}><RefreshCw size={16}/>Try again</button></div>}
  {bundle&&String(bundle.student.id)===candidate&&!error&&<>
   <CandidateProfileOverview section="identity" student={bundle.student} context={bundle.profile_context} drives={bundle.drives} reports={bundle.reports} photo={photo} onPhotoError={()=>setPhoto('')}/>
   <nav className="c360-profile-tabs" aria-label="Candidate profile sections">{([
    ['overview','Overview',LayoutDashboard],['academics','Academics',GraduationCap],['placement','Placement',BriefcaseBusiness],['assessments','Assessments',FileText],['fees','Fees',WalletCards],
   ] as const).map(([key,label,Icon])=><button type="button" key={key} aria-current={profileTab===key?'page':undefined} className={profileTab===key?'is-selected':''} onClick={()=>showTab(key)}><Icon size={18}/>{label}{key==='placement'&&<span>{new Set(bundle.drives.map(d=>d.drive_id)).size}</span>}{key==='assessments'&&<span>{bundle.reports.length}</span>}</button>)}</nav>
   <div className="c360-profile-content" key={`${candidate}-${profileTab}`}>
    {(profileTab==='overview'||profileTab==='academics')&&<CandidateProfileOverview section={profileTab} student={bundle.student} context={bundle.profile_context} drives={bundle.drives} reports={bundle.reports} photo={photo} onPhotoError={()=>setPhoto('')}/>}
    {profileTab==='placement'&&<CandidatePlacementHistory drives={bundle.drives} reports={bundle.reports} onReport={setIndex}/>}
    {profileTab==='assessments'&&<><header className="c360-section-title"><div><span className="c360-section-icon"><FileText size={22}/></span><div><h2>Interview assessments</h2><p>Choose an attempt to review its exact saved scorecard.</p></div></div></header><div className="candidate-history-row" id="candidate-assessment"><label>Interview history<select aria-label="Candidate interview history" value={index} disabled={!bundle.reports.length} onChange={event=>setIndex(Number(event.target.value))}>{index<0&&bundle.reports.length>0&&<option value={-1}>No assessed interview for this drive</option>}{bundle.reports.map((row,i)=><option value={i} key={row.session_id}>{row.label} · {new Date(row.completed_at).toLocaleDateString('en-IN')}</option>)}{!bundle.reports.length&&<option value={-1}>No completed assessments</option>}</select></label>{report?.drive_id&&<button type="button" onClick={()=>setFull(true)}><FileText size={17}/>Officer review & release controls</button>}</div>
     {report?.session_id?<StudentScorecard key={`${candidate}-${report.session_id}`} studentId={candidate} sessionId={report.session_id} role={report.role_title} assessedAt={report.completed_at}/>:<article className="c360-state"><FileText size={27}/><h3>No completed assessments yet</h3><p>Competency scores and development recommendations appear after an interview is assessed.</p></article>}
    </>}
    {profileTab==='fees'&&<CandidateFees key={candidate} studentId={candidate}/>}
   </div>
  </>}
 </>:<>
  <header className="pi-hero c360-directory-hero"><div><p>CANDIDATE INTELLIGENCE</p><h1>Candidate 360°</h1><span>Student profiles, academic details, placement participation and interview evidence.</span></div><div className="c360-hero-art" aria-hidden="true"><div className="c360-art-card"><ContactRound size={33}/><div><i/><i/><i/></div></div><span><UserRound size={29}/></span></div></header>
  {assignedGroups.length>0&&<section className="pi-card candidate-assigned-groups" aria-label="Your assigned student groups"><h2>Your assigned student groups</h2><p>{assignedGroups.map(group=>[group.program,group.department_code,group.batch_label,group.graduation_year?`Class of ${group.graduation_year}`:null].filter(Boolean).join(' · ')).join('; ')}</p><small>{total} student{total===1?'':'s'} in your assigned groups</small></section>}
  <form className="pi-filter-panel c360-search-panel" onSubmit={event=>{event.preventDefault();setSearch(query)}}><label>Search candidates<span className="c360-search-input"><Search size={19}/><input aria-label="Search candidates" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Name, student ID or email"/></span></label><button className="pc-primary" type="submit"><Search size={17}/>Search</button><span className="c360-directory-count">{busy?'Loading…':`${total} candidate${total===1?'':'s'}`}</span></form>
  {busy&&<p className="c360-list-status" role="status"><RefreshCw size={16}/>Loading candidates…</p>}{error&&<p className="pi-error" role="alert">{error}</p>}
  <div className="candidate-card-grid">{students.map(student=>{const id=student.student_id||student.id||'';return <CandidateSummaryCard key={id} student={student} photo={directoryPhotos[id]} driveId={driveId} onOpen={()=>open(id)} onPhotoError={()=>setDirectoryPhotos(previous=>({...previous,[id]:''}))}>
   {driveId&&<div className="candidate-attempt"><AttemptBadge candidate={student} driveMaxAttempts={driveMaxAttempts}/></div>}
   {student.live_session_status==='candidate_ended'&&<span className="candidate-ended">{student.live_session_termination_source==='proctor'?'Ended by proctor':'Ended early'}</span>}
   {onCandidateDetails&&<button type="button" className="c360-additional-details" onClick={()=>onCandidateDetails(student)}>Candidate details</button>}
  </CandidateSummaryCard>})}</div>
  {!busy&&!students.length&&!error&&<div className="c360-state"><UserRound size={27}/><h3>No candidates found</h3><p>Try another name, student ID or email.</p>{search&&<button type="button" onClick={()=>{setQuery('');setSearch('')}}>Clear search</button>}</div>}
 </>}
 </section>;
}
