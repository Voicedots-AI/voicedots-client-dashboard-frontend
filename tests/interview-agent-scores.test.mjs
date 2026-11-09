import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const source=fs.readFileSync(new URL('../src/pages/dashboard/interviewAgentScores.ts',import.meta.url),'utf8');
const exports={};vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports});
const rows=(...args)=>JSON.parse(JSON.stringify(exports.interviewAgentScores(...args)));
test('renders exactly the three configured agents in drive order',()=>{
 const result=rows([{agent_type:'manager',sub_score:80},{agent_type:'hr',sub_score:72},{agent_type:'domain',sub_score:89},{agent_type:'industry',sub_score:95}],['hr','domain','manager'].map(track=>({track})));
 assert.deepEqual(result.map(r=>[r.track,r.score]),[['hr',72],['domain',89],['manager',80]]);
});
test('includes all four configured agents without inventing missing scores',()=>{
 const result=rows([{agent_type:'HR',sub_score:0},{track:'domain',sub_score:75},{agent_type:'industry',sub_score:NaN}],['hr','domain','industry','manager'].map(track=>({track,profile:{role:track+' role'}})));
 assert.equal(result.length,4);assert.deepEqual(result.map(r=>r.score),[0,75,null,null]);assert.equal(result[3].label,'manager role');
});
test('legacy reports use their recorded agents and never a fixed four-agent fallback',()=>{
 assert.equal(rows(undefined).length,0);assert.deepEqual(rows([{agent_type:'hr',sub_score:81},{agent_type:'hr',sub_score:81}]).map(r=>r.track),['hr']);
});
