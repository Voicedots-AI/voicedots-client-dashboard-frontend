type Row = Record<string, unknown>;
export type AgentScoreSelection = {track:string;profile?:{role?:string}};
const labels:Record<string,string>={hr:'Talent Acquisition Specialist',domain:'Senior Domain Specialist',industry:'Practical Interviewer',manager:'Hiring Manager'};
const trackOf=(row:Row)=>String(row.agent_type||row.track||'').trim().toLowerCase();
export function interviewAgentScores(breakdown:unknown,selection?:AgentScoreSelection[]){
 const recorded=(Array.isArray(breakdown)?breakdown:[]).filter((row):row is Row=>!!row&&typeof row==='object'&&!Array.isArray(row));
 const configured=selection?.length?selection:recorded.map(row=>({track:trackOf(row),profile:{role:typeof row.interviewer_role==='string'?row.interviewer_role:undefined}}));
 const seen=new Set<string>();
 return configured.flatMap(item=>{
  const track=item.track.trim().toLowerCase();if(!track||seen.has(track))return [];seen.add(track);
  const round=recorded.find(row=>trackOf(row)===track)||{};
  const score=typeof round.sub_score==='number'&&Number.isFinite(round.sub_score)&&round.sub_score>=0&&round.sub_score<=100?round.sub_score:null;
  return [{track,label:item.profile?.role?.trim()||labels[track]||track,score,summary:typeof round.summary==='string'?round.summary:'',round:{...round,agent_type:track,sub_score:score} as Row}];
 });
}
