import {useEffect,useState,type ReactNode} from "react";
import {collegeApi,type Drive} from "../api/collegeApi";
import {loadCandidateAssessment} from "../pages/dashboard/assessmentClient";
import DriveInformationPanel,{type DriveInformation} from "./DriveInformationPanel";
export default function DriveDescriptionPreview({driveId,studentId,cutoff,interviewCutoff,children}:{driveId:string;studentId:string;cutoff?:number|null;interviewCutoff?:number|null;children?:ReactNode}) {
 const [drive,setDrive]=useState<DriveInformation|null>(null),[failed,setFailed]=useState(false),[partial,setPartial]=useState(false),[retry,setRetry]=useState(0);
 useEffect(()=>{let active=true;setDrive(null);setFailed(false);setPartial(false);
  void collegeApi.get<Drive>(`drives/${encodeURIComponent(driveId)}`).then(value=>{if(value.id!==driveId)throw new Error("Drive mismatch");return value as DriveInformation}).catch(async()=>{const evidence=await loadCandidateAssessment(studentId,driveId);if(active)setPartial(!evidence.drive_details);return {...(evidence.drive_details as DriveInformation|undefined),job_description:typeof evidence.job_description==="string"?evidence.job_description:""} as DriveInformation}).then(value=>{if(active)setDrive(value)}).catch(()=>{if(active)setFailed(true)});
  return()=>{active=false}
 },[driveId,studentId,retry]);
 return <>{failed?<p role="alert">Unable to load drive details. <button type="button" onClick={()=>setRetry(v=>v+1)}>Retry</button></p>:drive===null?<p role="status">Loading drive details…</p>:<>{partial&&<p role="status">Full drive details are unavailable for this account. <button type="button" onClick={()=>setRetry(v=>v+1)}>Retry</button></p>}<DriveInformationPanel drive={{...drive,criteria_ats_fit:cutoff??drive.criteria_ats_fit,criteria_interview_score:interviewCutoff??drive.criteria_interview_score}}/>{children}</>}</>;
}
