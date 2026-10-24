import {createUuid} from '@/lib/uuid';
import type {Config} from './QpgBlueprintPanel';
import type {TemplateConfig} from './QpgTemplatesPanel';
type Section=Config['sections'][number];
const newSection=(order:number):Section=>({id:createUuid(),name:`Section ${order}`,order,offered:1,attempted:1,marks_each:1,question_type:null,format:'STANDARD',mandatory:true,choice_groups:[],time_minutes:null});
export function universityPattern(kind:string):Config {
 const alternative=kind==='two-parts';
 const nested=kind==='six-five';
 const section=(order:number,name:string,count:number,marks:number,type:string):Section=>({...newSection(order),name,offered:count,attempted:count,marks_each:marks,question_type:type});
 const final=section(alternative?2:3,alternative?'Part B':'Part C',alternative?5:6,alternative?16:11,'DESCRIPTIVE');
 final.main_questions=Array.from({length:alternative?5:6},(_,i)=>({id:createUuid(),marks:alternative?16:11,choose:1,branches:['a','b'].map((branch)=>({id:createUuid(),marks:alternative?16:11,children:(nested&&i===5?[6,5]:alternative&&branch==='b'&&(i===1||i===2)?[8,8]:alternative&&branch==='b'&&i===3?[12,4]:[]).map(marks=>({id:createUuid(),marks}))}))}));
 return {title:alternative?'100 marks · Two Parts':nested?'100 marks · Three Parts with 6 + 5':'100 marks · Three Parts',total_marks:100,duration_minutes:180,coverage:{cos:[],units:[],topics:[],bloom:[],difficulty:[]},sections:[section(1,alternative?'Part A':'Part A (MCQ)',10,alternative?2:1,alternative?'SHORT_ANSWER':'MCQ'),...(!alternative?[section(2,'Part B',12,2,'SHORT_ANSWER')]:[]),final]};
}

const fields=['institution_short_name','program','branch','year','semester','academic_session','examination_session','course_code','course_name','duration','maximum_marks'];
export const templateDefaults:TemplateConfig={header_alignment:'CENTER',institution_alignment:'CENTER',logo_placement:'CENTER',show_logo:true,show_address:true,show_page_numbers:true,show_fields:fields.slice(1),address_text:'',contact_text:'',header_text:'',footer_text:'',section_style:'NORMAL',numbering:'CONTINUOUS'};
