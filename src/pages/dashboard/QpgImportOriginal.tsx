import {useEffect,useState} from 'react';
import {qpgApi} from '@/api/qpgApi';
import {collegeError} from '@/api/collegeApi';
import QpgQuestionImages from './QpgQuestionImages';
import type {QuestionImage} from './QpgQuestionImages';
type Original={filename:string;note:string;blocks:{location:string;text:string;images:QuestionImage[];warnings:string[]}[]};
export default function QpgImportOriginal({importId}:{importId:string}){
 const [original,setOriginal]=useState<Original|null>(null),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 useEffect(()=>{const c=new AbortController();setOriginal(null);setError('');qpgApi.get<Original>(`imports/${importId}/document-review`,c.signal).then(value=>{if(!c.signal.aborted)setOriginal(value);}).catch(e=>{if(!c.signal.aborted)setError(collegeError(e));});return()=>c.abort();},[importId,retry]);
 return <aside aria-label="Original Word content" className="min-w-0 rounded-xl border bg-slate-50 p-3 dark:bg-slate-950 lg:sticky lg:top-0 lg:max-h-[72vh] lg:overflow-y-auto"><h3 className="mb-2 font-semibold">Original Word content</h3>{error?<div role="alert"><p className="text-sm text-red-700">{error}</p><button type="button" className="mt-2 text-violet-700 underline" onClick={()=>setRetry(n=>n+1)}>Retry original preview</button></div>:!original?<p role="status" className="text-sm">Loading original content…</p>:<><p className="mb-3 text-xs text-slate-500">{original.note}</p>{original.blocks.map((block,n)=><section key={n} className="mb-3 rounded-lg border bg-white p-3 dark:bg-slate-900"><p className="mb-2 text-xs text-slate-400">{block.location}</p><p className="whitespace-pre-wrap break-words text-sm">{block.text}</p><QpgQuestionImages images={block.images}/>{block.warnings.map((w,i)=><p key={i} className="my-2 text-xs text-amber-700">{w}</p>)}</section>)}</>}</aside>;
}
