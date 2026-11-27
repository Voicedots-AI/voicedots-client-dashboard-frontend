import type {AssessmentReport} from './assessmentIntelligenceData';
export default function AttemptPager({attempts,sessionId,onSelect}:{attempts:AssessmentReport[];sessionId:string;onSelect:(session:string)=>void}){
 const saved=attempts.filter(row=>row.session_id),index=saved.findIndex(row=>row.session_id===sessionId);
 return <nav className="ai-attempt-pager" aria-label="Interview attempts"><button type="button" className="ai-button ai-small" disabled={index<=0} onClick={()=>{const id=saved[index-1]?.session_id;if(id)onSelect(id)}}>Previous attempt</button><span aria-live="polite">Attempt {saved[index]?.attempt_number??'—'} · {index<0?'—':index+1} of {saved.length}</span><button type="button" className="ai-button ai-small" disabled={index<0||index>=saved.length-1} onClick={()=>{const id=saved[index+1]?.session_id;if(id)onSelect(id)}}>Next attempt</button></nav>;
}
