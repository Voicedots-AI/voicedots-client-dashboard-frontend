import {test,expect} from '@playwright/test';
import {AssessmentCache,AssessmentQueue} from '../src/pages/dashboard/assessmentCache';

test('loaded values survive navigation and focus without another request',async()=>{
 let now=0,calls=0;const cache=new AssessmentCache(()=>now);cache.session('user-a');
 const load=async()=>{calls++;return{education:['Actual degree'],certifications:['Actual certificate']}};
 const first=await cache.get('student:drive',load);now=24*60*60*1000;
 expect(await cache.get('student:drive',load)).toBe(first);expect(calls).toBe(1);
});
test('simultaneous requests share one in-flight response',async()=>{
 const cache=new AssessmentCache();let calls=0;let complete!:(value:number)=>void;
 const load=()=>{calls++;return new Promise<number>(resolve=>{complete=resolve})};
 const first=cache.get('record',load),second=cache.get('record',load);complete(42);
 expect(await Promise.all([first,second])).toEqual([42,42]);expect(calls).toBe(1);
});
test('signing into another account cannot reuse a previous student response',async()=>{
 const cache=new AssessmentCache();cache.session('user-a');await cache.get('student',async()=>({name:'A'}));
 cache.session('user-b');expect(cache.peek('student')).toBeUndefined();
 expect(await cache.get('student',async()=>({name:'B'}))).toEqual({name:'B'});
});
test('manual refresh discards old results, including late in-flight completions',async()=>{
 const cache=new AssessmentCache();let complete!:(value:string)=>void;
 const old=cache.get('record',()=>new Promise<string>(resolve=>{complete=resolve}));cache.clear();
 expect(await cache.get('record',async()=>'new')).toBe('new');complete('old');await old;
 expect(cache.peek('record')).toBe('new');
});
test('failed requests can be retried instead of caching an error forever',async()=>{
 const cache=new AssessmentCache();await expect(cache.get('record',async()=>{throw Error('unavailable')})).rejects.toThrow();
 expect(await cache.get('record',async()=>0)).toBe(0);
});
test('request queue bounds concurrency and drains after a rejected task',async()=>{
 const queue=new AssessmentQueue(3);let active=0,maximum=0;
 const tasks=Array.from({length:20},(_,index)=>queue.run(async()=>{active++;maximum=Math.max(maximum,active);await new Promise(resolve=>setTimeout(resolve,1));active--;if(index===4)throw Error('one failed');return index}));
 const results=await Promise.allSettled(tasks);expect(maximum).toBe(3);expect(active).toBe(0);expect(results.filter(row=>row.status==='fulfilled')).toHaveLength(19);
});
