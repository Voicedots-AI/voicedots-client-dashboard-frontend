/** In-memory, session-scoped cache. Nothing is persisted across sign-outs. */
export class AssessmentCache {
 private scope='';
 private values=new Map<string,{value:unknown;time:number}>();
 private inflight=new Map<string,Promise<unknown>>();
 private now:()=>number;
 private ttl:number;
 constructor(now:()=>number=Date.now,ttl=Infinity){this.now=now;this.ttl=ttl}
 session(scope:string){if(scope!==this.scope){this.scope=scope;this.values.clear();this.inflight.clear()}}
 peek<T>(key:string):T|undefined{const entry=this.values.get(key);return entry&&this.now()-entry.time<this.ttl?entry.value as T:undefined}
 seed<T>(key:string,value:T){this.values.set(key,{value,time:this.now()})}
 invalidate(key:string){this.values.delete(key)}
 clear(){this.values.clear();this.inflight.clear()}
 async get<T>(key:string,loader:()=>Promise<T>):Promise<T>{
  const saved=this.peek<T>(key);if(saved!==undefined)return saved;
  const pending=this.inflight.get(key);if(pending)return pending as Promise<T>;
  const scope=this.scope;
  const request=loader().then(value=>{if(scope===this.scope&&this.inflight.get(key)===request)this.seed(key,value);return value}).finally(()=>{if(this.inflight.get(key)===request)this.inflight.delete(key)});
  this.inflight.set(key,request);return request;
 }
}
export class AssessmentQueue {
 private active=0;
 private jobs:Array<()=>void>=[];
 private concurrency:number;
 constructor(concurrency=6){this.concurrency=concurrency}
 run<T>(task:()=>Promise<T>):Promise<T>{return new Promise<T>((resolve,reject)=>{this.jobs.push(()=>{this.active++;void Promise.resolve().then(task).then(resolve,reject).finally(()=>{this.active--;this.drain()})});this.drain()})}
 private drain(){while(this.active<this.concurrency&&this.jobs.length)this.jobs.shift()!()}
}
