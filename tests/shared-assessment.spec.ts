import {test,expect} from '@playwright/test';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import type {ViteDevServer} from 'vite';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
let server:ViteDevServer;
let ATS:typeof import('../src/shared-assessment/ATSFit').SharedATSFit;
let Scorecard:typeof import('../src/shared-assessment/Scorecard').SharedScorecard;
test.beforeAll(async()=>{const {createServer}=await import('vite');server=await createServer({server:{middlewareMode:true},appType:'custom'});ATS=(await server.ssrLoadModule('/src/shared-assessment/ATSFit.tsx')).SharedATSFit;Scorecard=(await server.ssrLoadModule('/src/shared-assessment/Scorecard.tsx')).SharedScorecard});
test.afterAll(async()=>{await server?.close()});
test('ATS uses the evaluated 50 percent rule and preserves actual zero coverage',()=>{
 const html=renderToStaticMarkup(createElement(ATS,{student:{full_name:'Actual Student',cgpa:0},data:{ats_status:'evaluated',ats_fit_score:81.6,verified_requirements_count:0,total_requirements_count:24,skills:[]}}));
 expect(html).toContain('Eligible · ATS ≥ 50%');expect(html).toContain('0 of 24');expect(html).toContain('Actual Student');expect(html).not.toContain('Project/work evidence required');
});
test('pending ATS never displays a stale numeric score as evaluated',()=>{
 const html=renderToStaticMarkup(createElement(ATS,{student:{},data:{ats_status:'processing',ats_fit_score:99,skills:[]}}));expect(html).toContain('data-ats-eligibility="pending"');expect(html).not.toContain('99');
});
test('same scorecard preserves zero and is read-only without a student feedback callback',()=>{
 const view={overall_score:0,score_breakdown:{communication:0},executive_summary:'Recorded summary'};
 const html=renderToStaticMarkup(createElement(Scorecard,{view}));expect(html).toContain('Recorded summary');expect(html).toContain('0/100');expect(html).not.toContain('<form');
 const studentHTML=renderToStaticMarkup(createElement(Scorecard,{view,onSaveFeedback:async()=>({score:100,label:'Recorded',ratings:{},submitted_at:'2026-10-30',method:'survey'})}));expect(studentHTML).toContain('<form');
});
test('shared renderer and stylesheet files match the common release manifest',()=>{
 const root=new URL('../src/shared-assessment/',import.meta.url);const manifest=JSON.parse(readFileSync(new URL('manifest.json',root),'utf8'));
 for(const [name,hash] of Object.entries(manifest))expect(createHash('sha256').update(readFileSync(new URL(name,root))).digest('hex')).toBe(hash);
});
