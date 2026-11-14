import type {Mentee,Mentor} from './mentor-model';
export const insightColors=['#7360ff','#10c7a1','#139aff','#ffab18','#f1d43b','#dce2ee'];
export const measured=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=100;
export function mentorInsight(students:Mentee[]){
 const scores=students.map(s=>s.readiness).filter(measured);
 const counts=[scores.filter(n=>n>=80).length,scores.filter(n=>n>=50&&n<80).length,scores.filter(n=>n<50).length,students.length-scores.length];
 const today=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'});
 const due=students.flatMap(student=>student.milestoneItems.filter(m=>!m.done&&m.due&&m.due.slice(0,10)<=today).map(milestone=>({student,milestone})));
 const engaged=students.filter(s=>s.milestoneItems.length>0||Boolean(s.notes?.trim()||s.plan?.trim())||(s.aiTasksCompleted||0)>0);
 return {counts,assessed:scores.length,average:scores.length?Math.round(scores.reduce((a,b)=>a+b,0)/scores.length):null,due,engaged:engaged.length,engagement:students.length?Math.round(engaged.length/students.length*100):null,milestones:students.reduce((n,s)=>n+s.milestones,0)};
}
export function mentorReportRows(students:Mentee[],mentors:Mentor[]){return mentors.map(mentor=>{const own=students.filter(s=>s.mentorId===mentor.id);return {mentor,students:own,...mentorInsight(own)}}).sort((a,b)=>(b.average??-1)-(a.average??-1)||a.mentor.name.localeCompare(b.mentor.name))}
export function insightRing(counts:number[],colors:string[]){let cursor=0;const total=counts.reduce((a,b)=>a+b,0);return total?`conic-gradient(${counts.map((count,index)=>{const start=cursor;cursor+=count/total*100;return `${colors[index%colors.length]} ${start}% ${cursor}%`}).join(',')})`:'#e8edf5'}
export const academicYear=()=>{const now=new Date(),year=now.getFullYear()-(now.getMonth()<6?1:0);return `${year} – ${year+1}`};
