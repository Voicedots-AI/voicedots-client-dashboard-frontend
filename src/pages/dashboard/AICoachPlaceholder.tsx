import {Sparkles} from 'lucide-react';

// Only offer preparation after an assessed attempt, while further preparation is needed.
// Arman can attach the coach action here without changing each roster entry point.
export function canOfferAICoach({score,readiness,decision,minimum}:{score:unknown;readiness?:unknown;decision?:unknown;minimum?:unknown}){
 if(typeof score!=='number'||!Number.isFinite(score)||score<0||score>100)return false;
 const outcome=typeof decision==='object'&&decision!==null?(decision as {decision?:unknown}).decision:decision;
 const normalized=String(outcome||'').toLowerCase().replace(/[ -]+/g,'_');
 if(['shortlist','shortlisted','selected','offer_selected','offered','offer_received','placed','hired'].includes(normalized))return false;
 if(['ready','interview_ready','industry_ready'].includes(String(readiness||'').toLowerCase().replace(/[ -]+/g,'_')))return false;
 if(typeof minimum==='number'&&Number.isFinite(minimum)&&minimum>=0&&minimum<=100&&score>=minimum)return false;
 return true;
}
export default function AICoachPlaceholder({visible}:{visible:boolean}){
 if(!visible)return null;
 return <button type="button" className="ai-coach-placeholder" disabled aria-disabled="true" title="AI Coach coming soon"><Sparkles size={14}/>AI Coach</button>;
}
