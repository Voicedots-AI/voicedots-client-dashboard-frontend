import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const source=ts.transpileModule(readFileSync(new URL('../src/pages/dashboard/mentee-filters.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {emptyMenteeFilters,filterMentees,menteeFilterOptions,toggleMenteePage}=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const students=[
 {id:'a',name:'Rishi Tester',rollNumber:'TEST203698',email:'rishi@example.test',batch:'2022–2026',degree:'B.Tech',department:'IT',semester:6,mentorId:'',student_status:'active'},
 {id:'b',name:'Another Student',rollNumber:'REG002',email:'second@example.test',batch:'2023–2027',degree:'B.Tech',department:'CSE',semester:4,mentorId:'existing',student_status:'active'},
 {id:'c',name:'Third Student',rollNumber:'REG003',email:'third@example.test',batch:'2022–2026',degree:'BBA',department:'Business',semester:null,mentorId:'',student_status:'inactive'},
 {id:'d',name:'Fourth Student',rollNumber:'REG004',email:'fourth@example.test',batch:'2022–2026',degree:'B.Tech',department:'IT',semester:8,mentorId:'',student_status:'active'},
];
test('combines batch, degree, department and semester using real roster values',()=>{
 assert.deepEqual(filterMentees(students,{query:'',batch:'2022–2026',degree:'B.Tech',department:'IT',semester:'6'}).map(s=>s.id),['a']);
 assert.equal(filterMentees(students,{...emptyMenteeFilters(),degree:'BBA',department:'IT'}).length,0);
});
test('search matches registration number, name and email regardless of case',()=>{
 for(const query of [' test203698 ','RISHI','rishi@example.test'])assert.deepEqual(filterMentees(students,{...emptyMenteeFilters(),query}).map(s=>s.id),['a']);
 assert.equal(filterMentees(students,emptyMenteeFilters()).length,4);
});
test('dropdowns omit missing values, deduplicate, and sort semesters numerically',()=>{
 assert.deepEqual(menteeFilterOptions([...students,{semester:10},{semester:2},{semester:6}], 'semester'),['2','4','6','8','10']);
 assert.deepEqual(menteeFilterOptions(students,'degree'),['B.Tech','BBA']);
});
test('bulk selection affects only available students on the provided page',()=>{
 const selected=['hidden-student'];const next=toggleMenteePage(selected,students);
 assert.deepEqual(next,['hidden-student','a','d']);assert.deepEqual(selected,['hidden-student']);
 assert.deepEqual(toggleMenteePage(next,students),['hidden-student']);
 assert.deepEqual(toggleMenteePage(['a'],students.slice(0,2)),[]);
});
