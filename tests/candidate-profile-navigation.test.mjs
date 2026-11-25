import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
async function moduleAt(path){const source=ts.transpileModule(readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)}
const {candidateProfileTab,openCandidate,closeCandidate,candidateReportIndex}=await moduleAt('../src/pages/dashboard/candidate-profile-navigation.ts');
const {feeAmount}=await moduleAt('../src/pages/dashboard/candidate-fees-data.ts');
test('profile sections survive URL serialization and invalid sections fall back safely',()=>{
 for(const tab of ['overview','academics','placement','assessments','fees'])assert.equal(candidateProfileTab(new URLSearchParams('candidateTab='+tab).get('candidateTab')),tab);
 assert.equal(candidateProfileTab('unknown'),'overview');assert.equal(candidateProfileTab(null),'overview');
});
test('opening another candidate clears their previous attempt without mutating drive context',()=>{
 const before=new URLSearchParams('view=placements&drive=drive-a&section=candidates&candidate=old&candidateTab=fees&candidateAttempt=old-attempt');
 const next=openCandidate(before,'student-b');
 assert.equal(next.get('candidate'),'student-b');assert.equal(next.get('candidateTab'),'overview');assert.equal(next.get('candidateAttempt'),null);
 assert.equal(next.get('drive'),'drive-a');assert.equal(next.get('section'),'candidates');assert.equal(before.get('candidate'),'old');
});
test('returning to directory preserves the surrounding placement navigation',()=>{
 const next=closeCandidate(new URLSearchParams('view=candidates&candidate=a&candidateTab=assessments&candidateAttempt=attempt'));
 assert.equal(next.toString(),'view=candidates');
});
test('attempt links select only an attempt in the authorized candidate response',()=>{
 const reports=[{session_id:'a1',drive_id:'a'},{session_id:'b1',drive_id:'b'}];
 assert.equal(candidateReportIndex(reports,'b1','a'),1);
 assert.equal(candidateReportIndex(reports,'foreign','b'),1);
 assert.equal(candidateReportIndex(reports,null,'unassessed-drive'),-1);
 assert.equal(candidateReportIndex([],null),-1);
});
test('fee values keep real zero and credit balances, with no invented missing amounts',()=>{
 assert.equal(feeAmount(0,'INR'),new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:2}).format(0));
 assert.match(feeAmount('-250.50','INR'),/250\.5/);
 for(const value of [null,undefined,'', ' ',NaN,Infinity,'not an amount',true,{}])assert.equal(feeAmount(value,'INR'),'Not recorded');
 assert.equal(feeAmount('1200.50',null),'1,200.5');
});
