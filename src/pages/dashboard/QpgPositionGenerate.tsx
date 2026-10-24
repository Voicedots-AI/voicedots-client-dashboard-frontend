import {useState} from 'react';
import type {Subject,Question} from '@/api/qpgApi';
import {qpgApi} from '@/api/qpgApi';
import QpgGeneratePanel from './QpgGeneratePanel';
import type {QpgGenerationRequest} from './QpgGeneratePanel';
import Dialog from './QpgDialog';
export default function QpgPositionGenerate({subject,label,request,onClose,onUse,onReview}:{subject:Subject;label:string;request:QpgGenerationRequest;onClose:()=>void;onUse:(question:Question)=>Promise<void>;onReview:()=>void}){
 const [using,setUsing]=useState(false);
 return <Dialog wide title={`Generate replacement · Q${label}`} onClose={()=>{if(!using)onClose();}}><p className="mb-4 text-sm text-slate-500">Upload a reference diagram or use reviewed teaching material to generate a replacement. Your selected question stays in the paper until you click “Use in this position”.</p><QpgGeneratePanel subject={subject} canWrite onAccepted={()=>{}} initialRequest={request} onReview={onReview} onUseQuestion={async id=>{setUsing(true);try{await onUse(await qpgApi.get<Question>(`questions/${id}`));}finally{setUsing(false);}}}/></Dialog>;
}
