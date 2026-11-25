export type CandidateDirectoryPage<T, G> = {
 items?:T[];candidates?:T[];total?:number;pagination?:{total:number};assigned_groups?:G[];
};

// Collect every authorized page without assuming the server honors our batch size.
export async function collectCandidatePages<T extends {id?:string;student_id?:string;roll_number:string}, G>(
 fetchPage:(offset:number,limit:number)=>Promise<CandidateDirectoryPage<T,G>>,
 signal:AbortSignal,
) {
 const students:T[]=[];
 const seen=new Set<string>();
 let assignedGroups:G[]=[];
 let offset=0;
 let expected:number|undefined;
 while (true) {
  signal.throwIfAborted();
  const page=await fetchPage(offset,100);
  signal.throwIfAborted();
  const rows=page.candidates??page.items??[];
  expected=page.pagination?.total??page.total??expected;
  if (page.assigned_groups) assignedGroups=page.assigned_groups;
  if (!rows.length) {
   if (expected!=null&&students.length<expected) throw new Error('The complete candidate list could not be loaded. Please retry.');
   break;
  }
  let added=0;
  for (const row of rows) {
   const id=row.student_id||row.id||row.roll_number;
   if (!seen.has(id)) {seen.add(id);students.push(row);added++;}
  }
  if (!added) throw new Error('The candidate list did not advance. Please retry.');
  offset+=rows.length;
  if (expected!=null&&offset>=expected) {
   if (students.length<expected) throw new Error('The complete candidate list could not be loaded. Please retry.');
   break;
  }
 }
 return {students,assignedGroups,total:students.length};
}
