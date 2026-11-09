import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import ts from 'typescript';
const require=createRequire(import.meta.url),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const options={module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX};
const helper={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL('../src/shared-assessment/atsCutoff.ts',import.meta.url),'utf8'),{compilerOptions:options}).outputText,{exports:helper});
const component={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL('../src/shared-assessment/ATSFit.tsx',import.meta.url),'utf8'),{compilerOptions:options}).outputText,{exports:component,require:name=>name==='./atsCutoff'?helper:name.endsWith('.css')?{}:require(name)});
const render=(score,cutoff,status='evaluated')=>renderToStaticMarkup(React.createElement(component.SharedATSFit,{data:{ats_status:status,ats_fit_score:score,criteria_ats_fit:cutoff,skills:[]},student:{}}));
test('59.1 against a 60% cutoff is red in both the indicator and actual details panel',()=>{
 assert.equal(helper.atsIndicator(59.1,60),'red');
 const html=render(59.1,60);assert.match(html,/data-ats-eligibility="ineligible"/);assert.match(html,/At\/below cutoff/);assert.match(html,/60%/);assert.ok(html.includes('#e34b58'));assert.ok(!html.includes('50%'));
});
test('above-cutoff scores and boundary scores match across details and badges',()=>{
 assert.match(render(61,60),/data-ats-eligibility="eligible"/);
 assert.match(render(60,60),/data-ats-eligibility="ineligible"/);
 assert.equal(helper.atsIndicator(60,60),'red');
 assert.equal(helper.atsIndicator(1,0),'green');
});
test('pending scores never produce a green eligible assessment',()=>{
 const html=render(99,60,'processing');assert.match(html,/data-ats-eligibility="pending"/);assert.match(html,/Not assessed/);
});
test('shared component and cutoff helper match the reviewed manifest',async()=>{
 const {createHash}=await import('node:crypto');
 const manifest=JSON.parse(fs.readFileSync(new URL('../src/shared-assessment/manifest.json',import.meta.url),'utf8'));
 for(const name of ['atsCutoff.ts','ATSFit.tsx'])assert.equal(createHash('sha256').update(fs.readFileSync(new URL(`../src/shared-assessment/${name}`,import.meta.url))).digest('hex'),manifest[name]);
});
