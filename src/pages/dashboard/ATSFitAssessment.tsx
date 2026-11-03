import AICoachPlaceholder,{canOfferAICoach} from './AICoachPlaceholder';
import {lazy,Suspense,useEffect,useRef,useState} from 'react';
import {Download,Eye,X} from 'lucide-react';
import {collegeApi,collegeError} from '@/api/collegeApi';
import {SharedATSFit,type AssessmentStudent} from '@/shared-assessment/ATSFit';
import './atsFitAssessment.css';
const ResumePreview=lazy(()=>import('./DriveManagement').then(module=>({default:module.ATSResumeFile})));
type Data=Record<string,unknown>;
type Candidate=Data&AssessmentStudent&{student_id:string;full_name:string};
export default function ATSFitAssessment({driveId,candidate,data,onReviewRequirements,localPreview=false}:{driveId:string;candidate:Candidate;data:Data;onReviewRequirements:()=>void;localPreview?:boolean;onOpenCoach?:()=>void}){
 const [error,setError]=useState(''),[busy,setBusy]=useState(false),[preview,setPreview]=useState(false);
 const previewSection=useRef<HTMLElement>(null),previewButton=useRef<HTMLButtonElement>(null);
 useEffect(()=>{if(preview)previewSection.current?.scrollIntoView({behavior:'smooth',block:'start'})},[preview]);
 const download=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download=`${driveId}-ats-assessment.json`;link.click();URL.revokeObjectURL(url)};
 const resume=async()=>{setBusy(true);setError('');try{const blob=await collegeApi.file(`drives/${encodeURIComponent(driveId)}/candidates/${encodeURIComponent(candidate.student_id)}/resume-file`);const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download='resume.pdf';link.click();URL.revokeObjectURL(url)}catch(reason){setError(collegeError(reason))}finally{setBusy(false)}};
 return <div className="ats-fit-assessment">{error&&<p role="alert">{error}</p>}<SharedATSFit data={data} student={candidate} actions={<><button onClick={download}><Download size={16}/>Download assessment</button><button ref={previewButton} disabled={localPreview} aria-expanded={preview} aria-controls="ats-resume-preview" onClick={()=>setPreview(value=>!value)}><Eye size={16}/>Preview resume</button><button disabled={localPreview||busy} onClick={()=>void resume()}><Download size={16}/>{busy?'Downloading…':'Download resume'}</button><AICoachPlaceholder visible={canOfferAICoach({score:candidate.overall_score,readiness:candidate.readiness,decision:candidate.placement_decision||candidate.officer_decision,minimum:candidate.criteria_interview_score})}/><button onClick={onReviewRequirements}>Review job requirements</button></>}/>{preview&&<section ref={previewSection} id="ats-resume-preview" className="ats-inline-resume-preview" aria-label="Resume preview"><header><h3>Resume preview</h3><button type="button" aria-label="Close resume preview" onClick={()=>{setPreview(false);previewButton.current?.focus()}}><X size={17}/>Close preview</button></header><Suspense fallback={<p role="status">Loading resume preview…</p>}><ResumePreview driveId={driveId} studentId={candidate.student_id}/></Suspense></section>}</div>;
}
