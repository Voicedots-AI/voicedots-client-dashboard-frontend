import {useEffect,useState} from 'react';
import {createPortal} from 'react-dom';
import {apiClient} from '@/api/apiClient';
import Dialog from './QpgDialog';
export type QuestionImage={asset_id:string;placement:'QUESTION'|'OPTION'|'ANSWER';option_index:number|null;caption:string;alt_text:string;width_percent:number;alignment:'LEFT'|'CENTER'|'RIGHT';data_url?:string};
export function useQuestionImageUrl(image:QuestionImage){
 const [url,setUrl]=useState(image.data_url||''),[failed,setFailed]=useState(false);
 useEffect(()=>{if(image.data_url){setUrl(image.data_url);return;}let objectUrl='';const controller=new AbortController();setUrl('');setFailed(false);apiClient.get(`/v3/college/question-papers/images/${encodeURIComponent(image.asset_id)}/content`,{responseType:'blob',signal:controller.signal}).then(result=>{if(!controller.signal.aborted){objectUrl=URL.createObjectURL(result.data);setUrl(objectUrl);}}).catch(()=>{if(!controller.signal.aborted)setFailed(true);});return()=>{controller.abort();if(objectUrl)URL.revokeObjectURL(objectUrl);};},[image.asset_id,image.data_url]);
 return {url,failed};
}
export function QuestionImageView({image,interactive=true}:{image:QuestionImage;interactive?:boolean}){
 const {url,failed}=useQuestionImageUrl(image);const [expanded,setExpanded]=useState(false);
 const picture=<img src={url} alt={image.alt_text||image.caption||'Question diagram'} className="h-auto w-full max-w-full" onLoad={()=>window.dispatchEvent(new Event('qpg-image-loaded'))}/>;
 return <figure className="my-2" style={{breakInside:'avoid',width:`${image.width_percent}%`,marginLeft:image.alignment==='LEFT'?0:'auto',marginRight:image.alignment==='RIGHT'?0:'auto'}}>{url?(interactive?<button type="button" className="block w-full cursor-zoom-in rounded bg-transparent p-0 focus-visible:outline focus-visible:outline-violet-500" aria-label="Enlarge diagram" onClick={()=>setExpanded(true)}>{picture}</button>:picture):<p className="text-xs text-slate-500">{failed?'Image unavailable. Retry opening this question.':'Loading diagram…'}</p>}{image.caption&&<figcaption className="mt-1 text-center text-xs">{image.caption}</figcaption>}{expanded&&createPortal(<Dialog wide title="Diagram preview" onClose={()=>setExpanded(false)}><img src={url} alt={image.alt_text||image.caption||'Question diagram'} className="mx-auto max-h-[70vh] max-w-full object-contain"/>{image.caption&&<p className="mt-3 text-center text-sm">{image.caption}</p>}</Dialog>,document.body)}</figure>;
}
export default function QpgQuestionImages({images=[],placement='QUESTION',optionIndex}:{images?:QuestionImage[];placement?:QuestionImage['placement'];optionIndex?:number}){return <>{images.filter(i=>i.placement===placement&&(placement!=='OPTION'||i.option_index===optionIndex)).map((image,index)=><QuestionImageView key={`${image.asset_id}-${index}`} image={image}/>)}</>;}
