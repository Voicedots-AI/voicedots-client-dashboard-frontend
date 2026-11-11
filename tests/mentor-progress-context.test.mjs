import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const source=ts.transpileModule(readFileSync(new URL('../src/pages/dashboard/mentor-progress-context.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {contextKey,contextReports,PRACTICE_CONTEXT,selectedReport,releasedScore}=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const rows=[
 {session_id:'old-a',drive_id:'a',attempt_number:1,completed_at:'2026-11-01',status:'released',report:{overall_score:60}},
 {session_id:'b',drive_id:'b',completed_at:'2026-11-10',status:'released',report:{overall_score:90}},
 {session_id:'latest-a',drive_id:'a',attempt_number:2,completed_at:'2026-11-09',status:'released',report:{overall_score:75}},
 {session_id:'pending-a',drive_id:'a',completed_at:'2026-11-11',status:'pending_release',report:{overall_score:99}},
 {session_id:'practice',drive_id:null,completed_at:'2026-11-10',status:'released',report:{overall_score:80}},
];
test('drive context excludes other drives and keeps source order intact',()=>{
 assert.deepEqual(contextReports(rows,'a').map(r=>r.session_id),['pending-a','latest-a','old-a']);
 assert.equal(rows[0].session_id,'old-a');
});
test('defaults to latest released attempt rather than newer pending score',()=>{
 assert.equal(selectedReport(contextReports(rows,'a'),'').session_id,'latest-a');
});
test('explicit attempt selection shows its exact score',()=>{
 assert.equal(releasedScore(selectedReport(contextReports(rows,'a'),'old-a')),60);
});
test('switching drive cannot keep a previous drive attempt',()=>{
 assert.equal(selectedReport(contextReports(rows,'b'),'old-a').session_id,'b');
});
test('self-practice remains accessible alongside placement drives',()=>{
 assert.equal(contextKey(null),PRACTICE_CONTEXT);
 assert.deepEqual(contextReports(rows,PRACTICE_CONTEXT).map(r=>r.session_id),['practice']);
});
test('unreleased, missing and invalid scores remain unassessed, zero is valid',()=>{
 assert.equal(releasedScore(selectedReport(contextReports(rows,'a'),'pending-a')),null);
 assert.equal(releasedScore(undefined),null);
 for(const score of [NaN,Infinity,-1,101])assert.equal(releasedScore({status:'released',report:{overall_score:score}}),null);
 assert.equal(releasedScore({status:'released',report:{overall_score:0}}),0);
 assert.equal(selectedReport([],''),undefined);
});
