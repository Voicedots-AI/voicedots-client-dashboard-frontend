import {useEffect,useState} from 'react';
import axios from 'axios';
import {ArrowLeft,ArrowRight,CalendarDays,LockKeyhole,Receipt,RefreshCw,WalletCards} from 'lucide-react';
import {collegeApi,collegeError} from '@/api/collegeApi';
import {formatDateOnly} from './placementDisplay';
type Row={id?:string;amount?:number|string|null;currency?:string|null;paid_on?:string|null;reference?:string|null;category?:string|null;description?:string|null;label?:string|null;fee_period_id?:string|null;due_on?:string|null};
type Fees={student:{id:string};fee_summary?:{total_fee:number|string|null;amount_paid:number|string|null;outstanding_balance:number|string|null;currency?:string|null}|null;sections:{module:string;items:Row[];has_more:boolean}[]};
import {feeAmount} from './candidate-fees-data';
export default function CandidateFees({studentId}:{studentId:string}){
 const [data,setData]=useState<Fees|null>(null),[error,setError]=useState(''),[restricted,setRestricted]=useState(false),[loading,setLoading]=useState(true),[offset,setOffset]=useState(0),[revision,setRevision]=useState(0);
 useEffect(()=>{
  const controller=new AbortController();setLoading(true);setData(null);setError('');setRestricted(false);
  collegeApi.get<Fees>(`erp/students/${encodeURIComponent(studentId)}/profile?tab=fees&limit=50&offset=${offset}`,controller.signal).then(result=>{
   if(controller.signal.aborted)return;
   if(String(result.student?.id)!==studentId||!Array.isArray(result.sections))throw new Error('The fee statement does not match this candidate. Please retry.');
   setData(result);
  }).catch(error=>{if(!controller.signal.aborted){setRestricted(axios.isAxiosError(error)&&error.response?.status===403);setError(collegeError(error))}}).finally(()=>{if(!controller.signal.aborted)setLoading(false)});
  return()=>controller.abort();
 },[studentId,offset,revision]);
 const summary=data?.fee_summary,items=data?.sections.find(section=>section.module==='fee-items')?.items||[],payments=data?.sections.find(section=>section.module==='payments')?.items||[],periods=data?.sections.find(section=>section.module==='fee-periods')?.items||[];
 const date=(value?:string|null)=>value?formatDateOnly(value):'Not recorded';
 return <div className="c360-fees">
  <header className="c360-section-title"><div><span className="c360-section-icon"><WalletCards size={22}/></span><div><h2>Fees & payments</h2><p>Recorded fee accounts and payment history from ERP.</p></div></div><span className="c360-read-only"><LockKeyhole size={13}/>Read only</span></header>
  {loading?<div className="c360-state" role="status"><RefreshCw size={22}/><h3>Loading fee statement</h3><p>Fetching this student’s saved financial records.</p></div>:error?<div className="c360-state" role="alert">{restricted?<LockKeyhole size={25}/>:<Receipt size={25}/>}<h3>{restricted?'Finance access required':'Fee statement unavailable'}</h3><p>{restricted?'Your account does not have permission to view this student’s fee records.':error}</p>{!restricted&&<button type="button" onClick={()=>setRevision(v=>v+1)}><RefreshCw size={15}/>Try again</button>}</div>:data&&<>
   {summary?<div className="c360-fee-metrics">{[['Total fees',summary.total_fee],['Amount paid',summary.amount_paid],['Outstanding balance',summary.outstanding_balance]].map(([label,value],i)=><article key={String(label)} className={`c360-fee-metric c360-fee-tone-${i}`}><span>{label}</span><strong>{feeAmount(value,summary.currency)}</strong><small>{i===1?'Includes recorded opening paid amounts':'From the saved fee account'}</small></article>)}</div>:<div className="c360-state"><WalletCards size={26}/><h3>No fee account recorded</h3><p>A fee account has not been entered for this student. Missing amounts are not treated as zero.</p></div>}
   <section className="pi-card c360-fee-section"><h2><Receipt size={19}/>Fee breakdown</h2>{items.length?<div className="pi-table-wrap"><table><thead><tr><th>Fee category</th><th>Description</th><th>Amount</th><th>Due date</th></tr></thead><tbody>{items.map((item,i)=><tr key={item.id||i}><td><b>{item.category||'Not recorded'}</b></td><td>{item.description||'Not recorded'}</td><td>{feeAmount(item.amount,item.currency||summary?.currency)}</td><td>{date(item.due_on||periods.find(period=>period.id===item.fee_period_id)?.due_on)}</td></tr>)}</tbody></table></div>:<p className="c360-empty">No itemized fees recorded{offset?' on this page':''}.</p>}</section>
   <section className="pi-card c360-fee-section"><h2><CalendarDays size={19}/>Payment transactions</h2>{payments.length?<div className="pi-table-wrap"><table><thead><tr><th>Date</th><th>Amount received</th><th>Reference</th></tr></thead><tbody>{payments.map((payment,i)=><tr key={payment.id||i}><td>{date(payment.paid_on)}</td><td><b>{feeAmount(payment.amount,payment.currency||summary?.currency)}</b></td><td>{payment.reference||'Not recorded'}</td></tr>)}</tbody></table></div>:<p className="c360-empty">No payment transactions recorded{offset?' on this page':''}.</p>}</section>
   {(offset>0||data.sections.some(section=>section.has_more))&&<nav className="c360-fee-pagination" aria-label="Fee record pages"><button type="button" disabled={!offset} onClick={()=>setOffset(value=>Math.max(0,value-50))}><ArrowLeft size={15}/>Previous</button><span>Page {Math.floor(offset/50)+1} · up to 50 records per category</span><button type="button" disabled={!data.sections.some(section=>section.has_more)} onClick={()=>setOffset(value=>value+50)}>Next<ArrowRight size={15}/></button></nav>}
  </>}
 </div>;
}
