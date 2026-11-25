import { useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { displayName } from './placementDisplay';

type DriveSummary = {id:string;name:string;interviews:number;feedback:number;average_rating:number|null};
const DRIVE_PAGE_SIZE = 5;
const HIGHLIGHT_PAGE_SIZE = 2;

function Pager({ page, pageSize, total, label, onPage }: {page:number;pageSize:number;total:number;label:string;onPage:(page:number)=>void}) {
 if (total <= pageSize) return null;
 return <nav className="feedback-pagination feedback-compact-pagination" aria-label={label}>
  <span>{page*pageSize+1}–{Math.min((page+1)*pageSize,total)} of {total}</span>
  <button disabled={page===0} onClick={()=>onPage(page-1)}>Previous</button>
  <button disabled={(page+1)*pageSize>=total} onClick={()=>onPage(page+1)}>Next</button>
 </nav>;
}

export function FeedbackDriveSummary({ rows, title, onSelect }: {rows:DriveSummary[];title:string;onSelect?:(id:string)=>void}) {
 const [requestedPage,setPage]=useState(0);
 const page=Math.min(requestedPage,Math.max(0,Math.ceil(rows.length/DRIVE_PAGE_SIZE)-1));
 return <section className="feedback-card feedback-drive-summary">
  <h2>{title}</h2><p className="feedback-section-caption">Interview volume, submitted feedback, and average rating</p>
  <div className="feedback-table-scroll"><table><thead><tr><th>Drive</th><th>Interviews</th><th>Feedback</th><th>Average</th></tr></thead><tbody>
   {rows.slice(page*DRIVE_PAGE_SIZE,(page+1)*DRIVE_PAGE_SIZE).map(row=><tr key={row.id}><td>{onSelect?<button className="feedback-text-button" onClick={()=>onSelect(row.id)}>{displayName(row.name)}</button>:displayName(row.name)}</td><td>{row.interviews}</td><td>{row.feedback}</td><td><span className="feedback-rating-pill">{row.average_rating==null?'Not collected':`${row.average_rating}/5`}</span></td></tr>)}
   {!rows.length&&<tr><td colSpan={4}>No drive feedback matches these filters.</td></tr>}
  </tbody></table></div>
  <Pager page={page} pageSize={DRIVE_PAGE_SIZE} total={rows.length} label="Feedback by drive pages" onPage={setPage}/>
 </section>;
}

export function FeedbackHighlights<T extends {session_id:string;comments:string;department:string;drive_name:string}>({ rows, title, onView }: {rows:T[];title:string;onView:(row:T)=>void}) {
 const [requestedPage,setPage]=useState(0);
 const page=Math.min(requestedPage,Math.max(0,Math.ceil(rows.length/HIGHLIGHT_PAGE_SIZE)-1));
 return <section className="feedback-card feedback-paged-highlights"><h2>{title}</h2>
  {rows.slice(page*HIGHLIGHT_PAGE_SIZE,(page+1)*HIGHLIGHT_PAGE_SIZE).map(row=><blockquote key={row.session_id} className="feedback-highlight-preview"><span className="feedback-highlight-icon"><MessageCircle size={17}/></span><div><p>{row.comments}</p><small>{row.department||'Department not recorded'} · {row.drive_name}</small><button className="feedback-text-button" onClick={()=>onView(row)}>View full feedback →</button></div></blockquote>)}
  {!rows.length&&<p>No additional comments have been submitted.</p>}
  <Pager page={page} pageSize={HIGHLIGHT_PAGE_SIZE} total={rows.length} label="Feedback highlights pages" onPage={setPage}/>
 </section>;
}
