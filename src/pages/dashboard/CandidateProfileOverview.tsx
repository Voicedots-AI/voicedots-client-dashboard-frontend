import { BriefcaseBusiness, FileText, GraduationCap, Mail, Phone, UserRound, Users } from 'lucide-react';
import { displayName, formatDateOnly, formatPlacementDateTime } from './placementDisplay';

export type ProfileStudent = {
 id?:string; full_name:string; roll_number:string; email?:string|null; phone?:string|null;
 program?:string|null; department_code?:string|null; department_display_name?:string|null;
 graduation_year?:number|null; batch_label?:string|null; cgpa?:number|string|null;
 overall_attendance?:{percentage:number|null;period:string;source:string|null;as_of_date?:string|null};
 status?:string|null; date_of_birth?:string|null; registration_number?:string|null;
 has_readable_resume?:boolean; current_resume_submission_id?:string|null; resume_submitted_at?:string|null; skills?:string[]|null;
};
export type ProfileContext = {
 college_name?:string|null; program_display_name?:string|null; academic_year?:string|null;
 semester?:number|null; section?:string|null;
 mentor?:{name:string;email?:string|null;phone?:string|null;department?:string;designation?:string;active:boolean}|null;
};
export type PlacementRecord = {
 assignment_id?:string; drive_id:string; company_name:string;role_title:string;assignment_status:string;
 drive_status?:string;drive_type?:string;job_type?:string;location?:string|null;
 package_min_lpa?:number|string|null;package_max_lpa?:number|string|null;package_currency?:string|null;
 attempt_number?:number;max_attempts?:number;preparation_status?:string;evaluation_status?:string;
 assigned_at?:string|null;invited_at?:string|null;started_at?:string|null;completed_at?:string|null;
 deadline_at?:string|null;campaign_opens_at?:string|null;campaign_deadline_at?:string|null;
 window_start_at?:string|null;window_end_at?:string|null;released_to_student_at?:string|null;
 officer_decision?:string|null;decided_at?:string|null;
};
export type ProfileReport = {session_id:string;drive_id?:string|null;overall_score:number|null;completed_at:string;assignment_status?:string;source?:string};
const value=(v:unknown)=>v==null||String(v).trim()===''?'Not recorded':String(v);
const date=(v?:string|null)=>v?formatPlacementDateTime(v):'Not recorded';
export function attendanceLabel(student:ProfileStudent){
 const n=student.overall_attendance?.percentage;
 return typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=100?`${Number(n.toFixed(2))}%`:'Not recorded';
}
export const uniquePlacementRecords=(rows:PlacementRecord[])=>rows.filter((row,index)=>rows.findIndex(other=>other.drive_id===row.drive_id)===index);
export function packageLabel(row:PlacementRecord){
 const min=row.package_min_lpa,max=row.package_max_lpa;
 if(min==null&&max==null)return 'Not recorded';
 return `${min!=null?min:max}${min!=null&&max!=null&&Number(min)!==Number(max)?` – ${max}`:''} LPA${row.package_currency?` · ${row.package_currency}`:''}`;
}
function Details({items}:{items:Array<[string,React.ReactNode]>}){
 return <dl className="c360-details">{items.map(([label,content])=><div key={label}><dt>{label}</dt><dd>{content??'Not recorded'}</dd></div>)}</dl>;
}
export function CandidateProfileOverview({student,context,drives,reports,photo,onPhotoError}:{student:ProfileStudent;context?:ProfileContext;drives:PlacementRecord[];reports:ProfileReport[];photo:string;onPhotoError:()=>void}){
 const placements=uniquePlacementRecords(drives),mentor=context?.mentor;
 const skills=Array.isArray(student.skills)?student.skills.filter(skill=>typeof skill==='string'&&skill.trim()):[];
 const cgpa=student.cgpa!=null&&String(student.cgpa).trim()!==''&&Number.isFinite(Number(student.cgpa))?`${Number(student.cgpa).toFixed(2)} / 10`:'Not recorded';
 return <>
  <section className="candidate-profile-hero c360-hero" aria-label="Student overview">
   <div className="candidate-identity"><span className="candidate-profile-avatar">{photo?<img src={photo} alt={`${student.full_name} profile`} onError={onPhotoError}/>:<span className="candidate-profile-initials">{student.full_name.split(' ').filter(Boolean).slice(0,2).map(part=>part[0]).join('')}</span>}</span>
    <div><p className="candidate-eyebrow">COMPLETE STUDENT PROFILE</p><h1>{student.full_name}</h1><p>{value(student.program)} · {value(student.department_display_name||student.department_code)}</p><div className="c360-identity-tags"><span>{value(student.roll_number)}</span><span>{student.graduation_year?`Class of ${student.graduation_year}`:'Graduation year not recorded'}</span>{student.status&&<span>{displayName(student.status)}</span>}</div></div>
   </div>
   <div className="c360-hero-contact"><p>{value(context?.college_name)}</p>{student.email&&<a href={`mailto:${student.email}`}><Mail size={15}/>{student.email}</a>}{student.phone&&<a href={`tel:${student.phone}`}><Phone size={15}/>{student.phone}</a>}</div>
  </section>
  <div className="c360-summary" aria-label="Placement summary">
   <article><span>Assigned drives</span><strong>{placements.length}</strong><small>Distinct placement assignments</small></article>
   <article><span>Assessment reports</span><strong>{reports.length}</strong><small>Placement and practice history</small></article>
   <article><span>Shortlisted drives</span><strong>{placements.filter(row=>row.officer_decision==='shortlist').length}</strong><small>Recorded officer decisions</small></article>
   <article><span>Placement status</span><strong className="c360-summary-status">{student.status==='placed'?'Placed':'Not recorded'}</strong><small>Confirmed student record</small></article>
  </div>
  <article className="pi-card c360-compact-profile"><h2><GraduationCap size={18}/> Student details</h2><Details items={[
   ['Course / program',value(context?.program_display_name||student.program)],['Branch / department',value(student.department_display_name||student.department_code)],['CGPA',cgpa],['Overall attendance',<span title="Current semester academic attendance; present and on-duty classes count as attended.">{attendanceLabel(student)}</span>],['Graduation year',value(student.graduation_year)],['Batch',value(student.batch_label)],['Academic year',value(context?.academic_year)],['Semester',value(context?.semester)],['Mentor',mentor?.name||(context?'No mentor assignment recorded.':'Not available')],['Email',value(student.email)],['Phone',value(student.phone)],['Resume',student.has_readable_resume?'Available':student.current_resume_submission_id?'Uploaded · parsing unavailable':'Not uploaded'],
  ]}/>{skills.length>0&&<div className="c360-skill-list"><span className="c360-skills-label">Skills</span>{skills.map((skill,index)=><span key={`${skill}-${index}`}>{skill}</span>)}</div>}</article>
 </>;
}
export function CandidatePlacementHistory({drives,reports,onReport}:{drives:PlacementRecord[];reports:ProfileReport[];onReport:(index:number)=>void}){
 const rows=uniquePlacementRecords(drives);
 return <article className="pi-card c360-placement-history"><div className="c360-section-heading"><div><h2><BriefcaseBusiness size={18}/> Placement history</h2><p>Drive participation, assessment history and final officer decisions.</p></div><span>{rows.length} drive{rows.length===1?'':'s'}</span></div>
 {rows.length?<div className="pi-table-wrap"><table><thead><tr><th>Company & role</th><th>Schedule</th><th>Interview progress</th><th>Latest assessed score</th><th>Officer decision</th></tr></thead><tbody>{rows.map(row=>{
  const reportIndex=reports.findIndex(report=>report.drive_id===row.drive_id&&report.session_id),report=reports[reportIndex];
  return <tr key={row.drive_id}><td><strong>{row.company_name}</strong><span>{value(row.role_title)}</span><small>{row.location||'Location not recorded'} · {row.job_type?displayName(row.job_type):'Job type not recorded'}</small><small>{packageLabel(row)}</small></td>
   <td><span>Opens: {date(row.window_start_at||row.campaign_opens_at)}</span><span>Closes: {date(row.window_end_at||row.campaign_deadline_at||row.deadline_at)}</span><small>Assigned: {date(row.assigned_at||row.invited_at)}</small></td>
   <td><span className="c360-status">{displayName(row.assignment_status)||'Not recorded'}</span><span>Attempt {row.attempt_number??1}{row.max_attempts!=null?` of ${row.max_attempts}`:''}</span><small>Evaluation: {displayName(row.evaluation_status)||'Not assessed'}</small></td>
   <td><strong>{report?.overall_score!=null?`${report.overall_score}/100`:'Not assessed'}</strong>{report&&<><small>{date(report.completed_at)}</small><button type="button" className="pi-link" onClick={()=>onReport(reportIndex)}>View assessment</button></>}</td>
   <td><span className="c360-status">{row.officer_decision?displayName(row.officer_decision):Object.prototype.hasOwnProperty.call(row,'officer_decision')?'No decision recorded':'Not available'}</span>{row.decided_at&&<small>{date(row.decided_at)}</small>}<small>{row.released_to_student_at?'Result released to student':'Result not released'}</small></td>
  </tr>;
 })}</tbody></table></div>:<p className="c360-empty">No placement assignments recorded for this student.</p>}</article>;
}
