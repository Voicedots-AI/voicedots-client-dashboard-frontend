import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const source=ts.transpileModule(readFileSync(new URL('../src/pages/dashboard/mentor-career-data.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {selectedCareerReport,visibleCareerReports,interviewDistribution}=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const row=(id,resume_id,analysis_status='ai',model_version='career-finder-v4')=>({id,resume_id,report:{analysis_status},model_version});
test('current resume defaults to its saved report, excluding a newer different-resume report',()=>{
 const data={currentResumeId:'current',reports:[row('other','old'),row('current-report','current')]};
 assert.equal(selectedCareerReport(data,'').id,'current-report');
});
test('historical reports require explicit selection',()=>{
 const data={currentResumeId:'current',reports:[row('old-report','old')]};
 assert.equal(selectedCareerReport(data,''),undefined);
 assert.equal(selectedCareerReport(data,'old-report').id,'old-report');
});
test('no selected resume does not turn an older report into current advice',()=>{
 assert.equal(selectedCareerReport({currentResumeId:null,reports:[row('old','old')]},''),undefined);
});
test('history matches student visibility rules for fallback and incomplete legacy reports',()=>{
 const hidden=row('incomplete','current',null,'career-finder-v3');
 assert.deepEqual(visibleCareerReports([row('fallback','current','evidence_fallback'),hidden,row('complete','current')]).map(r=>r.id),['complete']);
});
test('invalid or superseded selection returns the current owned report',()=>{
 assert.equal(selectedCareerReport({currentResumeId:'current',reports:[row('current','current')]},'foreign-id').id,'current');
});
test('average excludes missing evidence while zero remains a real score',()=>{
 assert.deepEqual(interviewDistribution([{readiness:80},{readiness:60},{readiness:0},{readiness:null}]),{average:47,assessed:3,total:4,counts:[1,1,1,1]});
});
test('bands use exact boundaries and invalid scores are unassessed',()=>{
 const result=interviewDistribution([80,79.9,60,59.9,NaN,101,-1,null].map(readiness=>({readiness})));
 assert.deepEqual(result.counts,[1,2,1,4]);
 assert.equal(result.assessed,4);
 assert.equal(interviewDistribution([]).average,null);
});
