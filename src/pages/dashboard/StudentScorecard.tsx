import {useEffect,useState} from 'react';
import {SharedScorecard,type ScorecardView} from '@/shared-assessment/Scorecard';
import {cachedAssessmentRequest} from './assessmentClient';
import {collegeError} from '@/api/collegeApi';
export default function StudentScorecard({studentId,sessionId}:{studentId:string;sessionId:string}){
 const key=`students/${encodeURIComponent(studentId)}/reports/${encodeURIComponent(sessionId)}/scorecard`;
 const [result,setResult]=useState<{key:string;report:ScorecardView}|null>(null),[error,setError]=useState('');
 useEffect(()=>{let alive=true;void cachedAssessmentRequest<{student_id:string;session_id:string;report:ScorecardView}>(key).then(value=>{if(value.student_id!==studentId||value.session_id!==sessionId)throw new Error('Scorecard identity mismatch');if(alive)setResult({key,report:value.report})}).catch(reason=>{if(alive)setError(collegeError(reason))});return()=>{alive=false}},[key,studentId,sessionId]);
 if(error)return <p role="alert">{error}</p>;
 if(!result||result.key!==key)return <p role="status">Loading student scorecard…</p>;
 if(result.report.status==='awaiting_release')return <section className="scorecard-card"><h3>Awaiting release</h3><p>This report will appear in the student portal after the placement team releases it. Use reviewer details to review and publish it.</p></section>;
 return <SharedScorecard key={sessionId} view={result.report}/>;
}
