import {useEffect,useState,type FormEvent} from 'react';
import {collegeApi,collegeError,type Program} from '@/api/collegeApi';
import {qpgApi,type Subject} from '@/api/qpgApi';
import QpgInstitutionSelector,{type InstitutionOptions,type InstitutionContext,type InstitutionBatch} from './QpgInstitutionSelector';

type Options=InstitutionOptions&{erp_subjects:{id:string;code:string;name:string;department_code:string|null}[]};
const input='mt-1 w-full rounded-lg border border-slate-200 bg-white p-3 dark:bg-slate-900';
const button='rounded-lg border border-violet-200 px-4 py-2 text-sm font-semibold text-violet-700 disabled:opacity-50';
export default function InstitutionQpgSetup({programs}:{programs:Program[]}){
 const [options,setOptions]=useState<Options|null>(null),[refresh,setRefresh]=useState(0),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 const [context,setContext]=useState<InstitutionContext|null>(null),[existing,setExisting]=useState(''),[create,setCreate]=useState(false);
 const [editing,setEditing]=useState<InstitutionBatch|null>(null);
 const [linked,setLinked]=useState<Subject[]>([]);
 useEffect(()=>{const c=new AbortController();qpgApi.get<Options>('academic-options',c.signal).then(setOptions).catch(e=>{if(!c.signal.aborted)setError(collegeError(e));});return()=>c.abort();},[programs,refresh]);
 useEffect(()=>{setExisting('');setLinked([]);if(!context)return;const c=new AbortController();const q=new URLSearchParams({batch_id:context.batch_id,program_code:context.program_code,branch_code:context.branch_code,semester_number:String(context.semester_number)});qpgApi.get<{items:Subject[]}>(`subjects?${q}`,c.signal).then(r=>{if(!c.signal.aborted)setLinked(r.items);}).catch(e=>{if(!c.signal.aborted)setError(collegeError(e));});return()=>c.abort();},[context,refresh]);
 async function saveBatch(e:FormEvent<HTMLFormElement>){
  e.preventDefault();const form=e.currentTarget,values=new FormData(form);setBusy(true);setError('');setNotice('');
  try{await collegeApi.save('erp/catalog/batches',{values:{label:String(values.get('label')).trim(),program_code:values.get('program'),entry_year:Number(values.get('year'))}});form.reset();setRefresh(n=>n+1);setNotice('Batch saved in Institution Management.');}
  catch(cause){setError(collegeError(cause));}finally{setBusy(false);}
 }
 async function updateBatch(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(!editing)return;const values=new FormData(e.currentTarget);setBusy(true);setError('');setNotice('');
  try{await collegeApi.save(`erp/catalog/batches/${encodeURIComponent(editing.id)}`,{label:String(values.get('label')).trim(),entry_year:Number(values.get('year')),expected_version:editing.version},true);setEditing(null);setRefresh(n=>n+1);setNotice('Batch updated in Institution Management.');}
  catch(cause){setError(collegeError(cause));}finally{setBusy(false);}
 }
 async function linkSubject(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(!context)return;const form=e.currentTarget,values=new FormData(form);setBusy(true);setError('');setNotice('');
  try{
   if(create)await qpgApi.save('subjects/from-curriculum',{...context,code:values.get('code'),name:values.get('name')});
   else await qpgApi.save('subjects',{...context,erp_subject_id:existing});
   form.reset();setExisting('');setRefresh(n=>n+1);setNotice('Subject linked to the batch, department and semester. It is now available in QPG.');
  }catch(cause){setError(collegeError(cause));}finally{setBusy(false);}
 }
 return <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 dark:bg-slate-950" aria-label="Batch and QPG subject setup">
  <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-bold">Batches & subject assignments</h2><p className="mt-1 text-sm text-slate-500">Shared with Question Paper Generation for this institution.</p></div><button type="button" className={button} disabled={busy} onClick={()=>{setError('');setRefresh(n=>n+1);}}>Refresh</button></div>
  {error&&<p role="alert" className="text-sm text-rose-600">{error}</p>}{notice&&<p role="status" className="text-sm text-emerald-700">{notice}</p>}
  <details className="rounded-lg border p-4"><summary className="cursor-pointer font-semibold">Add admission batch</summary><form onSubmit={e=>void saveBatch(e)} className="mt-4 grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-4">
   <label className="text-sm">Batch year<input className={input} name="year" type="number" min="1900" max="2200" placeholder="2024" required/></label>
   <label className="text-sm">Programme<select name="program" className={input} required><option value="">Choose programme</option>{programs.map(p=><option key={p.code} value={p.code}>{p.display_name}</option>)}</select></label>
   <label className="text-sm">Batch label<input className={input} name="label" maxLength={120} placeholder="e.g. 2024–2028" required/></label><button className={button} disabled={busy||!programs.length}>Save batch</button>
  </form></details>
  {options?<>
   <details className="rounded-lg border p-4"><summary className="cursor-pointer font-semibold">Configured batches ({options.institution_batches?.length||0})</summary><ul className="mt-3 space-y-2 text-sm">{options.institution_batches?.map(b=><li className="flex flex-wrap items-center justify-between gap-2" key={b.id}><span>{b.entry_year==null?'Batch year not set':`Batch year ${b.entry_year}`} · {b.label} · {programs.find(p=>p.code===b.program_code)?.display_name||b.program_code}</span><button type="button" className={button} disabled={busy} onClick={()=>setEditing(b)}>Edit batch</button></li>)}</ul></details>
   {editing&&<form key={editing.id} onSubmit={e=>void updateBatch(e)} className="grid gap-4 rounded-lg border p-4 sm:grid-cols-2"><h3 className="font-bold sm:col-span-2">Edit {editing.label}</h3><label className="text-sm">Batch year<input name="year" className={input} type="number" min="1900" max="2200" defaultValue={editing.entry_year??''} required/></label><label className="text-sm">Batch label<input name="label" className={input} maxLength={120} defaultValue={editing.label} required/></label><div className="flex gap-2 sm:col-span-2"><button className={button} disabled={busy}>Save batch</button><button type="button" className={button} disabled={busy} onClick={()=>setEditing(null)}>Cancel</button></div></form>}
   <div><h3 className="mb-3 font-bold">Assign subjects to a batch and semester</h3><QpgInstitutionSelector options={options} contextOnly disabled={busy} onChange={value=>setContext(value)}/></div>
   {context&&<form className="space-y-4 rounded-lg border p-4" onSubmit={e=>void linkSubject(e)}>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={create} disabled={busy} onChange={e=>{setCreate(e.target.checked);setExisting('');}}/>Create a new institution subject</label>
    {create?<div className="grid gap-4 sm:grid-cols-2"><label className="text-sm">Subject code<input name="code" className={input} maxLength={80} required/></label><label className="text-sm">Subject name<input name="name" className={input} maxLength={500} required/></label></div>:<label className="block text-sm">Existing institution subject<select className={input} value={existing} onChange={e=>setExisting(e.target.value)} required><option value="">Choose subject</option>{options.erp_subjects.filter(s=>(!s.department_code||s.department_code===context.branch_code)&&!linked.some(l=>l.erp_subject_id===s.id)).map(s=><option key={s.id} value={s.id}>{s.code} · {s.name}</option>)}</select></label>}
    <button className={button} disabled={busy||(!create&&!existing)}>{busy?'Saving…':create?'Create & assign subject':'Assign subject'}</button>
    <div><h4 className="font-semibold">Assigned subjects ({linked.length})</h4>{linked.length?<ul className="mt-2 space-y-1 text-sm">{linked.map(s=><li key={s.id}>{s.code} · {s.name}</li>)}</ul>:<p className="mt-2 text-sm text-slate-500">No subjects assigned yet.</p>}</div>
   </form>}
  </>:!error&&<p role="status">Loading institution records…</p>}
 </section>;
}
