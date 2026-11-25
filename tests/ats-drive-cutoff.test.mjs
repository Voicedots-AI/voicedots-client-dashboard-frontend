import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const source=fs.readFileSync(new URL('../src/pages/dashboard/assessmentIntelligenceData.ts',import.meta.url),'utf8');
const shared={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL('../src/shared-assessment/atsCutoff.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:shared});
const exports={};vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:()=>shared});
const row=score=>({student_id:'student',ats_status:'evaluated',ats_fit_score:score});
test('60% drive cutoff stays red for 57, 59 and 60; green only above 60',()=>{
 for(const score of [57,59,60])assert.equal(exports.atsAboveDriveCutoff(row(score),60),false);
 assert.equal(exports.atsAboveDriveCutoff(row(60.1),60),true);
});
test('uses each drive cutoff, including zero, rather than a fixed 50',()=>{
 assert.equal(exports.atsAboveDriveCutoff(row(59),55),true);
 assert.equal(exports.atsAboveDriveCutoff(row(59),60),false);
 assert.equal(exports.atsAboveDriveCutoff(row(1),0),true);
 assert.equal(exports.atsAboveDriveCutoff({...row(59),criteria_ats_fit:65},50),false);
});
test('pending or invalid results remain neutral and the summary uses the same rule',()=>{
 assert.equal(exports.atsAboveDriveCutoff({...row(99),ats_status:'processing'},60),null);
 assert.equal(exports.atsAboveDriveCutoff(row(null),60),null);
 assert.equal(exports.atsAboveDriveCutoff(row(75),101),null);
 const bundle={student:{id:'student'},drives:[{drive_id:'one',criteria_ats_fit:60},{drive_id:'two',criteria_ats_fit:55}],reports:[]};
 const ats=Object.fromEntries(['one','two'].map(id=>[exports.atsKey('student',id),{row:row(59)}]));
 assert.equal(exports.assessmentSummary(bundle,ats).eligible,1);
});
