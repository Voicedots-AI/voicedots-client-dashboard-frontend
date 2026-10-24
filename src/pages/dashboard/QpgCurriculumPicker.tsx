import {useId,useRef,useState} from 'react';
import {ChevronDown,Trash2} from 'lucide-react';
import {Popover,PopoverContent,PopoverTrigger} from '@/components/ui/popover';

type Curriculum={id:string;filename:string;course_count:number;course_slots?:number|null;elective_option_count?:number|null};
const description=(row:Curriculum)=>`${row.filename} · ${row.course_count} ${row.course_count===1?'course':'courses'}`;

export default function QpgCurriculumPicker({rows,value,disabled,onSelect,onDelete}:{rows:Curriculum[];value:string;disabled:boolean;onSelect:(id:string)=>void;onDelete:(row:Curriculum)=>void}){
 const [open,setOpen]=useState(false);
 const deleting=useRef(false),triggerRef=useRef<HTMLButtonElement>(null);
 const labelId=useId(),selected=rows.find(row=>row.id===value);
 function select(id:string){setOpen(false);onSelect(id);}
 return <div className="qpg-saved-curriculum">
  <span id={labelId}>Saved curricula</span>
  <Popover open={open} onOpenChange={next=>{if(next)deleting.current=false;setOpen(next);}}>
   <PopoverTrigger asChild>
    <button ref={triggerRef} type="button" disabled={disabled} aria-labelledby={labelId} className="flex h-[46px] w-full items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 text-left text-[13px] text-slate-800 outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
     <span className="min-w-0 truncate" title={selected?description(selected):undefined}>{selected?description(selected):'Select a curriculum'}</span>
     <ChevronDown size={15} className={`shrink-0 text-slate-400 ${open?'rotate-180':''}`} aria-hidden="true"/>
    </button>
   </PopoverTrigger>
   <PopoverContent align="start" sideOffset={3} showArrow={false} aria-label="Saved curricula" className="max-h-56 overflow-y-auto rounded-md p-0 shadow-md" style={{width:'var(--radix-popover-trigger-width)',maxWidth:'calc(100vw - 32px)'}} onCloseAutoFocus={event=>{if(deleting.current)event.preventDefault();}}>
    <button type="button" className="flex h-9 w-full items-center px-3 text-left text-[13px] text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800" onClick={()=>select('')}>Select a curriculum</button>
    {rows.map(row=><div key={row.id} className={`flex h-9 items-center border-t border-slate-100 dark:border-slate-800 ${value===row.id?'bg-indigo-50 dark:bg-indigo-950/40':'hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
     <button type="button" aria-pressed={value===row.id} title={description(row)} className="h-full min-w-0 flex-1 truncate px-3 text-left text-[13px] font-normal text-slate-800 focus-visible:outline-violet-500 dark:text-slate-100" onClick={()=>select(row.id)}>{description(row)}</button>
     <button type="button" aria-label={`Delete ${row.filename}`} title="Delete curriculum" className="mr-1 grid h-7 w-7 shrink-0 place-items-center rounded text-red-500 hover:bg-red-50 hover:text-red-700 focus-visible:outline-red-500 dark:hover:bg-red-950/30" onClick={()=>{deleting.current=true;setOpen(false);triggerRef.current?.focus();onDelete(row);}}><Trash2 size={14} aria-hidden="true"/></button>
    </div>)}
    {!rows.length&&<p className="px-3 py-3 text-[13px] text-slate-500">No saved curricula yet.</p>}
   </PopoverContent>
  </Popover>
 </div>;
}
