import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const source=ts.transpileModule(readFileSync(new URL('../src/pages/dashboard/mentor-model.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;
const {normalizeState}=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
test('normalization preserves profile photos, real scores and independent AI progress',()=>{
 const value=normalizeState({mentors:[{id:'mentor',photo:'data:image/jpeg;base64,abc'}],students:[{id:'student',readiness:8.8,competency:0,attendance:null,aiProgress:50,aiTasksCompleted:1,milestones:[{id:'goal',done:false}]}]});
 assert.equal(value.mentors[0].photo,'data:image/jpeg;base64,abc');assert.equal(value.students[0].readiness,8.8);assert.equal(value.students[0].competency,0);assert.equal(value.students[0].progress,0);assert.equal(value.students[0].aiProgress,50);
});
