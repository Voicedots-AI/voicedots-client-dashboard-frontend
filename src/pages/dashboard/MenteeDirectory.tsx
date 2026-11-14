import CandidateSummaryCard from './MenteeSummaryCard';
import type {ProfileStudent} from './CandidateProfileOverview';
import { AttemptBadge, type CandidateAttempt } from "./CandidateAttemptBadge";
import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowLeft, Search, UserRound, ContactRound, RefreshCw } from 'lucide-react';
import { collegeApi, collegeError } from '@/api/collegeApi';

import { collectCandidatePages, type CandidateDirectoryPage } from './candidate-directory-data';
import './placement-intelligence.css';
import './candidate-directory.css';
import './placement-dashboard-theme.css';
import './placement-intelligence-extension.css';
import './candidate360-ui.css';
import StudentPlacementEvidence from './StudentPlacementEvidence';
import {openCandidate,closeCandidate} from './candidate-profile-navigation';
type Student=CandidateAttempt & ProfileStudent & {id?:string;student_id?:string;full_name:string;roll_number:string;live_session_status?:string;live_session_termination_source?:string;email?:string;program?:string;department_code?:string;graduation_year?:number};
type AssignedGroup={program?:string;department_code?:string;batch_label?:string;graduation_year?:number};
export default function CandidateDirectory({driveId,driveMaxAttempts,onCandidateDetails,mentorView=false,menteeView=mentorView,studentIds}:{studentIds?:string[];menteeView?:boolean;mentorView?:boolean;driveId?:string;driveMaxAttempts?:number;onCandidateDetails?:(candidate:Student)=>void}){
 const [params,setParams]=useSearchParams(),[students,setStudents]=useState<Student[]>([]),[assignedGroups,setAssignedGroups]=useState<AssignedGroup[]>([]),[total,setTotal]=useState(0),[query,setQuery]=useState(''),[search,setSearch]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [directoryPhotos,setDirectoryPhotos]=useState<Record<string,string>>({});
 const candidate=params.get('candidate');
 const scopeKey=studentIds?.join('|');
 const visibleStudents=useMemo(()=>studentIds?students.filter(row=>studentIds.includes(row.student_id||row.id||'')):students,[students,scopeKey]);
 const displayedTotal=studentIds?visibleStudents.length:total;


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
  if(candidate||!visibleStudents.length)return;
  const controller=new AbortController();let next=0;
  const worker=async()=>{
   while(!controller.signal.aborted){
    const student=visibleStudents[next++];if(!student)return;
    const id=student.student_id||student.id;if(!id)continue;
    try{
     const value=await collegeApi.get<{photo?:string}>(mentorView?`mentors/photos/students/${encodeURIComponent(id)}`:`attendance/photos/students/${encodeURIComponent(id)}?optional=true`,controller.signal);
     if(!controller.signal.aborted)setDirectoryPhotos(previous=>({...previous,[id]:value.photo||''}));
    }catch{ /* Optional photos fall back to initials; directory access is unchanged. */ }
   }
  };
  void Promise.all(Array.from({length:Math.min(4,visibleStudents.length)},worker));
  return()=>controller.abort();
 },[visibleStudents,candidate,mentorView]);

 const open=(id:string)=>{setParams(previous=>openCandidate(previous,id));window.scrollTo({top:0,behavior:'instant'})};const back=()=>setParams(closeCandidate);
 return <section className={candidate?"candidate-placement-view":"placement-intelligence candidate-directory placement-scheme candidate360-ui"} aria-label={menteeView?"Mentee 360 profiles":"Candidate 360 profiles"}>
 {candidate?<>
  <header className="c360-profile-toolbar"><button type="button" onClick={back}><ArrowLeft size={17}/>{menteeView?"All mentees":"All candidates"}</button><span>{menteeView?"Mentee 360°":"Candidate 360°"} <span>/</span> Student profile</span></header>
  <StudentPlacementEvidence key={candidate} studentId={candidate} readOnly={mentorView} backLabel={menteeView?"Back to Mentee 360°":undefined}/>

 </>:<>
  <header className="pi-hero c360-directory-hero"><div><p>{menteeView?"MENTEE INTELLIGENCE":"CANDIDATE INTELLIGENCE"}</p><h1>{menteeView?"Mentee 360°":"Candidate 360°"}</h1><span>{menteeView?(mentorView?'Your assigned mentees · Placement assessments and drive progress.':'Institute mentees · Placement assessments and drive progress.'):'Placement profiles, ATS fit, interview evidence and drive progress in one view.'}</span></div><div className="c360-hero-art" aria-hidden="true"><div className="c360-art-card"><ContactRound size={33}/><div><i/><i/><i/></div></div><span><UserRound size={29}/></span></div></header>
  {assignedGroups.length>0&&<section className="pi-card candidate-assigned-groups" aria-label="Your assigned student groups"><h2>Your assigned student groups</h2><p>{assignedGroups.map(group=>[group.program,group.department_code,group.batch_label,group.graduation_year?`Class of ${group.graduation_year}`:null].filter(Boolean).join(' · ')).join('; ')}</p><small>{total} student{total===1?'':'s'} in your assigned groups</small></section>}
  {studentIds===undefined?<form className="pi-filter-panel c360-search-panel" onSubmit={event=>{event.preventDefault();setSearch(query)}}><label>{menteeView?"Search mentees":"Search candidates"}<span className="c360-search-input"><Search size={19}/><input aria-label={menteeView?"Search mentees":"Search candidates"} value={query} onChange={event=>setQuery(event.target.value)} placeholder="Name, student ID or email"/></span></label><button className="pc-primary" type="submit"><Search size={17}/>Search</button><span className="c360-directory-count">{busy?'Loading…':`${displayedTotal} ${menteeView?"mentee":"candidate"}${displayedTotal===1?'':'s'}`}</span></form>:<p className="c360-scope-caption">{displayedTotal} mentee{displayedTotal===1?"":"s"} in this selection</p>}
  {busy&&<p className="c360-list-status" role="status"><RefreshCw size={16}/>Loading {menteeView?"mentees":"candidates"}…</p>}{error&&<p className="pi-error" role="alert">{error}</p>}
  <div className="candidate-card-grid">{visibleStudents.map(student=>{const id=student.student_id||student.id||'';return <CandidateSummaryCard key={id} student={student} photo={directoryPhotos[id]} driveId={driveId} onOpen={()=>open(id)} onPhotoError={()=>setDirectoryPhotos(previous=>({...previous,[id]:''}))}>
   {driveId&&<div className="candidate-attempt"><AttemptBadge candidate={student} driveMaxAttempts={driveMaxAttempts}/></div>}
   {student.live_session_status==='candidate_ended'&&<span className="candidate-ended">{student.live_session_termination_source==='proctor'?'Ended by proctor':'Ended early'}</span>}
   {onCandidateDetails&&<button type="button" className="c360-additional-details" onClick={()=>onCandidateDetails(student)}>Candidate details</button>}
  </CandidateSummaryCard>})}</div>
  {!busy&&!visibleStudents.length&&!error&&<div className="c360-state"><UserRound size={27}/><h3>{menteeView?"No mentees found":"No candidates found"}</h3><p>Try another name, student ID or email.</p>{search&&<button type="button" onClick={()=>{setQuery('');setSearch('')}}>Clear search</button>}</div>}
 </>}
 </section>;
}
