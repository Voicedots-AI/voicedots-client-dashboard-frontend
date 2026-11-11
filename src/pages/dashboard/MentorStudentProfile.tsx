import {useRef,useState} from 'react';
import {FileText,GraduationCap,UserRound,X} from 'lucide-react';
import {CandidateProfileOverview,attendanceLabel,type ProfileStudent,type ProfileContext} from './CandidateProfileOverview';
import {PagedItems,Empty} from './MentorProgressUI';
import './candidate-directory.css';
import './candidate360-ui.css';
export type MentorStudentSnapshot={student:ProfileStudent;context?:ProfileContext;resumeText?:string|null;academic?:{status?:string;subjects?:{subject:string;exam?:string;marks:number|null;maximum:number|null;semester?:number;grade?:string}[]}|null;drives:{drive_id:string;company_name:string;role_title:string;assignment_status:string;attempt_number?:number;max_attempts?:number;window_start_at?:string;window_end_at?:string;officer_decision?:string}[]};
export default function MentorStudentProfile({profile}:{profile:MentorStudentSnapshot}){
 const dialog=useRef<HTMLDialogElement>(null),[section,setSection]=useState('profile');
 const marks=profile.academic?.subjects||[];
 const open=()=>{setSection('profile');dialog.current?.showModal()};
 return <><div className="mp-student-snapshot"><div><GraduationCap size={19}/><span><small>CGPA</small><b>{profile.student.cgpa==null?'Not recorded':`${profile.student.cgpa} / 10`}</b></span></div><div><span><small>Academic attendance</small><b>{attendanceLabel(profile.student)}</b></span></div><div><FileText size={18}/><span><small>Main Resume</small><b>{profile.student.has_readable_resume?'Available':profile.student.current_resume_submission_id?'Uploaded':'Not uploaded'}</b></span></div><button type="button" onClick={open}><UserRound size={16}/>Student details</button></div>
 <dialog className="mp-profile-dialog" ref={dialog} aria-labelledby="mp-profile-dialog-title"><header><div><span className="mp-eyebrow">ASSIGNED MENTEE · READ ONLY</span><h2 id="mp-profile-dialog-title">{profile.student.full_name}</h2></div><button type="button" autoFocus aria-label="Close student details" onClick={()=>dialog.current?.close()}><X size={19}/></button></header><nav className="mp-view-switch" aria-label="Student detail sections">{[['profile','Profile & academics'],['marks','Academic marks'],['resume','Saved resume']].map(([key,label])=><button type="button" key={key} aria-current={section===key?'page':undefined} onClick={()=>setSection(key)}>{label}</button>)}</nav>
 {section==='profile'&&<div className="candidate-directory placement-scheme candidate360-ui"><CandidateProfileOverview section="academics" student={profile.student} context={profile.context} drives={[]} reports={[]} photo="" onPhotoError={()=>{}}/></div>}
 {section==='marks'&&(marks.length?<PagedItems items={marks} pageSize={6} label="marks">{rows=><div className="mp-academic-table"><table><thead><tr><th>Subject</th><th>Exam</th><th>Semester</th><th>Score</th><th>Grade</th></tr></thead><tbody>{rows.map((row,index)=><tr key={index}><td>{row.subject}</td><td>{row.exam||'Not recorded'}</td><td>{row.semester??'—'}</td><td>{row.marks??'—'} / {row.maximum??'—'}</td><td>{row.grade||'—'}</td></tr>)}</tbody></table></div>}</PagedItems>:<Empty title="No academic marks recorded">Marks appear here when entered in the student’s academic records.</Empty>)}
 {section==='resume'&&(profile.resumeText?<><p className="mp-caption">Text extracted from the student’s saved Main Resume.</p><pre className="mp-resume-text">{profile.resumeText}</pre></>:<Empty title="No readable resume available">The student can upload their Main Resume from their portal.</Empty>)}
 </dialog></>;
}
