import {UserFacingError} from '@/lib/userFacingError';
import {apiClient} from './apiClient';
import type {Course} from '@/pages/dashboard/QpgSyllabusExtractPanel';
export type CurriculumResult={id?:string;filename?:string;courses:Course[];warnings?:string[];extraction_status?:string;error?:string;progress?:{stage:string;done:number;total:number};course_slots?:number;structured_course_count?:number;elective_option_count?:number};
function validItem(value:unknown):boolean{
 if(!value||typeof value!=='object')return false;
 const item=value as Record<string,unknown>;return typeof item.code==='string'&&typeof item.title==='string';
}
function checkedResult(value:CurriculumResult):CurriculumResult{
 if(!value||typeof value!=='object'||!Array.isArray(value.courses))throw new UserFacingError('The extraction response is incomplete. Reopen Saved curricula or retry the upload.');
 if(value.extraction_status&&!['PROCESSING','COMPLETED','FAILED'].includes(value.extraction_status))throw new UserFacingError('The extraction status is unavailable. Reopen Saved curricula to check progress.');
 if(value.extraction_status==='PROCESSING'&&!value.id)throw new UserFacingError('Extraction status is unavailable. Upload the document again.');
 if(value.extraction_status!=='PROCESSING'&&value.extraction_status!=='FAILED'){
  if(!value.courses.length)throw new UserFacingError('No courses were found. Check the document and retry extraction.');
  if(value.courses.some(course=>!course||typeof course.name!=='string'||typeof course.code!=='string'||!Array.isArray(course.cos)||!Array.isArray(course.units)||!Array.isArray(course.warnings)||course.cos.some(item=>!validItem(item))||course.units.some(unit=>!validItem(unit)||!Array.isArray(unit.topics)||unit.topics.some(item=>!validItem(item)))))throw new UserFacingError('The extracted course data is incomplete. Reopen Saved curricula or retry extraction.');
 }
 return value;
}
export async function waitForCurriculum(result:CurriculumResult,onProgress:(message:string)=>void):Promise<CurriculumResult>{
 result=checkedResult(result);
 const started=Date.now();
 while(result.extraction_status==='PROCESSING'){
  const progress=result.progress;
  onProgress(progress?.total?`${progress.stage} · ${progress.done} / ${progress.total}`:'Reading your curriculum. You can reopen it from Saved curricula.');
  if(!result.id)throw new UserFacingError('Extraction status is unavailable. Upload the document again.');
  if(Date.now()-started>30*60*1000)throw new UserFacingError('Extraction is taking longer than expected. Reopen the document from Saved curricula to check progress.');
  await new Promise(resolve=>window.setTimeout(resolve,2000));
  try{result=checkedResult((await apiClient.get<CurriculumResult>(`/v3/college/question-papers/curricula/${result.id}`)).data);}
  catch(error){if(error instanceof Error && !('isAxiosError' in error))throw error;throw new UserFacingError('Could not check extraction progress. Your document is saved; reopen it from Saved curricula.');}
 }
 if(result.extraction_status==='FAILED')throw new UserFacingError(result.error||'Extraction did not finish. Upload the saved original again to retry.');
 return result;
}
export async function extractCurriculum(file:File,path:string,onProgress:(message:string)=>void,onSaved?:(result:CurriculumResult)=>void){
 const body=new FormData();body.append('file',file);body.append('background','true');
 const response=await apiClient.post<CurriculumResult>(`/v3/college/question-papers/${path}`,body,{headers:{'Content-Type':'multipart/form-data'},timeout:125000});
 const result=checkedResult(response.data);
 onSaved?.(result);
 return waitForCurriculum(result,onProgress);
}

export async function downloadCurriculumOriginal(id:string){
 const response=await apiClient.get<Blob>(`/v3/college/question-papers/curricula/${id}/original`,{responseType:'blob'});
 const url=URL.createObjectURL(response.data);const anchor=document.createElement('a');anchor.href=url;
 anchor.download=response.data.type.includes('pdf')?'curriculum.pdf':'curriculum.docx';anchor.click();
 window.setTimeout(()=>URL.revokeObjectURL(url),60000);
}
