type FilenameContext={institutionName:string;institutionShortName?:string;subjectCode?:string;subjectName?:string;year?:string|number;semester?:string|number;kind:string;format:string;version:number;revision:number};
const clean=(value:string,max:number)=>Array.from(value.normalize('NFKC').trim().replace(/[^\p{L}\p{N}]+/gu,'-')).slice(0,max).join('').replace(/^-+|-+$/g,'');

export function paperExportFilename(context:FilenameContext){
 const configured=clean(context.institutionShortName||'',20);
 const words=context.institutionName.match(/[\p{L}\p{N}]+/gu)||[];
 const initials=words.filter(word=>!['of','the','and','for','an'].includes(word.toLowerCase())).map(word=>word===word.toUpperCase()&&word.length>1?word:word[0].toUpperCase()).join('');
 const college=configured&&!/^CLIENT-/i.test(configured)&&!/^[a-f\d]{20,}$/i.test(configured)?configured:clean(initials,20)||'College';
 const parts=[college,clean(context.subjectCode||'',24),clean(context.subjectName||'',80),context.year?`Year-${clean(String(context.year),8)}`:'',context.semester?`Sem-${clean(String(context.semester),8)}`:'',context.kind==='ANSWER'?'Answer-Key':'Question-Paper',`v${context.version}-r${context.revision}`];
 return parts.filter(Boolean).join('_')+'.'+(context.format.toUpperCase()==='DOCX'?'docx':'pdf');
}
