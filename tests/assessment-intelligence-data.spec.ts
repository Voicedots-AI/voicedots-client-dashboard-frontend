import {test,expect} from '@playwright/test';
import {assessmentSummary,atsKey,currentATSScore,driveHistory,initialFilters,matchesAssessmentFilters,type AssessmentBundle,type ATSState} from '../src/pages/dashboard/assessmentIntelligenceData';
const bundle:AssessmentBundle={student:{id:'student-1',full_name:'Test Student',email:'student@example.test',roll_number:'T1',program:'B.Tech',department_code:'CSE',graduation_year:2027,status:'active'},drives:[{drive_id:'drive-1',company_name:'Company One',role_title:'Engineer',assigned_at:'2026-10-10',assignment_status:'completed'},{drive_id:'drive-2',company_name:'Company Two',role_title:'Analyst',assigned_at:'2026-10-20',assignment_status:'invited'}],reports:[{drive_id:'drive-1',overall_score:40,completed_at:'2026-09-20'},{drive_id:'drive-1',overall_score:72,completed_at:'2026-10-20'},{overall_score:100,completed_at:'2026-10-21'}]};
const ats:Record<string,ATSState>={[atsKey('student-1','drive-1')]:{row:{student_id:'student-1',ats_status:'evaluated',ats_fit_score:62,skills:[{skill:'Python',match_status:'FULL_MATCH'}]}},[atsKey('student-1','drive-2')]:{row:{student_id:'student-1',ats_status:'processing',ats_fit_score:99}}};

test('history deduplicates drives and uses the latest placement report, excluding self-practice',()=>{
 const history=driveHistory(bundle);expect(history).toHaveLength(2);expect(history.find(row=>row.drive.drive_id==='drive-1')?.report?.overall_score).toBe(72);
});
test('averages use evaluated scores only and do not turn pending values into current ATS data',()=>{
 const summary=assessmentSummary(bundle,ats);expect(summary.averageATS).toBe(62);expect(summary.bestScore).toBe(72);expect(summary.participated).toBe(1);expect(summary.assessed).toBe(1);expect(summary.pending).toBe(true);
 expect(currentATSScore({student_id:'student-1',ats_status:'processing',ats_fit_score:99})).toBeNull();
});
test('missing assessments remain unknown, including zero versus absent scores',()=>{
 expect(currentATSScore({student_id:'student-1',ats_status:'evaluated',ats_fit_score:0})).toBe(0);
 expect(currentATSScore({student_id:'student-1',ats_status:'evaluated',ats_fit_score:101})).toBeNull();
 expect(assessmentSummary({...bundle,reports:[]},{}).bestScore).toBeNull();
 expect(assessmentSummary(bundle,{}).averageATS).toBeNull();
});
test('assessment filters are applied to actual loaded evidence and not placeholder values',()=>{
 expect(matchesAssessmentFilters(bundle,ats,{...initialFilters,minATS:60,skill:'python',minScore:70,minDrives:2,company:'Company One'})).toBe(true);
 expect(matchesAssessmentFilters(bundle,ats,{...initialFilters,minATS:75})).toBe(false);
 expect(matchesAssessmentFilters(bundle,ats,{...initialFilters,skill:'Kubernetes'})).toBe(false);
 expect(matchesAssessmentFilters(undefined,ats,{...initialFilters,minATS:1})).toBe(false);
 expect(matchesAssessmentFilters(bundle,ats,{...initialFilters,from:'2026-10-15',to:'2026-10-25'})).toBe(true);
 expect(matchesAssessmentFilters(bundle,ats,{...initialFilters,from:'2027-01-01'})).toBe(false);
});
test('data lookup keys keep different candidates and drives separate',()=>{
 expect(atsKey('student-1','drive-1')).not.toBe(atsKey('student-2','drive-1'));
 expect(assessmentSummary({...bundle,student:{...bundle.student,id:'student-2'}},ats).averageATS).toBeNull();
});
