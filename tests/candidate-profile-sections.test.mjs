import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {buildSync} from 'esbuild';
const result=buildSync({stdin:{contents:`import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {CandidateProfileOverview} from './src/pages/dashboard/CandidateProfileOverview';export const render=(props)=>renderToStaticMarkup(React.createElement(CandidateProfileOverview,props));`,resolveDir:fileURLToPath(new URL('../',import.meta.url)),loader:'tsx'},bundle:true,platform:'node',format:'cjs',write:false,jsx:'automatic'});
const module={exports:{}};new Function('require','module','exports',result.outputFiles[0].text)(createRequire(import.meta.url),module,module.exports);
const {render}=module.exports;
const props={student:{id:'student',full_name:'Test Candidate',roll_number:'ST001',program:'BTECH',department_code:'CSE',cgpa:0,overall_attendance:{percentage:0,period:'Current semester'},status:'active'},context:{semester:0,section:'A',mentor:{name:'Test Mentor',active:true}},drives:[],reports:[],photo:'',onPhotoError:()=>{}};
test('identity header is separate from profile content',()=>{
 const html=render({...props,section:'identity'});
 assert.match(html,/Test Candidate/);assert.doesNotMatch(html,/Student details|Placement summary/);
});
test('academic section retains real zero attendance and grades',()=>{
 const html=render({...props,section:'academics'});
 assert.match(html,/0\.00 \/ 10/);assert.match(html,/>0%<\/span>/);assert.match(html,/Current semester/);assert.doesNotMatch(html,/Placement summary/);
});
test('overview keeps mentor context and honest missing placement status',()=>{
 const html=render({...props,section:'overview'});
 assert.match(html,/Test Mentor/);assert.match(html,/Mentorship &amp; contact/);assert.match(html,/Not recorded/);assert.doesNotMatch(html,/Candidate profile avatar/);
});
