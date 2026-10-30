import type {CollegeStudent} from '@/api/collegeApi';

export type Assignment={drive_id:string;company_name?:string;role_title?:string;assignment_status?:string;drive_status?:string;assigned_at?:string;started_at?:string;completed_at?:string;campaign_opens_at?:string;campaign_deadline_at?:string;attempt_number?:number};
export type AssessmentReport={drive_id?:string;session_id?:string;company_name?:string;role_title?:string;overall_score?:number|null;readiness?:string;completed_at?:string;interview_completed_at?:string;attempt_number?:number;assignment_status?:string;detail?:{strengths?:unknown[];priority_improvement_areas?:unknown[]}};
export type AssessmentBundle={student:CollegeStudent;drives:Assignment[];reports:AssessmentReport[]};
export type AssessmentSkill={skill?:string;requirement?:string;match_status?:string};
export type AssessmentATS={student_id:string;ats_status?:string;ats_fit_score?:number|null;eligible?:boolean;resume_version?:string;input_fingerprint?:string;evaluated_at?:string;skills?:AssessmentSkill[]};
export type ATSState={row?:AssessmentATS;error?:string};
export const validScore=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=100;
export const currentATSScore=(value?:AssessmentATS)=>value?.ats_status==='evaluated'&&validScore(value.ats_fit_score)?value.ats_fit_score:null;
export const atsKey=(studentId:string,driveId:string)=>JSON.stringify([studentId,driveId]);

// Both portals use the current resume/JD ATS result; interview results remain historical.
export function driveHistory(bundle:AssessmentBundle){
 const drives=new Map<string,Assignment>();
 for(const row of bundle.drives||[])if(row.drive_id&&!drives.has(row.drive_id))drives.set(row.drive_id,row);
 const reports=new Map<string,AssessmentReport>();
 for(const row of bundle.reports||[]){
  if(!row.drive_id)continue; // Self-practice is not a placement drive.
  if(!drives.has(row.drive_id))drives.set(row.drive_id,{drive_id:row.drive_id,company_name:row.company_name,role_title:row.role_title,assignment_status:row.assignment_status,completed_at:row.interview_completed_at||row.completed_at});
  const prior=reports.get(row.drive_id);
  if(!prior||(Date.parse(row.interview_completed_at||row.completed_at||'')||0)>(Date.parse(prior.interview_completed_at||prior.completed_at||'')||0))reports.set(row.drive_id,row);
 }
 return [...drives.values()].map(drive=>({drive,report:reports.get(drive.drive_id)})).sort((a,b)=>(Date.parse(b.drive.assigned_at||b.report?.completed_at||'')||0)-(Date.parse(a.drive.assigned_at||a.report?.completed_at||'')||0));
}
export function assessmentSummary(bundle:AssessmentBundle,ats:Record<string,ATSState>){
 const rows=driveHistory(bundle);
 const scores=rows.map(({drive})=>currentATSScore(ats[atsKey(bundle.student.id,drive.drive_id)]?.row)).filter((score):score is number=>score!==null);
 const interview=rows.map(row=>row.report?.overall_score).filter(validScore);
 return {drives:rows.length,participated:rows.filter(row=>row.drive.started_at||row.drive.completed_at||['in_progress','completed'].includes(row.drive.assignment_status||'')).length,
  eligible:rows.filter(({drive})=>(currentATSScore(ats[atsKey(bundle.student.id,drive.drive_id)]?.row)??-1)>=50).length,
  assessed:scores.length,averageATS:scores.length?scores.reduce((a,b)=>a+b,0)/scores.length:null,bestScore:interview.length?Math.max(...interview):null,
  pending:rows.some(({drive})=>!ats[atsKey(bundle.student.id,drive.drive_id)]||ats[atsKey(bundle.student.id,drive.drive_id)]?.row?.ats_status==='processing'),
  failed:rows.some(({drive})=>Boolean(ats[atsKey(bundle.student.id,drive.drive_id)]?.error))};
}
export type AssessmentFilters={q:string;minCGPA:number;program:string;year:string;active:boolean;skill:string;minATS:number;minScore:number;minDrives:number;company:string;driveStatus:string;from:string;to:string};
export const initialFilters:AssessmentFilters={q:'',minCGPA:0,program:'',year:'',active:false,skill:'',minATS:0,minScore:0,minDrives:0,company:'',driveStatus:'',from:'',to:''};
export function matchesAssessmentFilters(bundle:AssessmentBundle|undefined,ats:Record<string,ATSState>,filters:AssessmentFilters){
 const hasAssessmentFilter=Boolean(filters.skill||filters.minATS||filters.minScore||filters.minDrives||filters.company||filters.driveStatus||filters.from||filters.to);
 if(!hasAssessmentFilter)return true;
 if(!bundle)return false;
 const summary=assessmentSummary(bundle,ats),rows=driveHistory(bundle);
 if(filters.minATS&&(summary.averageATS===null||summary.averageATS<filters.minATS))return false;
 if(filters.minScore&&(summary.bestScore===null||summary.bestScore<filters.minScore))return false;
 if(summary.drives<filters.minDrives)return false;
 if(filters.skill&&!rows.some(({drive})=>(ats[atsKey(bundle.student.id,drive.drive_id)]?.row?.skills||[]).some(skill=>(skill.skill||skill.requirement||'').toLowerCase().includes(filters.skill.toLowerCase()))))return false;
 if(filters.company&&!rows.some(({drive})=>drive.company_name===filters.company))return false;
 if(filters.driveStatus&&!rows.some(({drive})=>drive.assignment_status===filters.driveStatus))return false;
 // The dates refer to recorded participation/assignment dates, not invented drive windows.
 if((filters.from||filters.to)&&!rows.some(({drive})=>{const value=drive.assigned_at?.slice(0,10);return value&&(!filters.from||value>=filters.from)&&(!filters.to||value<=filters.to)}))return false;
 return true;
}
