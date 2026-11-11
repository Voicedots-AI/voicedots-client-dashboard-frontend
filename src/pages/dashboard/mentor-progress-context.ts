export const PRACTICE_CONTEXT = '__self_practice__';
export type ProgressReport = {session_id:string;drive_id?:string|null;attempt_number?:number|null;completed_at?:string;created_at?:string;status?:string;report:{overall_score?:number|null}};
export const contextKey=(driveId?:string|null)=>driveId||PRACTICE_CONTEXT;
const assessedAt=(report:ProgressReport)=>{
 const value=Date.parse(report.completed_at||report.created_at||'');
 return Number.isFinite(value)?value:0;
};
export function contextReports<T extends ProgressReport>(reports:T[],context:string):T[]{
 return reports.filter(report=>contextKey(report.drive_id)===context).sort((a,b)=>assessedAt(b)-assessedAt(a)||b.session_id.localeCompare(a.session_id));
}
export function selectedReport<T extends ProgressReport>(reports:T[],session:string):T|undefined{
 return reports.find(report=>report.session_id===session)||reports.find(report=>report.status==='released'&&report.report.overall_score!=null)||reports[0];
}
export function releasedScore(report?:ProgressReport):number|null{
 const score=report?.report.overall_score;
 return report?.status==='released'&&typeof score==='number'&&Number.isFinite(score)&&score>=0&&score<=100?score:null;
}
