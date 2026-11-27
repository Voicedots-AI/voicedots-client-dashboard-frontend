type Row=Record<string,unknown>;
export const evidenceRows=(value:unknown):Row[]=>Array.isArray(value)?value.filter((item):item is Row=>!!item&&typeof item==='object'&&!Array.isArray(item)):[];
const text=(value:unknown)=>typeof value==='string'?value.trim():'';
export function evidenceItem(value:unknown){
 if(typeof value==='string')return {title:value.trim(),details:[] as string[]};
 const row=(value&&typeof value==='object'?value:{}) as Row;
 const title=[row.title,row.label,row.focus,row.strength,row.text,row.summary,row.description,row.dimension].map(text).find(Boolean)||'';
 const details=[row.text,row.summary,row.description,row.why,row.evidence,row.reason,row.rationale,row.problem,...(Array.isArray(row.actions)?row.actions:[])].map(text).filter(value=>value&&value!==title);
 const score=typeof row.percentage==='number'?row.percentage:typeof row.score==='number'?row.score:null;
 if(score!==null&&Number.isFinite(score)&&score>=0&&score<=100)details.push(`${score}/100`);
 if(typeof row.current_band==='number')details.push(`Current band ${row.current_band}${typeof row.target_band==='number'?` · Target band ${row.target_band}`:''}`);
 return {title,details:[...new Set(details)]};
}
export function interviewEvidence(detail:Row){
 const raw=Array.isArray(detail.strengths)?detail.strengths:[];
 const answers=evidenceRows(detail.question_reviews).flatMap(row=>Array.isArray(row.strength_feedback)?row.strength_feedback:[]);
 const resume=(detail.resume_alignment||{}) as Row;
 const verified=evidenceRows(resume.skills).filter(row=>row.evidence_level==='verified'&&text(row.skill)).map(row=>`${row.skill} · verified in interview`);
 const unique=(items:unknown[])=>{const seen=new Set<string>();return items.map(evidenceItem).filter(item=>{const key=JSON.stringify(item);if((!item.title&&!item.details.length)||seen.has(key))return false;seen.add(key);return true})};
 const placement=(detail.placement_recommendation||{}) as Row;
 const growth=[detail.priority_improvement_areas,placement.recommended_preparation,placement.needs_improvement_before].find(value=>Array.isArray(value)&&value.length) as unknown[]|undefined;
 return {strengths:unique([...raw,...answers,...verified]),growth:unique(growth||[]),dimensions:[...evidenceRows(detail.core_dimensions),...evidenceRows(detail.domain_dimensions)]};
}
export function selectEvidenceReport(reports:unknown,driveId:string,sessionId?:string){
 // The API places the assignment's evaluated fact before archived attempts.
 // Preserve that choice unless the caller provides an exact saved session.
 return evidenceRows(reports).find(row=>String(row.drive_id)===driveId&&(!sessionId||row.session_id===sessionId));
}
