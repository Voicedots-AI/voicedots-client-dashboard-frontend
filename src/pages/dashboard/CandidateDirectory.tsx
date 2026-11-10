import StudentScorecard from './StudentScorecard';
import CandidateSummaryCard from './CandidateSummaryCard';
import { CandidateProfileOverview, CandidatePlacementHistory, type ProfileStudent, type ProfileContext, type PlacementRecord } from './CandidateProfileOverview';
import { displayName } from './placementDisplay';
import { AttemptBadge, type CandidateAttempt } from "./CandidateAttemptBadge";
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Download, Search, UserRound, FileText } from 'lucide-react';
import { collegeApi, collegeError } from '@/api/collegeApi';

import CandidateReport from './CandidateReport';
import { collectCandidatePages, type CandidateDirectoryPage } from './candidate-directory-data';
import './placement-intelligence.css';
import './candidate-directory.css';
import './placement-dashboard-theme.css';
import './placement-intelligence-extension.css';
type Student=CandidateAttempt & ProfileStudent & {id?:string;student_id?:string;full_name:string;roll_number:string;live_session_status?:string;live_session_termination_source?:string;email?:string;program?:string;department_code?:string;graduation_year?:number};
type AssignedGroup={program?:string;department_code?:string;batch_label?:string;graduation_year?:number};
type Report={session_id:string;drive_id?:string;role_title?:string;completed_at:string;label:string;overall_score:number|null;readiness?:string;detail:Record<string,any>};
type Bundle={student:Student;reports:Report[];drives:PlacementRecord[];profile_context?:ProfileContext};
export default function CandidateDirectory({driveId,driveMaxAttempts,onCandidateDetails}:{driveId?:string;driveMaxAttempts?:number;onCandidateDetails?:(candidate:Student)=>void}){
 const [params,setParams]=useSearchParams(),[students,setStudents]=useState<Student[]>([]),[assignedGroups,setAssignedGroups]=useState<AssignedGroup[]>([]),[total,setTotal]=useState(0),[query,setQuery]=useState(''),[search,setSearch]=useState(''),[bundle,setBundle]=useState<Bundle|null>(null),[index,setIndex]=useState(0),[busy,setBusy]=useState(false),[error,setError]=useState(''),[full,setFull]=useState(false),[photo,setPhoto]=useState(''),[targets,setTargets]=useState<Record<string,Record<string,number>>>({});
 const [directoryPhotos,setDirectoryPhotos]=useState<Record<string,string>>({});
 const candidate=params.get('candidate');
 useEffect(()=>{setPhoto('');if(!candidate)return;const c=new AbortController();collegeApi.get<{photo?:string}>(`attendance/photos/students/${encodeURIComponent(candidate)}?optional=true`,c.signal).then(v=>{if(!c.signal.aborted)setPhoto(v.photo||'')}).catch(()=>{});return()=>c.abort()},[candidate]);
 useEffect(()=>{
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
 },[driveId,search]);
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
 useEffect(()=>{if(!candidate){setBundle(null);return}const c=new AbortController();setBusy(true);setError('');setBundle(null);setFull(false);collegeApi.get<Bundle>(`students/${encodeURIComponent(candidate)}/reports?profile=true`,c.signal).then(v=>{if(!c.signal.aborted){if(String(v.student?.id)!==candidate)throw new Error('The returned profile does not match the selected student. Please retry.');setBundle(v);const first=driveId?v.reports.findIndex(r=>r.drive_id===driveId):0;setIndex(Math.max(0,first))}}).catch(e=>{if(!c.signal.aborted)setError(collegeError(e))}).finally(()=>{if(!c.signal.aborted)setBusy(false)});return()=>c.abort()},[candidate,driveId]);
 useEffect(()=>{const c=new AbortController();collegeApi.get<{role_targets:Record<string,Record<string,number>>}>('intelligence/settings',c.signal).then(v=>setTargets(v.role_targets||{})).catch(()=>{});return()=>c.abort()},[]);
 const open=(id:string)=>setParams(p=>{p.set('candidate',id);return p});const back=()=>{setFull(false);setParams(p=>{p.delete('candidate');return p})};
 const report=bundle?.reports[index];
 if(full&&report?.drive_id&&candidate)return <CandidateReport driveId={report.drive_id} studentId={candidate} onBack={()=>setFull(false)}/>;
 const breakdown:Record<string,number|null>=report?.detail.score_breakdown||Object.fromEntries([...(report?.detail.core_dimensions||[]),...(report?.detail.domain_dimensions||[])].map(d=>[String(d.dimension||'').toLowerCase().replaceAll(' ','_'),d.percentage??null]));
 const csv=()=>{if(!bundle)return;const quote=(v:unknown)=>`"${(/^[=+@-]/.test(String(v??''))?"'":'')+String(v??'').replaceAll('"','""')}"`;const content=[['Candidate',bundle.student.full_name],['Role',report?.role_title||''],['Competency','Score','Role target'],...Object.entries(breakdown).map(([k,v])=>[k,v,targets[report?.role_title||'']?.[k]??'Not configured'])].map(r=>r.map(quote).join(',')).join('\r\n');const blob=new Blob([content],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='candidate-scorecard.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
 return <section className="placement-intelligence candidate-directory placement-scheme" aria-label="Candidate 360 profiles">
 {candidate?<><header className="pi-card-heading"><button onClick={back}><ArrowLeft size={16}/> Candidates</button><h2>Candidate 360° Profile</h2>{report&&<button className="pc-primary" onClick={csv}><Download size={16}/> Download scorecard</button>}</header>{busy&&<p role="status">Loading candidate profile…</p>}{error&&<p className="pi-error" role="alert">{error}</p>}{bundle&&<><CandidateProfileOverview student={bundle.student} context={bundle.profile_context} drives={bundle.drives} reports={bundle.reports} photo={photo} onPhotoError={()=>setPhoto('')}/>
 <CandidatePlacementHistory drives={bundle.drives} reports={bundle.reports} onReport={selected=>{setIndex(selected);const details=document.getElementById('candidate-scorecards');if(details instanceof HTMLDetailsElement)details.open=true;requestAnimationFrame(()=>document.getElementById('candidate-assessment')?.scrollIntoView({behavior:'smooth',block:'start'}))}}/>
 <details className="pi-card c360-scorecards" id="candidate-scorecards"><summary>Interview scorecards &amp; review</summary><div className="candidate-history-row" id="candidate-assessment"><label>Interview history<select aria-label="Candidate interview history" value={index} onChange={e=>setIndex(Number(e.target.value))}>{bundle.reports.map((r,i)=><option value={i} key={r.session_id}>{r.label} · {new Date(r.completed_at).toLocaleDateString()}</option>)}{!bundle.reports.length&&<option>No completed assessments</option>}</select></label>{report?.drive_id&&<button onClick={()=>setFull(true)}><FileText size={17}/> Officer review & release controls</button>}</div>
 {report?.session_id?<StudentScorecard studentId={candidate!} sessionId={report.session_id} role={report.role_title} assessedAt={report.completed_at}/>:<article className="pi-card"><h2>No completed assessments yet</h2><p>Competency scores and development recommendations will appear after an interview is assessed.</p></article>}
</details></> }</>:<><header className="pi-hero"><div><p>CANDIDATE INTELLIGENCE</p><h1>Candidate 360°</h1><span>Student profiles, academic details, placement participation and interview evidence.</span></div><UserRound size={45}/></header>{assignedGroups.length>0&&<section className="pi-card candidate-assigned-groups" aria-label="Your assigned student groups"><h2>Your assigned student groups</h2><p>{assignedGroups.map(group=>[group.program,group.department_code,group.batch_label,group.graduation_year?`Class of ${group.graduation_year}`:null].filter(Boolean).join(" · ")).join("; ")}</p><small>{total} student{total===1?"":"s"} in your assigned groups</small></section>}<form className="pi-filter-panel" onSubmit={e=>{e.preventDefault();setSearch(query)}}><label>Search candidates<input aria-label="Search candidates" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Name, student ID or email"/></label><button className="pc-primary" type="submit"><Search size={16}/> Search</button><span>{total} candidates</span></form>{busy&&<p role="status">Loading candidates…</p>}{error&&<p className="pi-error" role="alert">{error}</p>}<div className="candidate-card-grid">{students.map(s=>{const id=s.student_id||s.id||'';return <CandidateSummaryCard key={id} student={s} photo={directoryPhotos[id]} driveId={driveId} onOpen={()=>open(id)} onPhotoError={()=>setDirectoryPhotos(previous=>({...previous,[id]:''}))}>
 {driveId&&<div className="candidate-attempt"><AttemptBadge candidate={s} driveMaxAttempts={driveMaxAttempts}/></div>}
 {s.live_session_status==='candidate_ended'&&<span className="candidate-ended">{s.live_session_termination_source==='proctor'?'Ended by proctor':'Ended early'}</span>}
 {onCandidateDetails&&<button className="c360-additional-details" onClick={()=>onCandidateDetails(s)}>Candidate details</button>}
 </CandidateSummaryCard>})}{!busy&&!students.length&&!error&&<p className="pi-card">No candidates match this selection.</p>}</div></>}
 </section>;
}
