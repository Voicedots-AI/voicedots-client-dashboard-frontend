import type {SavedJourney} from '@/shared-journey/JourneyReview';
import {UserFacingError} from '@/lib/userFacingError';
export type StudentJourneyResponse={student_id:string;drive_id:string;journey:SavedJourney|null};
export function validateStudentJourney(value:StudentJourneyResponse,studentId:string,driveId:string){
 if(!value||value.student_id!==studentId||value.drive_id!==driveId||!('journey' in value)||value.journey!==null&&(!value.journey.id||value.journey.drive_id!==driveId)){
  throw new UserFacingError('The progress response does not match this student and drive.');
 }
}
