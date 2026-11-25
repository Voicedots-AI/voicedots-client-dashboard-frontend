export const candidateProfileTabs=['overview','academics','placement','assessments','fees'] as const;
export type CandidateProfileTab=typeof candidateProfileTabs[number];
export function candidateProfileTab(value:string|null):CandidateProfileTab{
 return candidateProfileTabs.includes(value as CandidateProfileTab)?value as CandidateProfileTab:'overview';
}
export function openCandidate(params:URLSearchParams,id:string){
 const next=new URLSearchParams(params);next.set('candidate',id);next.set('candidateTab','overview');next.delete('candidateAttempt');return next;
}
export function closeCandidate(params:URLSearchParams){
 const next=new URLSearchParams(params);for(const key of ['candidate','candidateTab','candidateAttempt'])next.delete(key);return next;
}
export function candidateReportIndex(reports:{session_id:string;drive_id?:string|null}[],session:string|null,drive?:string){
 const exact=reports.findIndex(report=>report.session_id===session);
 if(exact>=0)return exact;
 if(drive)return reports.findIndex(report=>report.drive_id===drive);
 return reports.length?0:-1;
}
