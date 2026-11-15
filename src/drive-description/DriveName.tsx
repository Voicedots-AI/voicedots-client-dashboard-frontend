import {lazy,Suspense,useState,type ReactNode} from "react";
import AssessmentPopup from "../drive-assessment/AssessmentPopup";
const DriveAssessment=lazy(()=>import("../drive-assessment/DriveAssessment"));
export default function DriveName({id,company,role,children,studentId}:{id:string;company?:string|null;role?:string|null;children?:ReactNode;studentId?:string}) {
 const [open,setOpen]=useState(false);
 if(!studentId)return <>{children||<>{company} · {role}</>}</>;
 return <><button type="button" className="da-name-button" aria-haspopup="dialog" onClick={()=>setOpen(true)}>{children||<>{company} · {role}</>}</button>{open&&<Suspense fallback={<AssessmentPopup title={role||"Placement drive"} company={company} onClose={()=>setOpen(false)}><p role="status">Loading assessment…</p></AssessmentPopup>}><DriveAssessment id={id} studentId={studentId} company={company} role={role} close={()=>setOpen(false)}/></Suspense>}</>;
}
