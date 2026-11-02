import { SharedScorecard, type ScorecardView } from '@/shared-assessment/Scorecard';
import './candidate-scorecard.css';
type Dimension = {dimension:string;percentage?:number|null;reason?:string};
type View = {employer_follow_up?:string[];role_targets?:Record<string,number>;rubric_version?:string;overall_score?:number|null;readiness?:string;candidate_info?:{full_name?:string;program?:string;department?:string;year_of_study?:string};score_breakdown:Record<string,number|null>;core_dimensions:Dimension[];domain_dimensions:Dimension[];executive_summary?:string;strengths:Array<{text:string}>;priority_improvement_areas:Array<{focus?:string;problem?:string;actions?:string[]}>;question_reviews:Array<{answer_id?:number;question?:string;answer?:string;seconds?:number|null;score?:number}>;candidate_satisfaction?:{score:number;label?:string}};

export function CandidateScorecard({view,onFeedback:_onFeedback}:{view:View;onFeedback:()=>void}) {
  const scorecardView:ScorecardView = {
    overall_score: view.overall_score,
    readiness: view.readiness,
    executive_summary: view.executive_summary,
    score_breakdown: view.score_breakdown,
    core_dimensions: view.core_dimensions as ScorecardView['core_dimensions'],
    domain_dimensions: view.domain_dimensions as ScorecardView['domain_dimensions'],
    candidate_satisfaction: view.candidate_satisfaction as ScorecardView['candidate_satisfaction'],
  };
  return <SharedScorecard view={{...scorecardView,strengths:view.strengths,priority_improvement_areas:view.priority_improvement_areas,question_reviews:view.question_reviews,employer_follow_up:view.employer_follow_up}}/>;
}
