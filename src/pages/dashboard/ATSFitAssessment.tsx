import {useState} from 'react';
import {Download,Sparkles} from 'lucide-react';
import {collegeApi,collegeError} from '@/api/collegeApi';
import {SharedATSFit,type AssessmentStudent} from '@/shared-assessment/ATSFit';
import './atsFitAssessment.css';
type Data=Record<string,unknown>;
type Candidate=Data&AssessmentStudent&{student_id:string;full_name:string};
export default function ATSFitAssessment({driveId,candidate,data,onReviewRequirements,localPreview=false,onOpenCoach}:{driveId:string;candidate:Candidate;data:Data;onReviewRequirements:()=>void;localPreview?:boolean;onOpenCoach?:()=>void}){
 const [error,setError]=useState(''),[busy,setBusy]=useState(false);
 const download=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download=`${driveId}-ats-assessment.json`;link.click();URL.revokeObjectURL(url)};
 const resume=async()=>{setBusy(true);setError('');try{const blob=await collegeApi.file(`drives/${encodeURIComponent(driveId)}/candidates/${encodeURIComponent(candidate.student_id)}/resume-file`);const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download='resume.pdf';link.click();URL.revokeObjectURL(url)}catch(reason){setError(collegeError(reason))}finally{setBusy(false)}};
 return <div className="ats-fit-assessment">{error&&<p role="alert">{error}</p>}<SharedATSFit data={data} student={candidate} actions={<><button onClick={download}><Download size={16}/>Download assessment</button><button disabled={localPreview||busy} onClick={()=>void resume()}><Download size={16}/>{busy?'Downloading…':'Download resume'}</button>{onOpenCoach&&<button onClick={onOpenCoach}><Sparkles size={16}/>AI Coach</button>}<button onClick={onReviewRequirements}>Review job requirements</button></>}/></div>;
}
