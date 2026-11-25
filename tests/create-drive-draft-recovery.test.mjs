import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = fs.readFileSync(new URL('../src/pages/dashboard/CreateDriveWizard.tsx', import.meta.url), 'utf8');
const tree = ts.createSourceFile('wizard.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let effect;
function visit(node) {
  if (ts.isCallExpression(node) && node.expression.getText(tree) === 'useEffect' &&
      node.arguments[0]?.getText(tree).includes('let saved:')) effect = node.arguments[0].getText(tree);
  ts.forEachChild(node, visit);
}
visit(tree);
assert.ok(effect, 'Test the actual draft-loading effect');
const compiled = ts.transpileModule(`(${effect})()`, {compilerOptions: {target: ts.ScriptTarget.ES2022}}).outputText;
const payload = (company, step=4) => ({form:{company_name:company},step,creationKey:company});
async function run(draftId, saved, rows=[], fail=false) {
  const state = {hydrated:[], requests:0, errors:[], loaded:false};
  const context = {
    drive:null, draftId, collegeTimezone:'Asia/Kolkata', DRAFT_KEY:'draft', AbortController,
    crypto:{randomUUID:()=> 'fresh-key'},
    localStorage:{getItem:()=> JSON.stringify(saved),removeItem:()=>assert.fail('Saved draft must be retained')},
    collegeApi:{get:async()=>{state.requests++;if(fail)throw Error('offline');return rows;}},
    axios:{isAxiosError:()=>false},collegeError:()=> 'offline',
    hydrate:(p,s)=>state.hydrated.push([JSON.parse(JSON.stringify(p)),s]),setCreationKey:k=>state.key=k,
    draftIdRef:{current:null},setNotice:()=>{},setFormError:e=>state.errors.push(e),setDraftLoaded:v=>state.loaded=v,
  };
  vm.runInNewContext(compiled, context);
  await new Promise(resolve=>setImmediate(resolve));
  return state;
}

test('Create drive stays fresh despite a saved draft at Eligibility', async()=>{
  const s=await run(null,{id:'old',payload:payload('Old')});
  assert.equal(s.loaded,true);assert.equal(s.requests,0);assert.equal(s.hydrated.length,0);
});
test('Continue restores the explicitly selected server draft and step', async()=>{
  const p=payload('Selected');const s=await run('selected',null,[{id:'selected',client_draft_key:'Selected',payload:p,step:4}]);
  assert.equal(s.loaded,true);assert.deepEqual(s.hydrated,[[p,4]]);
});
test('Continue local-device restores an offline-only draft', async()=>{
  const p=payload('Offline');const s=await run('local-device',{id:null,payload:p});
  assert.deepEqual(s.hydrated,[[p,4]]);assert.equal(s.requests,0);
});
test('Selected draft cannot be replaced by a newer unrelated browser draft', async()=>{
  const p=payload('Selected');const s=await run('selected',{id:'other',payload:payload('Other'),saved_at:'2099-01-01'},[{id:'selected',client_draft_key:'Selected',payload:p,step:2,updated_at:'2026-11-04'}]);
  assert.deepEqual(s.hydrated,[[p,2]]);
});
test('Network failure does not restore an unrelated cached draft', async()=>{
  const s=await run('selected',{id:'other',payload:payload('Other')},[],true);
  assert.equal(s.hydrated.length,0);assert.equal(s.errors.length,1);
});
test('Matching local copy remains recoverable when server is offline', async()=>{
  const p=payload('Selected');const s=await run('selected',{id:'selected',payload:p},[],true);
  assert.deepEqual(s.hydrated,[[p,4]]);
});
