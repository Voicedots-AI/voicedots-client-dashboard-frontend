import type {Mentee} from './mentor-model';
export type MenteeFilters={query:string;batch:string;degree:string;department:string;semester:string};
export const emptyMenteeFilters=():MenteeFilters=>({query:'',batch:'',degree:'',department:'',semester:''});
const text=(value:unknown)=>String(value??'').trim();
export function filterMentees(rows:Mentee[],filters:MenteeFilters){
 const query=filters.query.trim().toLocaleLowerCase();
 return rows.filter(row=>(['batch','degree','department','semester'] as const).every(key=>!filters[key]||text(row[key])===filters[key])&&(!query||[row.name,row.rollNumber,row.email,row.id].some(value=>text(value).toLocaleLowerCase().includes(query))));
}
export function menteeFilterOptions(rows:Mentee[],field:'batch'|'degree'|'department'|'semester'){
 return [...new Set(rows.map(row=>text(row[field])).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'en',{numeric:true,sensitivity:'base'}));
}
export function selectableMentees(rows:Mentee[]){return rows.filter(row=>!row.mentorId&&row.student_status!=='inactive');}
export function toggleMenteePage(selected:string[],rows:Mentee[]){
 const eligible=selectableMentees(rows).map(row=>row.id),all=eligible.length>0&&eligible.every(id=>selected.includes(id));
 return all?selected.filter(id=>!eligible.includes(id)):[...new Set([...selected,...eligible])];
}
