import {isAxiosError} from 'axios';
import {collegeApi} from '@/api/collegeApi';
import {AssessmentCache,AssessmentQueue} from './assessmentCache';
import {driveHistory,type AssessmentATS,type AssessmentBundle} from './assessmentIntelligenceData';
export type FullAssessment=AssessmentATS&Record<string,unknown>;
export type FullBundle=AssessmentBundle&{assessment_contract?:string;assessments?:Record<string,FullAssessment>;resume_sections?:Record<string,string[]>;resume_parse_ready?:boolean;resume_version?:string};
export const assessmentCache=new AssessmentCache();
const queue=new AssessmentQueue(6);
let compatibilitySession='';
let sharedEndpointUnavailable=false;
export function assessmentSession(){const token=localStorage.getItem('access_token')||'';assessmentCache.session(token);if(compatibilitySession!==token){compatibilitySession=token;sharedEndpointUnavailable=false}return token}
export function cachedAssessmentRequest<T>(path:string):Promise<T>{
 const session=assessmentSession();
 return assessmentCache.get(`student-ats-v1:${path}`,()=>queue.run(async()=>{if((localStorage.getItem('access_token')||'')!==session)throw new Error('The signed-in session changed.');const value=await collegeApi.get<T>(path);if((localStorage.getItem('access_token')||'')!==session)throw new Error('The signed-in session changed.');return value}));
}
export function peekAssessment<T>(path:string){assessmentSession();return assessmentCache.peek<T>(`student-ats-v1:${path}`)}
export function clearAssessmentCache(){assessmentSession();assessmentCache.clear();sharedEndpointUnavailable=false}
export function studentAssessmentPath(id:string){return `students/${encodeURIComponent(id)}/reports?include_assessments=true`}
export function mergeResumeEvidence(bundle:FullBundle,row:FullAssessment):FullAssessment{
 return {...bundle.student,...row,resume_sections:row.resume_sections??bundle.resume_sections,resume_parse_ready:row.resume_parse_ready??bundle.resume_parse_ready,resume_version:row.resume_version??bundle.resume_version};
}
export async function loadStudentAssessment(id:string):Promise<FullBundle>{
 const path=studentAssessmentPath(id);
 const bundle=await cachedAssessmentRequest<FullBundle>(path);
 if(bundle.student?.id!==id||!Array.isArray(bundle.drives)||!Array.isArray(bundle.reports))throw new Error('The student assessment response is incomplete.');
 return bundle;
}
export async function loadCandidateAssessment(studentId:string,driveId:string):Promise<FullAssessment>{
 const bundle=await loadStudentAssessment(studentId);
 const direct=bundle.assessment_contract==='student-ats-v1'?bundle.assessments?.[driveId]:undefined;
 if(direct)return mergeResumeEvidence(bundle,direct);
 if(!sharedEndpointUnavailable){
  const path=`students/${encodeURIComponent(studentId)}/drives/${encodeURIComponent(driveId)}/ats-fit`;
  try{
   const result=await cachedAssessmentRequest<{student_id:string;student:Record<string,unknown>;assessment:Record<string,unknown>}>(path);
   if(result.student_id!==studentId||result.assessment?.drive_id!==driveId)throw new Error('The assessment does not match the selected student and drive.');
   return {...result.student,...result.assessment,student_id:studentId} as FullAssessment;
  }catch(error){
   // Support the current production API until the shared reader is deployed.
   // Authorization, transport and server errors must never select another source.
   if(!endpointMissing(error))throw error;
   sharedEndpointUnavailable=true;
  }
 }
 const legacy=await cachedAssessmentRequest<{candidates:FullAssessment[];job_description?:string}>(`drives/${encodeURIComponent(driveId)}/dashboard/ats-fit?student_id=${encodeURIComponent(studentId)}&limit=1`);
 const row=legacy.candidates?.find(candidate=>candidate.student_id===studentId);
 if(!row)throw new Error('No assessment was returned for the selected student.');
 // Keep absent resume sections absent; the older API cannot provide them.
 return {...bundle.student,...row,student_id:studentId,drive_id:driveId,job_description:legacy.job_description,assessment_source:'legacy_admin'} as FullAssessment;
}
export async function loadAllStudentAssessments(bundle:FullBundle):Promise<Record<string,FullAssessment>>{
 if(bundle.assessment_contract==='student-ats-v1'&&bundle.assessments)return Object.fromEntries(Object.entries(bundle.assessments).map(([id,row])=>[id,mergeResumeEvidence(bundle,row)]));
 // Prefer the shared contract; older servers retain their existing ATS reader.
 const results=await Promise.allSettled(driveHistory(bundle).map(async({drive})=>[drive.drive_id,await loadCandidateAssessment(bundle.student.id,drive.drive_id)] as const));
 return Object.fromEntries(results.flatMap(result=>result.status==='fulfilled'?[result.value]:[]));
}
export const endpointMissing=(error:unknown)=>isAxiosError(error)&&error.response?.status===404;
let viewSession='';let viewState:unknown;
export function readAssessmentView<T>():T|undefined{const session=assessmentSession();if(viewSession!==session){viewSession=session;viewState=undefined}return viewState as T|undefined}
export function saveAssessmentView<T>(value:T){viewSession=assessmentSession();viewState=value}
export function invalidateStudentAssessment(id:string){assessmentCache.invalidate(`student-ats-v1:${studentAssessmentPath(id)}`)}
