import {test,expect} from '@playwright/test';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import type {ViteDevServer} from 'vite';
let server:ViteDevServer;
let Card:typeof import('../src/pages/dashboard/DriveManagement').ResultCandidateRosterCard;
test.beforeAll(async()=>{const {createServer}=await import('vite');server=await createServer({server:{middlewareMode:true},appType:'custom'});Card=(await server.ssrLoadModule('/src/pages/dashboard/DriveManagement.tsx')).ResultCandidateRosterCard});
test.afterAll(async()=>{await server?.close()});
const base={driveId:'drive',drive:{id:'drive',company_name:'Recorded Company',role_title:'Recorded Role',status:'active',window_start_at:'2026-10-30T10:00:00Z',window_end_at:'2026-10-31T10:00:00Z'},collegeTimezone:'Asia/Kolkata',checked:false,onSelect:()=>{},onReport:()=>{},onATS:()=>{},onSaved:()=>{},busy:false};
test('compact roster preserves actual identity, academics, score and review actions',()=>{
 const html=renderToStaticMarkup(createElement(Card,{...base,candidate:{student_id:'student',full_name:'Actual Student',roll_number:'R1',email:'actual@example.test',program:'B.Tech',department_code:'CSE',cgpa:8.4,graduation_year:2027,overall_score:72,assignment_status:'completed',report_ready:true}}));
 for(const value of ['Actual Student','actual@example.test','B.Tech','CSE','8.4','2027','72%','72/100','Recorded Company','Recorded Role','AI Coach','View full assessment','Review details'])expect(html).toContain(value);
 expect(html).toContain('aria-label="Select Actual Student"');expect(html).toContain('aria-expanded="false"');
});
test('a real zero is retained, while absent scores remain not assessed',()=>{
 const zero=renderToStaticMarkup(createElement(Card,{...base,candidate:{student_id:'student',full_name:'Student',roll_number:'R1',overall_score:0,report_ready:true}}));expect(zero).toContain('0/100');expect(zero).toContain('0%');
 const absent=renderToStaticMarkup(createElement(Card,{...base,candidate:{student_id:'student',full_name:'Student',roll_number:'R1',report_ready:false}}));expect(absent).toContain('Not assessed');expect(absent).not.toContain('0/100');expect(absent).toMatch(/disabled=""[^>]*>View full assessment/);
});
