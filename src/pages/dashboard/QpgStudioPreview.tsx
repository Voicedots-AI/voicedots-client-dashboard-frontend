import type {ReactNode} from 'react';
import QpgStyleControls from './QpgStyleControls';
import type {DocumentStyle,DocumentDetails} from './qpgDocumentSettings';
import {useEffect,useMemo,useRef,useState} from 'react';
import type {Build as AiBuild} from './QpgAiBuildPanel';
import {qpgApi} from '@/api/qpgApi';
import {collegeError} from '@/api/collegeApi';
import type {Subject} from '@/api/qpgApi';
import type {PaperTemplate} from './QpgTemplatesPanel';
import QpgRenderPreview from './QpgRenderPreview';
import type {RenderModel} from './QpgRenderPreview';

type Props={exportControl?:ReactNode;onStyle?:(style:DocumentStyle)=>void;selection?:{number:string;sequence:number}|null;aiBuild?:AiBuild|null;paper:{id:string;revision:number;status:string;metadata?:{document_details?:DocumentDetails;document_style?:DocumentStyle}};subject:Subject;template:string;templates:PaperTemplate[];onTemplate:(id:string)=>void;onManage:()=>void;onPatterns:()=>void;draft?:{title:string;instructions:string;examinationSession:string;documentDetails?:DocumentDetails;documentStyle?:DocumentStyle};dirty:boolean;onQuestion:(number:string)=>void;onDetails:()=>void};
export default function QpgStudioPreview({exportControl,onStyle,paper,subject,template,templates,draft,dirty,onQuestion,onDetails,aiBuild,selection}:Props){
 const [model,setModel]=useState<RenderModel|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(false),[zoom,setZoom]=useState('fit'),[retry,setRetry]=useState(0),[frameWidth,setFrameWidth]=useState(0);
 const frameRef=useRef<HTMLDivElement>(null);
 const scopeRef=useRef('');const formattingRef=useRef<HTMLDetailsElement>(null);
 function focusFormatting(part:string){if(!formattingRef.current)return;formattingRef.current.open=true;const name=part==='college'?'College alignment':part==='title'?'Title alignment':'Section heading alignment';requestAnimationFrame(()=>{const fields=formattingRef.current?.querySelectorAll('label');for(const field of fields||[])if(field.textContent?.startsWith(name)){field.querySelector('select')?.focus({preventScroll:true});break;}});}
 const handledNavigation=useRef('');
 useEffect(()=>{const node=frameRef.current;if(!node)return;const observer=new ResizeObserver(entries=>setFrameWidth(entries[0].contentRect.width));observer.observe(node);return()=>observer.disconnect();},[]);
 useEffect(()=>{
  if(!selection)return;
  const requestKey=`${selection.sequence}:${selection.number}`;if(handledNavigation.current===requestKey)return;
  const frame=frameRef.current;if(!frame)return;
  const key=selection.number.replace(/[^a-z0-9]/gi,'').toLowerCase();
  const target=Array.from(frame.querySelectorAll<HTMLElement>('[data-preview-question]')).find(node=>node.dataset.previewQuestion===key);
  if(!target)return;
  handledNavigation.current=requestKey;
  const rect=target.getBoundingClientRect(),container=frame.getBoundingClientRect();
  frame.scrollTo({top:Math.max(0,frame.scrollTop+rect.top-container.top-24),behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
 },[selection,model]);
 const aiBuildId=aiBuild?.id;
 const buildStale=aiBuild?.stale;
 const candidatePreview=!!aiBuild&&aiBuild.positions.some(p=>p.job?.results.some(r=>r.decision!=='REJECTED'));
 const candidateRevision=aiBuild?.positions.map(p=>`${p.item_id}:${p.job?.id}:${p.job?.revision}`).join('|')||'';
 const choices=[{id:'university',name:'University',configuration:{institution_name:''}},{id:'default',name:'Institution',configuration:{institution_name:''}},...templates.filter(t=>t.status==='ACTIVE')];
 useEffect(()=>{const c=new AbortController();setLoading(true);setError('');if(scopeRef.current!==paper.id){setModel(null);scopeRef.current=paper.id;}
 const load=async()=>{
  if(paper.status==='LOCKED')return (await qpgApi.get<{render_model:RenderModel}>(`papers/${paper.id}/export-preview?revision=${paper.revision}&template_id=${encodeURIComponent(template)}&document_type=STUDENT`,c.signal)).render_model;
  if(candidatePreview&&buildStale)throw new Error('Generated questions are saved. Reconnecting the AI draft to this paper revision…');
  // Draft content and the selected template are read without changing the paper revision.
  const [content,layout]=await Promise.all([qpgApi.get<{render_model:RenderModel}>(candidatePreview?`papers/${paper.id}/ai-build/${aiBuildId}/preview?document_type=STUDENT&template_id=university`:`papers/${paper.id}/preview?revision=${paper.revision}`,c.signal),qpgApi.get<{render_model:RenderModel}>(`templates/${encodeURIComponent(template)}/preview`,c.signal)]);
  const source=content.render_model,appearance=layout.render_model;
  return {...source,institution:appearance.institution,layout:appearance.layout,logo_data_url:appearance.logo_data_url,fields:[...source.fields,...[{label:'Year',value:String(subject.year_number)},{label:'Semester',value:String(subject.semester_number)},{label:'Course Code',value:subject.code},{label:'Course Name',value:subject.name},{label:'Program',value:subject.program_code},{label:'Branch',value:subject.branch_code}].filter(f=>!source.fields.some(a=>a.label===f.label))].filter(f=>appearance.layout.show_fields?(['Duration','Maximum marks'].includes(f.label)||appearance.layout.show_fields.includes(f.label==='Maximum marks'?'maximum_marks':f.label.toLowerCase().replaceAll(' ','_'))):appearance.fields.some(a=>a.label===f.label)),sections:source.sections.map(s=>({...s,questions:s.questions.map(q=>({...q,mapping:appearance.sections.some(a=>a.questions.some(b=>!!b.mapping))?q.mapping:undefined}))}))};
 };
 void load().then(m=>{if(!c.signal.aborted)setModel(m);}).catch(e=>{if(!c.signal.aborted)setError(collegeError(e));}).finally(()=>{if(!c.signal.aborted)setLoading(false);});return()=>c.abort();
 },[paper.id,paper.revision,paper.status,template,retry,aiBuildId,buildStale,candidatePreview,candidateRevision,subject.year_number,subject.semester_number,subject.code,subject.name,subject.program_code,subject.branch_code]);
 const liveModel=useMemo(()=>{
  if(!model)return model;
  const printed=draft?.documentDetails||paper.metadata?.document_details||{};
  const collegeChanged=!!printed.institution_name?.trim()&&printed.institution_name.trim().toLowerCase()!==model.institution.name.trim().toLowerCase();
  const style=draft?.documentStyle||paper.metadata?.document_style||{};
  const values:Record<string,string|undefined>={'Program':printed.program,'Branch':printed.branch,'Year':printed.year,'Semester':printed.semester,'Academic Session':printed.academic_session,'Institution Short Name':printed.institution_short_name};
  let fields=model.fields.map(f=>({...f,value:values[f.label]?.trim()||f.value}));
  if(draft){fields=fields.filter(f=>f.label!=='Examination Session');if(draft.examinationSession&&(model.layout.show_fields?.includes('examination_session')||model.fields.some(f=>f.label==='Examination Session')))fields.push({label:'Examination Session',value:draft.examinationSession});}
  return {...model,title:draft?.title??model.title,instructions:draft?.instructions??model.instructions,fields,institution:{name:printed.institution_name?.trim()||model.institution.name,address:printed.address?.trim()||(collegeChanged?'':model.institution.address),contact:printed.contact?.trim()||(collegeChanged?'':model.institution.contact)},layout:{...model.layout,...Object.fromEntries(Object.entries(style).filter(([,v])=>v!=null))}};
 },[model,draft,paper.metadata]);
 const scale=zoom==='fit'?Math.min(1,Math.max(.3,(frameWidth-32)/700)):Number(zoom)/100;

 const heading=liveModel?.institution.name||choices.find(t=>t.id===template)?.configuration.institution_name;
 return <div className="qpg-preview-shell"><header className="qpg-preview-header"><div><h3>Paper preview</h3><p>{paper.status==='LOCKED'?'Final document':candidatePreview?'AI candidate draft · not assembled':dirty?'Live · unsaved details':'Live preview'} · Revision {paper.revision}</p></div><label className="text-xs">Zoom <select aria-label="Preview zoom" value={zoom} onChange={e=>setZoom(e.target.value)}><option value="fit">Fit width</option>{[65,85,100].map(n=><option key={n} value={n}>{n}%</option>)}</select></label></header>
 {exportControl}
 {heading&&<p className="px-4 py-2 text-xs text-slate-500">College heading: <strong>{heading}</strong></p>}{heading&&subject.institution_name&&heading.toLowerCase()!==subject.institution_name.toLowerCase()&&<p role="status" className="mx-4 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">The printed college differs from this subject’s institution. Check the college name in Paper details before downloading.</p>}
 {candidatePreview&&<p role="status" className="mx-4 mb-2 rounded-lg bg-violet-50 p-2 text-xs text-violet-800">Showing generated candidates, including questions not yet saved. Resolve the remaining questions, then assemble to make them part of the paper.</p>}
 {onStyle&&<details ref={formattingRef} className="qpg-template-picker"><summary className="qpg-template-summary"><span>Customize paper</span><span>Alignment, fonts &amp; spacing ⌄</span></summary><div className="mt-3"><QpgStyleControls value={draft?.documentStyle||paper.metadata?.document_style||{}} onChange={onStyle}/><button type="button" className="mt-3 text-xs text-violet-600" onClick={()=>onStyle({})}>Reset paper formatting</button><p className="mt-2 text-xs text-slate-500">Updates live. Save Draft to keep these settings. Select a college, title or section heading in the preview to customize it.</p></div></details>}
 <button type="button" className="qpg-preview-details-link" onClick={onDetails}>↗ Open paper details</button>
 <div ref={frameRef} className="qpg-preview-canvas" aria-busy={loading}>{loading&&<p role="status" className="qpg-preview-update">Updating preview…{model?' Previous preview shown.':''}</p>}{error&&<div role="alert" className="qpg-preview-error"><p>{error}</p>{model&&<p>Previous preview shown.</p>}<button type="button" onClick={()=>setRetry(n=>n+1)}>Retry preview</button></div>}{liveModel&&<div style={{width:700,zoom:scale}} className="qpg-preview-sheet"><QpgRenderPreview model={liveModel} onQuestion={onQuestion} selectedQuestion={selection?.number} onFormat={onStyle?focusFormatting:undefined}/></div>}</div><p className="p-3 text-xs text-slate-500">{paper.status==='LOCKED'?'Export uses this selected template.':'Details update live. Save Draft to keep your changes. Final page breaks are applied during export.'}</p>
 </div>;
}
