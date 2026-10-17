import type {DocumentStyle,DocumentDetails} from './qpgDocumentSettings';
import {useEffect,useMemo,useRef,useState} from 'react';
import type {Build as AiBuild} from './QpgAiBuildPanel';
import {qpgApi} from '@/api/qpgApi';
import {collegeError} from '@/api/collegeApi';
import type {Subject} from '@/api/qpgApi';
import type {PaperTemplate} from './QpgTemplatesPanel';
import QpgRenderPreview from './QpgRenderPreview';
import type {RenderModel} from './QpgRenderPreview';

type Props={onCustomize?:(part:string)=>void;selection?:{number:string;sequence:number}|null;aiBuild?:AiBuild|null;paper:{id:string;revision:number;status:string;metadata?:{document_details?:DocumentDetails;document_style?:DocumentStyle}};subject:Subject;template:string;templates:PaperTemplate[];onTemplate:(id:string)=>void;onManage:()=>void;onPatterns:()=>void;draft?:{title:string;instructions:string;examinationSession:string;documentDetails?:DocumentDetails;documentStyle?:DocumentStyle};dirty:boolean;onQuestion:(number:string)=>void;onDetails:()=>void};
export default function QpgStudioPreview({onCustomize,paper,subject,template,draft,dirty,onQuestion,onDetails,aiBuild,selection}:Props){
 const [model,setModel]=useState<RenderModel|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(false),[zoom,setZoom]=useState('page'),[retry,setRetry]=useState(0),[frameWidth,setFrameWidth]=useState(0),[frameHeight,setFrameHeight]=useState(0),[page,setPage]=useState(0),[pageCount,setPageCount]=useState(1);
 const [dismissedDraftNotice,setDismissedDraftNotice]=useState('');
 const frameRef=useRef<HTMLDivElement>(null);
 const sheetRef=useRef<HTMLDivElement>(null);
 const scopeRef=useRef('');
 const handledNavigation=useRef('');
 useEffect(()=>{const node=frameRef.current;if(!node)return;const observer=new ResizeObserver(entries=>{setFrameWidth(entries[0].contentRect.width);setFrameHeight(entries[0].contentRect.height);});observer.observe(node);return()=>observer.disconnect();},[]);
 useEffect(()=>{
  if(!selection)return;
  const requestKey=`${selection.sequence}:${selection.number}`;if(handledNavigation.current===requestKey)return;
  const frame=frameRef.current;if(!frame)return;
  const key=selection.number.replace(/[^a-z0-9]/gi,'').toLowerCase();
  const target=Array.from(frame.querySelectorAll<HTMLElement>('[data-preview-question]')).find(node=>node.dataset.previewQuestion===key);
  if(!target)return;
  handledNavigation.current=requestKey;
  const rect=target.getBoundingClientRect();
  const sheet=sheetRef.current;if(sheet){const sheetRect=sheet.getBoundingClientRect();const ratio=sheetRect.width/700;const flow=sheet.querySelector<HTMLElement>('article');const flowRect=flow?.getBoundingClientRect();if(flowRect)setPage(Math.max(0,Math.floor((rect.left-flowRect.left)/ratio/700)));}
  frame.scrollTo({top:0,left:0});
 },[selection,model]);
 const aiBuildId=aiBuild?.id;
 const buildStale=aiBuild?.stale;
 const candidatePreview=!!aiBuild&&aiBuild.positions.some(p=>p.job?.results.some(r=>r.decision!=='REJECTED'));
 const candidateRevision=aiBuild?.positions.map(p=>`${p.item_id}:${p.job?.id}:${p.job?.revision}`).join('|')||'';

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
 const widthScale=Math.min(1,Math.max(.1,(frameWidth-16)/700));
 const scale=zoom==='page'?Math.min(widthScale,Math.max(.1,(frameHeight-16)/990)):zoom==='fit'?widthScale:Number(zoom)/100;
 useEffect(()=>{
  let cancelled=false;
  const measure=()=>{if(cancelled)return;const flow=sheetRef.current?.querySelector<HTMLElement>('article');if(!flow)return;const count=Math.max(1,Math.ceil((flow.scrollWidth-36)/700));setPageCount(count);setPage(current=>Math.min(current,count-1));};
  const raf=requestAnimationFrame(measure);void document.fonts.ready.then(measure);window.addEventListener('qpg-image-loaded',measure);
  return()=>{cancelled=true;cancelAnimationFrame(raf);window.removeEventListener('qpg-image-loaded',measure);};
 },[liveModel,scale]);
 useEffect(()=>{setPage(0);setPageCount(1);},[paper.id]);



 return <div className="qpg-preview-shell"><header className="qpg-preview-header"><div><h3>Paper preview</h3><p>{paper.status==='LOCKED'?'Final document':candidatePreview?'AI candidate draft · not assembled':dirty?'Live · unsaved details':'Live preview'} · Revision {paper.revision}</p></div><div className="qpg-preview-navigation"><button type="button" className="qpg-preview-edit-link" onClick={onDetails} title="Open paper details">Edit details ↗</button><label className="text-xs">Zoom <select aria-label="Preview zoom" value={zoom} onChange={e=>setZoom(e.target.value)}><option value="page">Fit page</option><option value="fit">Fit width</option>{[65,85,100].map(n=><option key={n} value={n}>{n}%</option>)}</select></label></div></header>

 {candidatePreview&&dismissedDraftNotice!==`${paper.id}:${aiBuildId}`&&<div role="status" className="qpg-preview-draft-notice"><span>AI draft preview. Save and assemble candidates to add them to this paper.</span><button type="button" aria-label="Dismiss AI draft notice" title="Dismiss notice" onClick={()=>setDismissedDraftNotice(`${paper.id}:${aiBuildId}`)}>×</button></div>}



 <div ref={frameRef} className="qpg-preview-canvas" role="region" aria-label="Scrollable paper preview" tabIndex={0} aria-busy={loading}>{loading&&<p role="status" className="qpg-preview-update">Updating preview…{model?' Previous preview shown.':''}</p>}{error&&<div role="alert" className="qpg-preview-error"><p>{error}</p>{model&&<p>Previous preview shown.</p>}<button type="button" onClick={()=>setRetry(n=>n+1)}>Retry preview</button></div>}{liveModel&&<div ref={sheetRef} style={{width:700,height:990,zoom:scale}} className="qpg-preview-sheet qpg-paginated-sheet"><div className="qpg-page-flow" style={{transform:`translateX(-${page*700}px)`}}><QpgRenderPreview model={liveModel} onQuestion={onQuestion} selectedQuestion={selection?.number} onFormat={onCustomize}/></div></div>}</div><nav className="qpg-page-navigation" aria-label="Preview pages"><button type="button" disabled={page===0} onClick={()=>{setPage(p=>p-1);frameRef.current?.scrollTo({top:0,left:0});}}>← Previous</button><span aria-live="polite">Page {page+1} of {pageCount}</span><button type="button" disabled={page>=pageCount-1} onClick={()=>{setPage(p=>p+1);frameRef.current?.scrollTo({top:0,left:0});}}>Next →</button></nav><p className="p-3 text-xs text-slate-500">{paper.status==='LOCKED'?'Export uses this selected template.':'Live page preview. Final PDF and Word page breaks may differ.'}</p>
 </div>;
}
