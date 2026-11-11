import type {ReactNode} from 'react';
import {Inbox,ChevronDown,type LucideIcon} from 'lucide-react';
export function Panel({title,subtitle,icon:Icon,children,action,className=''}:{title:string;subtitle?:string;icon?:LucideIcon;children:ReactNode;action?:ReactNode;className?:string}){
 return <section className={`mp-card ${className}`}><header className="mp-card-head"><div className="mp-heading">{Icon&&<span className="mp-icon"><Icon size={19}/></span>}<div><h2>{title}</h2>{subtitle&&<p>{subtitle}</p>}</div></div>{action}</header>{children}</section>;
}
export function Empty({title,children}:{title:string;children?:ReactNode}){return <div className="mp-empty"><span><Inbox size={24}/></span><h3>{title}</h3>{children&&<p>{children}</p>}</div>}
export function Badge({children,tone='neutral'}:{children:ReactNode;tone?:'neutral'|'green'|'amber'|'blue'|'purple'}){return <span className={`mp-badge mp-badge-${tone}`}>{children}</span>}
export function Detail({title,children,open=false}:{title:string;children:ReactNode;open?:boolean}){return <details className="mp-details" open={open||undefined}><summary>{title}<ChevronDown size={16}/></summary><div>{children}</div></details>}
export function Metric({label,value,icon:Icon,note,tone='blue'}:{label:string;value:ReactNode;icon:LucideIcon;note?:string;tone?:string}){return <article className={`mp-metric mp-tone-${tone}`}><span className="mp-metric-icon"><Icon size={21}/></span><div><span>{label}</span><strong>{value}</strong>{note&&<small>{note}</small>}</div></article>}
export const readable=(s:string)=>s.replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());
export const displayDate=(value?:string)=>{if(!value)return 'Not recorded';const date=new Date(value);return Number.isNaN(date.getTime())?'Not recorded':date.toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})};
