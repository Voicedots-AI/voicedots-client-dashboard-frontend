import {test,expect} from '@playwright/test';
import {AxiosError} from 'axios';
import type {ViteDevServer} from 'vite';
let collegeApi:typeof import('../src/api/collegeApi').collegeApi;
let clearAssessmentCache:typeof import('../src/pages/dashboard/assessmentClient').clearAssessmentCache;
let loadCandidateAssessment:typeof import('../src/pages/dashboard/assessmentClient').loadCandidateAssessment;
let original:typeof collegeApi.get;
let server:ViteDevServer;
test.beforeAll(async()=>{
 const {createServer}=await import('vite');
 server=await createServer({server:{middlewareMode:true},appType:'custom'});
 ({collegeApi}=await server.ssrLoadModule('/src/api/collegeApi.ts'));
 ({clearAssessmentCache,loadCandidateAssessment}=await server.ssrLoadModule('/src/pages/dashboard/assessmentClient.ts'));
 original=collegeApi.get;
});
test.afterAll(async()=>{await server?.close()});
const bundle={student:{id:'student',full_name:'Actual Student'},drives:[],reports:[]};
const httpError=(status:number)=>new AxiosError('Request failed',undefined,undefined,undefined,{status,data:{},headers:{},config:{} as never,statusText:'Error'});
test.beforeEach(()=>{Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:()=> 'test-session'}});clearAssessmentCache()});
test.afterEach(()=>{collegeApi.get=original});
test('an unavailable shared API never silently substitutes the admin ranking model',async()=>{
 const paths:string[]=[];
 collegeApi.get=async<T,>(path:string):Promise<T>=>{paths.push(path);if(path.includes('/reports?'))return bundle as T;throw httpError(404)};
 await expect(loadCandidateAssessment('student','drive')).rejects.toThrow('shared assessment API');
 expect(paths.some(path=>path.startsWith('drives/'))).toBe(false);
});
test('shared student payload takes precedence as soon as the server supports it',async()=>{
 const assessment={drive_id:'drive',ats_status:'evaluated',ats_fit_score:62,resume_sections:{education:['Actual degree'],certifications:['Actual certificate']}};
 collegeApi.get=async<T,>(path:string):Promise<T>=>{if(path.includes('/reports?'))return bundle as T;expect(path).toBe('students/student/drives/drive/ats-fit');return {student_id:'student',student:bundle.student,assessment} as T};
 expect(await loadCandidateAssessment('student','drive')).toEqual({...bundle.student,...assessment,student_id:'student'});
});
test('authorization errors do not trigger the compatibility reader',async()=>{
 const paths:string[]=[];
 collegeApi.get=async<T,>(path:string):Promise<T>=>{paths.push(path);if(path.includes('/reports?'))return bundle as T;throw httpError(403)};
 await expect(loadCandidateAssessment('student','drive')).rejects.toMatchObject({response:{status:403}});
 expect(paths.some(path=>path.startsWith('drives/'))).toBe(false);
});
