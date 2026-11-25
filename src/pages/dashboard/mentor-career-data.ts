export type CareerRole={role?:string;why?:string;matched_skills?:string[];missing_skills?:string[];learn_next?:string[];progression?:string;evidence_level?:string;project_evidence?:string[]};
export type CareerReport={id:string;resume_id:string;created_at:string;model_version?:string;report:{career_profile?:string;strongest_current_fit?:string;strongest_growth_path?:string;best_project_next?:string;recommended_roles?:CareerRole[];alternative_careers?:string[];what_to_learn_next?:string[];career_gap_analysis?:string;market_data_note?:string;analysis_status?:string;analysis_note?:string}};
export type CareerData={studentId:string;currentResumeId:string|null;reports:CareerReport[]};
// Match the student Career Coach history: incomplete fallback results are hidden.
export function visibleCareerReports(reports:CareerReport[]){
 return reports.filter(row=>row.report.analysis_status!=='evidence_fallback'&&!(row.report.analysis_status==null&&row.model_version==='career-finder-v3'));
}
export function selectedCareerReport(data:CareerData,selectedId:string){
 const reports=visibleCareerReports(data.reports);
 return reports.find(row=>row.id===selectedId)||reports.find(row=>Boolean(data.currentResumeId)&&row.resume_id===data.currentResumeId);
}
export function interviewDistribution(students:{readiness:number|null}[]){
 const assessed=students.flatMap(s=>typeof s.readiness==='number'&&Number.isFinite(s.readiness)&&s.readiness>=0&&s.readiness<=100?[s.readiness]:[]);
 return {average:assessed.length?Math.round(assessed.reduce((a,b)=>a+b,0)/assessed.length):null,assessed:assessed.length,total:students.length,counts:[assessed.filter(n=>n>=80).length,assessed.filter(n=>n>=60&&n<80).length,assessed.filter(n=>n<60).length,students.length-assessed.length]};
}
