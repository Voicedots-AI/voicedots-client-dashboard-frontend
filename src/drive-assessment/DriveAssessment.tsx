import {useEffect,useState} from "react";
import AssessmentPopup from "./AssessmentPopup";
import DriveDescriptionPreview from "./DriveDescriptionPreview";
import {loadStudentAssessment,loadAllStudentAssessments,type FullBundle,type FullAssessment} from "../pages/dashboard/assessmentClient";
import {driveHistory,atsKey} from "../pages/dashboard/assessmentIntelligenceData";
import PlacementAssessmentTable from "../pages/dashboard/PlacementAssessmentTable";
import {ATSFitDetails} from "../pages/dashboard/DriveManagement";
import StudentScorecard from "../pages/dashboard/StudentScorecard";
import AssessmentCandidateDetails from "../pages/dashboard/AssessmentCandidateDetails";
import AssessmentCoach from "../pages/dashboard/AssessmentCoach";
export default function DriveAssessment({id,studentId,company,role,close}:{id:string;studentId:string;company?:string|null;role?:string|null;close:()=>void}) {
 const [data,setData]=useState<{bundle:FullBundle;ats:Record<string,FullAssessment>}|null>(null),[error,setError]=useState(""),[retry,setRetry]=useState(0),[view,setView]=useState("summary");
 useEffect(()=>{let active=true;setError("");void loadStudentAssessment(studentId).then(async bundle=>({bundle,ats:await loadAllStudentAssessments(bundle)})).then(value=>{if(active)setData(value)}).catch(()=>{if(active)setError("Unable to load this drive assessment.")});return()=>{active=false}},[studentId,retry]);
 const row=data&&driveHistory(data.bundle).find(row=>row.drive.drive_id===id);
 if(data&&row){const student=data.bundle.student;
  if(view==="ats")return <ATSFitDetails driveId={id} drive={null} candidate={{student_id:studentId,full_name:student.full_name,roll_number:student.roll_number,email:student.email,program:student.program,department_code:student.department_code||undefined}} initialAssessment={data.ats[id]} cutoff={row.drive.criteria_ats_fit} onClose={()=>setView("summary")}/>;
  if(view==="profile")return <AssessmentCandidateDetails student={student} bundle={data.bundle} driveId={id} onClose={()=>setView("summary")}/>;
  if(view==="progress")return <AssessmentCoach bundle={data.bundle} driveId={id} onClose={()=>setView("summary")}/>;
 }
 return <AssessmentPopup title={role||row?.drive.role_title||"Placement drive"} company={company||row?.drive.company_name} onClose={close}>
  {error?<p role="alert">{error}<button onClick={()=>setRetry(value=>value+1)}>Retry</button></p>:!data?<p role="status">Loading drive assessment…</p>:!row?<p>No assessment history is available for this drive.</p>:view==="score"&&row.report?.session_id?<StudentScorecard studentId={studentId} sessionId={row.report.session_id} role={row.drive.role_title}/>:<><DriveDescriptionPreview driveId={id} studentId={studentId}/><PlacementAssessmentTable allowPopup={false} bundle={data.bundle} rows={[row]} ats={Object.fromEntries(Object.entries(data.ats).map(([drive,row])=>[atsKey(studentId,drive),{row}]))} onATS={()=>setView("ats")} onScorecard={()=>setView("score")} onProfile={()=>setView("profile")} onProgress={()=>setView("progress")} onRetry={()=>setRetry(value=>value+1)}/></>}
 </AssessmentPopup>;
}
