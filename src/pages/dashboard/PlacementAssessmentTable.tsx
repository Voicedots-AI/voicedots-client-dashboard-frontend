import {ArrowUpRight} from 'lucide-react';
import {assessmentSummary,atsAboveDriveCutoff,atsDriveCutoff,atsKey,currentATSScore,validScore,driveHistory,type ATSState,type AssessmentATS} from './assessmentIntelligenceData';
import type {FullBundle} from './assessmentClient';
import {displayName,formatPlacementDateTime} from './placementDisplay';
import './assessmentIntelligence.css';

type HistoryRow=ReturnType<typeof driveHistory>[number];
export function ATSChip({row,cutoff,loading,onOpen}:{row?:AssessmentATS;cutoff?:number|null;loading:boolean;onOpen:()=>void}){
 const score=currentATSScore(row),above=atsAboveDriveCutoff(row,cutoff),required=atsDriveCutoff(row,cutoff);
 return <button type="button" className={`ai-ats-chip ${above===null?'neutral':above?'good':'low'}`} title={required===null?'Drive ATS cutoff is unavailable':`Drive ATS cutoff: ${required}%. Green requires a score above this cutoff.`} onClick={onOpen} aria-label={`View ATS Fit ${score===null?'assessment':`${score}%`}`}>{score===null?loading?'Loading…':row?.ats_status==='processing'?'Processing…':row?.ats_status==='evaluation_failed'?'Assessment failed':row?.ats_status==='resume_not_available'?'No resume':row?.ats_status==='needs_reevaluation'?'Not assessed':'Not assessed':`${score}%`}<ArrowUpRight size={12}/></button>;
}
export function PlacementAssessmentMetrics({bundle,ats}:{bundle:FullBundle;ats:Record<string,ATSState>}){
 const summary=assessmentSummary(bundle,ats);
 return <div className="pw-metrics">{[['Drives meeting ATS requirements',summary.eligible],['Participated',summary.participated],['Avg. ATS',summary.averageATS==null?'Not assessed':`${Math.round(summary.averageATS)}%`],['Best interview score',summary.bestScore==null?'Not assessed':`${summary.bestScore}/100`]].map(([label,value])=><article key={label}><span>{label}</span><strong>{value}</strong></article>)}</div>;
}
export default function PlacementAssessmentTable({bundle,rows,ats,onATS,onScorecard,onProfile,onProgress,onRetry}:{bundle:FullBundle;rows:HistoryRow[];ats:Record<string,ATSState>;onATS:(drive:string)=>void;onScorecard:(row:HistoryRow)=>void;onProfile:(drive:string)=>void;onProgress:(drive:string)=>void;onRetry:()=>void}){
 const student=bundle.student;
 const date=(value?:string)=>value?formatPlacementDateTime(value):'—';
 const shortDate=(value?:string)=>value?new Date(value).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric',timeZone:'Asia/Kolkata'}):'—';
 const scoreLabel=(value:unknown)=>validScore(value)?`${Math.round(value*10)/10}/100`:'Not assessed';
 return <div className="ai-drive-table-wrap"><table className="ai-drive-table"><caption className="ai-sr-only">{student.full_name} placement assessment history</caption><thead><tr>{['Drive / company','Date range','ATS Fit','Scorecard','Interview status','Readiness','Action'].map(label=><th key={label} scope="col">{label}</th>)}</tr></thead><tbody>{rows.map(({drive,report})=>{
 const state=ats[atsKey(student.id,drive.drive_id)];
 return <tr key={drive.drive_id} data-drive-id={drive.drive_id}><td><strong>{drive.company_name||report?.company_name||'Company unavailable'} <span>{drive.role_title||report?.role_title||'Role unavailable'}</span></strong></td><td title={`${date(drive.campaign_opens_at)} – ${date(drive.campaign_deadline_at)} · Assigned ${date(drive.assigned_at)}`}>{drive.campaign_opens_at?`${shortDate(drive.campaign_opens_at)} – ${shortDate(drive.campaign_deadline_at)}`:'Not supplied'}</td><td><ATSChip row={state?.row} cutoff={drive.criteria_ats_fit} loading={!state} onOpen={()=>onATS(drive.drive_id)}/>{state?.error&&<button className="ai-text-button ai-error" title={state.error} onClick={onRetry}>Retry ATS</button>}</td><td>{validScore(report?.overall_score)&&report?.session_id?<button type="button" className="ai-scorecard-chip" aria-label={`Open scorecard for ${student.full_name} at ${drive.company_name||report.company_name||'this company'}`} onClick={()=>onScorecard({drive,report})}>Score {scoreLabel(report.overall_score)}<ArrowUpRight size={12}/></button>:<span>{scoreLabel(report?.overall_score)}</span>}</td><td><span className={`ai-status ${drive.assignment_status==='completed'?'good':drive.assignment_status==='in_progress'?'partial':'neutral'}`}>{displayName(drive.assignment_status||report?.assignment_status||drive.drive_status||'not_assessed')}</span></td><td>{report?.readiness?displayName(report.readiness):'Not assessed'}</td><td><div className="ai-drive-actions"><button type="button" className="ai-text-button" onClick={()=>onProfile(drive.drive_id)}>Resume &amp; biodata</button><button type="button" className="ai-button ai-small ai-coach-button" onClick={()=>onProgress(drive.drive_id)} aria-label={`Progress for ${drive.company_name} ${drive.role_title}`}>Progress</button></div></td></tr>;
 })}</tbody></table></div>;
}
