import type {ReattemptPlan} from '@/shared-student-coach/CoachScheduleReattemptView';
import type {SavedJourney} from '@/shared-journey/JourneyReview';
import {UserFacingError} from '@/lib/userFacingError';
export type CoachMessage={speaker?:'student'|'officer';text?:string;role?:string;content?:string;saved_at?:string;created_at?:string;imported?:boolean;metadata?:Record<string,unknown>};
export type CoachPlan={id:string;drive_id:string;company_name?:string;role_title?:string;target_date?:string;plan:Record<string,unknown>;messages?:CoachMessage[]};
export type SavedCoaching={plans:CoachPlan[];cycles:Record<string,unknown>[];discussions:{id:string;mode:string;source:string;plan_id?:string;report_session_id?:string;messages:CoachMessage[]}[]};
export type StudentJourneyResponse={student_id:string;drive_id:string;journey:SavedJourney|null;reports?:Record<string,unknown>[];reattempt?:ReattemptPlan;coaching?:SavedCoaching};
export function validateStudentJourney(value:StudentJourneyResponse,studentId:string,driveId:string){
 if(!value||value.student_id!==studentId||value.drive_id!==driveId||!('journey' in value)||value.journey!==null&&(!value.journey.id||value.journey.drive_id!==driveId)){
  throw new UserFacingError('The progress response does not match this student and drive.');
 }
}
