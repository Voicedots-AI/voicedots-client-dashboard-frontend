import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { qpgApi } from '@/api/qpgApi';
import { collegeError } from '@/api/collegeApi';

const field='w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';
type Student={id:string;full_name:string;roll_number:string;program:string;department_code:string;batch_label:string|null};
type Curriculum={context_key:string;institution_name:string;education_level:string;program_name:string;branch_name:string;batch_name:string;specialization_name:string;subject_count:number};
type Resolution={student:Student;status:'matched'|'no_match'|'ambiguous'|'profile_incomplete';profile_key:string;context:Curriculum|null;match_method:'automatic'|'admin'|null;candidates:Curriculum[];message:string};
const curriculumLabel=(c:Curriculum)=>[c.institution_name,c.education_level,c.program_name,c.branch_name,c.specialization_name,c.batch_name].filter(Boolean).join(' · ');

export default function QpgStudentAccessPanel(){
  const [search,setSearch]=useState('');
  const [query,setQuery]=useState('');
  const [students,setStudents]=useState<Student[]>([]);
  const [studentId,setStudentId]=useState('');
  const [resolution,setResolution]=useState<Resolution|null>(null);
  const [choice,setChoice]=useState('');
  const [loading,setLoading]=useState(false);
  const [loadingStudents,setLoadingStudents]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [refresh,setRefresh]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();setLoadingStudents(true);setError('');
    qpgApi.get<{items:Student[]}>(`student-curriculum/students?q=${encodeURIComponent(query)}`,controller.signal)
      .then(r=>{if(!controller.signal.aborted)setStudents(r.items);})
      .catch(e=>{if(!controller.signal.aborted)setError(collegeError(e));})
      .finally(()=>{if(!controller.signal.aborted)setLoadingStudents(false);});
    return ()=>controller.abort();
  },[query,refresh]);
  useEffect(()=>{
    setResolution(null);setChoice('');
    if(!studentId){setLoading(false);return;}
    const controller=new AbortController();setLoading(true);setError('');
    qpgApi.get<Resolution>(`student-curriculum/${encodeURIComponent(studentId)}`,controller.signal)
      .then(r=>{if(!controller.signal.aborted){setResolution(r);setChoice(r.context?.context_key||'');}})
      .catch(e=>{if(!controller.signal.aborted)setError(collegeError(e));})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return ()=>controller.abort();
  },[studentId,refresh]);
  async function save(contextKey:string|null){
    if(!resolution)return;
    setBusy(true);setError('');setNotice('');
    try{
      const result=await qpgApi.save<Resolution>(`student-curriculum/${encodeURIComponent(studentId)}`,{profile_key:resolution.profile_key,context_key:contextKey});
      setResolution(result);setChoice(result.context?.context_key||'');
      setNotice(contextKey?'Curriculum choice saved. Student QP will use this curriculum.':'Automatic curriculum matching restored.');
    }catch(e){setError(collegeError(e));}
    finally{setBusy(false);}
  }
  function submit(event:FormEvent){event.preventDefault();setStudentId('');setNotice('');setQuery(search.trim());setRefresh(value=>value+1);}
  return <section className="erp-card" aria-label="Student QP curriculum matching">
    <h2>Student curriculum matching</h2>
    <p className="mb-5 mt-2 text-sm text-slate-500">Student QP automatically matches the institution, program, department and batch in the student roster. Select a student to check access. Choose a specialization only when multiple curricula match.</p>
    <form onSubmit={submit} className="mb-4 flex flex-wrap items-end gap-3">
      <label className="grid flex-1 gap-2 text-sm">Student name or roll number<input className={field} type="search" value={search} maxLength={100} disabled={busy} onChange={e=>setSearch(e.target.value)} placeholder="Search students"/></label>
      <Button type="submit" disabled={busy||loadingStudents}>Search</Button>
    </form>
    {error&&<div role="alert" className="my-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}<Button variant="ghost" size="sm" disabled={busy} onClick={()=>setRefresh(v=>v+1)}>Refresh</Button></div>}
    {notice&&<p role="status" className="my-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
    {loadingStudents?<p role="status" className="text-sm">Loading students…</p>:<label className="grid gap-2 text-sm">Student<select className={field} value={studentId} disabled={busy} onChange={e=>{setStudentId(e.target.value);setNotice('');}}><option value="">Select student</option>{students.map(s=><option key={s.id} value={s.id}>{s.full_name} · {s.roll_number}</option>)}</select><span className="text-xs text-slate-500">Showing up to 25 active students. Search to find another student.</span></label>}
    {loading&&<p role="status" className="mt-4 text-sm">Checking curriculum match…</p>}
    {!loading&&resolution&&<div className="mt-5 space-y-4 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
      <p className="text-sm">{[resolution.student.program,resolution.student.department_code,resolution.student.batch_label||'Batch missing'].join(' · ')}</p>
      <p role="status" className="text-sm font-medium">{resolution.status==='matched'?resolution.match_method==='admin'?'Curriculum selected by administrator':'Automatically matched':resolution.status==='ambiguous'?'Curriculum choice required':resolution.status==='no_match'?'No matching curriculum':'Academic profile incomplete'}</p>
      <p className="text-sm text-slate-500">{resolution.message}</p>
      {resolution.context&&<div className="rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-900"><p>{curriculumLabel(resolution.context)}</p><p className="mt-2 text-xs text-slate-500">{resolution.context.subject_count} subjects · Students see published syllabi and explicitly released questions and papers.</p></div>}
      {resolution.candidates.length>1&&<><label className="grid gap-2 text-sm">Matching curriculum<select className={field} disabled={busy} value={choice} onChange={e=>setChoice(e.target.value)}><option value="">Select the correct curriculum</option>{resolution.candidates.map(c=><option key={c.context_key} value={c.context_key}>{curriculumLabel(c)}</option>)}</select></label><Button disabled={busy||!choice||choice===resolution.context?.context_key} onClick={()=>void save(choice)}>{busy?'Saving…':'Save curriculum choice'}</Button></>}
      {resolution.match_method==='admin'&&<Button variant="outline" disabled={busy} onClick={()=>void save(null)}>Use automatic matching</Button>}
      {(resolution.status==='no_match'||resolution.status==='profile_incomplete')&&<p className="text-sm text-slate-500">Check the student roster and the academic details saved in Subject Master. Missing details are never guessed.</p>}
    </div>}
  </section>;
}
