import type {ProfileStudent} from './CandidateProfileOverview';
import {useEffect,useState} from 'react';
import ATSFitAssessment from './ATSFitAssessment';
import {loadCandidateAssessment,type FullAssessment} from './assessmentClient';
import {collegeError} from '@/api/collegeApi';
export default function MentorATSDetails({student,drives}:{student:ProfileStudent&{id:string};drives:{drive_id:string;company_name?:string;role_title?:string}[]}){
 const [selection,setSelection]=useState(''),[result,setResult]=useState<{key:string;data:FullAssessment}|null>(null),[error,setError]=useState('');
 const drive=drives.find(row=>row.drive_id===selection)||drives[0],key=`${student.id}:${drive?.drive_id||''}`;
 useEffect(()=>{if(!drive)return;let active=true;setError('');void loadCandidateAssessment(student.id,drive.drive_id).then(data=>{if(active)setResult({key,data})}).catch(reason=>{if(active)setError(collegeError(reason))});return()=>{active=false}},[student.id,drive?.drive_id,key]);
 if(!drive)return <p className="c360-empty">No placement assignments recorded for this student.</p>;
 return <><label className="candidate-history-row">Placement drive<select value={drive.drive_id} onChange={event=>setSelection(event.target.value)}>{drives.map(row=><option key={row.drive_id} value={row.drive_id}>{row.company_name} · {row.role_title}</option>)}</select></label>{error?<p role="alert">{error}</p>:result?.key===key?<ATSFitAssessment resumeFilePath={`mentors/students/${encodeURIComponent(student.id)}/resume-file`} driveId={drive.drive_id} data={result.data} candidate={{...result.data,student_id:student.id,full_name:student.full_name,email:student.email??undefined,program:student.program??undefined,department_code:student.department_code??undefined,cgpa:student.cgpa==null?null:Number(student.cgpa),graduation_year:student.graduation_year}}/>:<p role="status">Loading saved ATS assessment…</p>}</>;
}
