import {reportCompetencies} from './reportCompetencies';
type Row=Record<string,unknown>;
const rows=(value:unknown):Row[]=>Array.isArray(value)?value.filter((item):item is Row=>!!item&&typeof item==='object'&&!Array.isArray(item)):[];
/** Match the student AI Coach pills: assessed scores >=50 are green. */
export function interviewEvidence(detail:Row){
 const competencies=reportCompetencies({score_breakdown:(detail.score_breakdown||{}) as Record<string,unknown>,core_dimensions:rows(detail.core_dimensions),domain_dimensions:rows(detail.domain_dimensions)}).filter((item):item is typeof item & {score:number}=>item.score!==null);
 return {strengths:competencies.filter(item=>item.score>=50),growth:competencies.filter(item=>item.score<50)};
}
export function selectEvidenceReport(reports:unknown,driveId:string,sessionId?:string){
 return rows(reports).find(row=>String(row.drive_id)===driveId&&(!sessionId||row.session_id===sessionId));
}
