import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const source=fs.readFileSync(new URL('../src/pages/dashboard/assessmentProgramOptions.ts',import.meta.url),'utf8');
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const exports={};vm.runInNewContext(code,{exports});
const options=(...args)=>JSON.parse(JSON.stringify(exports.assessmentProgramOptions(...args)));
test('Shows approved names and retains identifiers used by filtering',()=>{
 assert.deepEqual(options([
  {code:'0011',display_name:'Bachelor of Medicine and Bachelor of Surgery'},
  {code:'Master of Computer Appilcations',display_name:'MCA'},
  {code:'BCA',display_name:'Bachelor of Computer Applications'},
 ],[]),[
  {value:'0011',label:'Bachelor of Medicine and Bachelor of Surgery'},
  {value:'Master of Computer Appilcations',label:'MCA'},
  {value:'BCA',label:'Bachelor of Computer Applications'},
 ]);
});
test('Missing catalog name is explicitly identified',()=>{
 assert.deepEqual(options([{code:'0011',display_name:'  '}],[]),[{value:'0011',label:'Program name not recorded (0011)'}]);
});
test('Roster fallback remains unique and excludes missing programs',()=>{
 assert.deepEqual(options([],['BCA',null,'BCA','B.Tech',undefined]),[{value:'BCA',label:'BCA'},{value:'B.Tech',label:'B.Tech'}]);
});
