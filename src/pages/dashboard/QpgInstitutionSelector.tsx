import {useEffect, useRef, useState} from 'react';
import {Link} from 'react-router-dom';
import type {Program} from '@/api/collegeApi';
import {collegeError} from '@/api/collegeApi';
import {qpgApi, type Subject} from '@/api/qpgApi';

export const educationLevels=['Undergraduate','Postgraduate','Diploma','Doctoral','School','Other'];
export type InstitutionBatch={id:string;label:string;program_code:string;entry_year:number|null;version:number};
export type InstitutionOptions={institution_name?:string;programs:Program[];institution_batches?:InstitutionBatch[];can_setup:boolean};
export type InstitutionContext={batch_id:string;institution_name:string;education_level:string;batch_name:string;specialization_name:string;program_code:string;branch_code:string;year_number:number;semester_number:number};
const input='w-full min-w-0 rounded-lg border border-slate-200 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-900';
const empty={year:'',level:'',program:'',department:'',batch:'',semester:'',subject:''};

export default function QpgInstitutionSelector({options,contextOnly=false,disabled=false,onChange}:{options:InstitutionOptions;contextOnly?:boolean;disabled?:boolean;onChange:(context:InstitutionContext|null,subject:Subject|null)=>void}){
 const [selection,setSelection]=useState(empty);
 const [subjects,setSubjects]=useState<Subject[]>([]),[loading,setLoading]=useState(false),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 const touched=useRef(false);
 const callback=useRef(onChange);callback.current=onChange;
 const batches=options.institution_batches||[];
 const years=[...new Set(batches.flatMap(b=>b.entry_year==null?[]:[b.entry_year]))].sort((a,b)=>b-a);
 const programmes=options.programs.filter(p=>p.education_level&&batches.some(b=>String(b.entry_year)===selection.year&&b.program_code===p.code));
 const levels=[...new Set(programmes.map(p=>p.education_level!))];
 const programme=programmes.find(p=>p.code===selection.program&&p.education_level===selection.level);
 const matchingBatches=batches.filter(b=>String(b.entry_year)===selection.year&&b.program_code===programme?.code);
 const batch=matchingBatches.length===1?matchingBatches[0]:matchingBatches.find(b=>b.id===selection.batch);
 const department=programme?.departments.find(d=>d.code===selection.department);
 const semester=Number(selection.semester);
 const ready=!!batch&&!!department&&semester>=1&&semester<=(programme?.duration_years||0)*2;
 const chosen=subjects.find(s=>s.id===selection.subject)||null;
 function change(key:keyof typeof empty,value:string){
  touched.current=true;
  const order:(keyof typeof empty)[]=['year','level','program','batch','department','semester','subject'];
  setSelection(old=>{const next={...old,[key]:value};for(const field of order.slice(order.indexOf(key)+1))next[field]='';return next;});
  if(key!=='subject')setSubjects([]);
 }
 useEffect(()=>{
  if(!ready||contextOnly){setSubjects([]);setLoading(false);setError('');return;}
  const controller=new AbortController();setLoading(true);setError('');
  const query=new URLSearchParams({batch_id:batch!.id,program_code:programme!.code,branch_code:department!.code,semester_number:String(semester)});
  qpgApi.get<{items:Subject[]}>(`subjects?${query}`,controller.signal).then(r=>{if(!controller.signal.aborted)setSubjects(r.items);}).catch(e=>{if(!controller.signal.aborted)setError(collegeError(e));}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return()=>controller.abort();
 },[ready,batch?.id,programme?.code,department?.code,semester,contextOnly,retry,options]);
 useEffect(()=>{
  if(!touched.current)return;
  callback.current(ready?{batch_id:batch!.id,institution_name:options.institution_name||'',education_level:programme!.education_level!,batch_name:batch!.label,specialization_name:department!.display_name,program_code:programme!.code,branch_code:department!.code,year_number:Math.ceil(semester/2),semester_number:semester}:null,chosen);
 },[selection.year,selection.level,ready,batch?.id,batch?.label,options.institution_name,programme?.code,programme?.education_level,department?.code,department?.display_name,semester,chosen]);
 const field=(title:string,value:string,items:{value:string;title:string}[],key:keyof typeof empty,locked=false)=><label className="grid min-w-0 gap-2 text-sm font-medium">{title}<select aria-label={title} className={input} value={value} disabled={disabled||locked} onChange={e=>change(key,e.target.value)}><option value="">Choose {title.toLowerCase()}</option>{items.map(item=><option key={item.value} value={item.value}>{item.title}</option>)}</select></label>;
 return <div>
  <fieldset disabled={disabled} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Institution academic selection">
   {field('Batch year',selection.year,years.map(y=>({value:String(y),title:String(y)})),'year')}
   {field('Education level',selection.level,levels.map(v=>({value:v,title:v})),'level',!selection.year)}
   {field('Programme',selection.program,programmes.filter(p=>p.education_level===selection.level).map(p=>({value:p.code,title:p.display_name})),'program',!selection.level)}
   {matchingBatches.length>1&&field('Batch',selection.batch,matchingBatches.map(b=>({value:b.id,title:b.label})),'batch',!programme)}
   {field('Department',selection.department,(programme?.departments||[]).map(d=>({value:d.code,title:d.display_name})),'department',!batch)}
   {field('Semester',selection.semester,Array.from({length:programme?.duration_years?programme.duration_years*2:0},(_,i)=>({value:String(i+1),title:`Semester ${i+1}`})),'semester',!department)}
   {!contextOnly&&field('Subject',selection.subject,subjects.map(s=>({value:s.id,title:`${s.code} · ${s.name}`})),'subject',!ready||loading||!!error)}
  </fieldset>
  <p className="mt-3 text-xs text-slate-500">Batch year is the year students joined the institution.</p>
  {loading&&<p role="status" className="mt-2 text-sm">Loading subjects…</p>}
  {error&&<p role="alert" className="mt-2 text-sm text-rose-600">{error} <button type="button" className="underline" onClick={()=>setRetry(n=>n+1)}>Retry</button></p>}
  {!batches.some(b=>b.entry_year!=null)&&<p className="mt-3 text-sm">No admission batches are configured yet.</p>}
  {!!selection.year&&!levels.length&&<p className="mt-3 text-sm">Set the education level for this batch’s programme in Institution Management.</p>}
  {ready&&!contextOnly&&!loading&&!error&&!subjects.length&&<p className="mt-3 text-sm">No subjects are linked to this batch and semester yet.</p>}
  {options.can_setup&&<Link className="mt-3 inline-block text-sm font-semibold text-violet-600 underline" to="/dashboard/attendance?tab=academic">Manage batches, programmes and subjects ↗</Link>}
 </div>;
}
