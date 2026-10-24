import {useState} from 'react';
import type {Question} from '@/api/qpgApi';
import type {QuestionImage} from './QpgQuestionImages';
import QpgImageEditor from './QpgImageEditor';
import Dialog from './QpgDialog';
import {Button} from '@/components/ui/button';
import {collegeError} from '@/api/collegeApi';
export default function QpgPositionImages({subjectId,label,question,onClose,onSave}:{subjectId:string;label:string;question:Question;onClose:()=>void;onSave:(images:QuestionImage[])=>Promise<void>}){
 const [images,setImages]=useState<QuestionImage[]>(question.images||[]),[busy,setBusy]=useState(false),[uploading,setUploading]=useState(false),[error,setError]=useState('');
 return <Dialog title={`Images · Q${label}`} onClose={()=>{if(!busy&&!uploading)onClose();}}><p className="mb-3 whitespace-pre-wrap text-sm">{question.question_text}</p><p className="mb-3 text-xs text-slate-500">Save creates a separate question variant for this paper position. The original bank question is preserved.</p><QpgImageEditor subjectId={subjectId} questionType={question.question_type} optionCount={question.options.length} images={images} onChange={setImages} disabled={busy} onBusyChange={setUploading}/>{error&&<p role="alert" className="my-3 text-red-700">{error}</p>}<div className="mt-4 flex justify-end gap-2"><Button variant="outline" disabled={busy||uploading} onClick={onClose}>Cancel</Button><Button disabled={busy||uploading} onClick={()=>{setBusy(true);setError('');void onSave(images).catch(e=>setError(collegeError(e))).finally(()=>setBusy(false));}}>{busy?'Saving…':'Save images to paper'}</Button></div></Dialog>;
}
