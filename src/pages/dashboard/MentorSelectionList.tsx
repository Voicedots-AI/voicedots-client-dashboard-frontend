import {useState} from 'react';
import {Search,Users} from 'lucide-react';
import MentorProfilePhoto from './MentorProfilePhoto';
export type MentorSelectionItem={id:string;name:string;subtitle:string;kind:'staff'|'students';photoId:string};
export default function MentorSelectionList({title,value,items,onChange,allLabel}:{title:'Mentors'|'Mentees';value:string;items:MentorSelectionItem[];onChange:(id:string)=>void;allLabel?:string}){
 const [query,setQuery]=useState('');
 const visible=items.filter(item=>`${item.name} ${item.subtitle}`.toLowerCase().includes(query.trim().toLowerCase()));
 return <section className="mm-photo-selector"><header><h2>{title}</h2><span>{items.length}</span></header><label className="mm-photo-search"><Search size={14}/><input type="search" aria-label={`Search ${title.toLowerCase()}`} placeholder={`Search ${title.toLowerCase()}`} value={query} onChange={event=>setQuery(event.target.value)}/></label><div role="group" aria-label={`${title} selection`} className="mm-photo-options">
 {allLabel&&<button type="button" aria-label={allLabel} aria-pressed={value==='all'} onClick={()=>onChange('all')}><span className="mm-all-people"><Users size={19}/></span><span><strong>{allLabel}</strong><small>Institute overview</small></span></button>}
 {visible.map(item=><button type="button" key={item.id} aria-label={`Select ${title==='Mentors'?'mentor':'mentee'} ${item.name}`} aria-pressed={value===item.id} onClick={()=>onChange(item.id)}><MentorProfilePhoto kind={item.kind} id={item.photoId} name={item.name}/><span><strong>{item.name}</strong><small>{item.subtitle}</small></span></button>)}
 {!visible.length&&<p>No {title.toLowerCase()} match this search.</p>}
 </div></section>;
}
