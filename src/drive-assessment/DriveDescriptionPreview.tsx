import {useEffect,useState} from "react";
import {collegeApi,type Drive} from "../api/collegeApi";
import {loadCandidateAssessment} from "../pages/dashboard/assessmentClient";
export default function DriveDescriptionPreview({driveId,studentId}:{driveId:string;studentId:string}) {
 const [text,setText]=useState<string|null>(null),[failed,setFailed]=useState(false),[expanded,setExpanded]=useState(false),[retry,setRetry]=useState(0);
 useEffect(()=>{let active=true;setText(null);setFailed(false);setExpanded(false);
  void collegeApi.get<Drive>(`drives/${encodeURIComponent(driveId)}`).then(value=>{if(value.id!==driveId)throw new Error("Drive mismatch");return value.jd_raw_text||""}).catch(async()=>{const evidence=await loadCandidateAssessment(studentId,driveId);return typeof evidence.job_description==="string"?evidence.job_description:""}).then(value=>{if(active)setText(value.trim())}).catch(()=>{if(active)setFailed(true)});
  return()=>{active=false}
 },[driveId,studentId,retry]);
 return <section className="da-description" aria-label="About this drive"><h3>About this drive</h3>{failed?<p>Drive description unavailable. <button type="button" onClick={()=>setRetry(value=>value+1)}>Retry</button></p>:text===null?<p role="status">Loading description…</p>:text?<><p className={expanded?"":"da-description-excerpt"}>{text}</p>{(text.length>250||text.split("\n").length>3)&&<button type="button" aria-expanded={expanded} onClick={()=>setExpanded(value=>!value)}>{expanded?"Show less":"Read full description"}</button>}</>:<p>No description has been recorded for this drive.</p>}</section>;
}
