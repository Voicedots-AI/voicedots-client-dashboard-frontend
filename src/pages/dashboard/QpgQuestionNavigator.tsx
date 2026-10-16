export type NavigationQuestion={id:string;number:string;ready:boolean;reason:string};
export type NavigationSection={id:string;name:string;questions:NavigationQuestion[]};
export default function QpgQuestionNavigator({sections,selected,onSelect,onIssues}:{sections:NavigationSection[];selected:string;onSelect:(id:string)=>void;onIssues:()=>void}){
 const issues=sections.flatMap(section=>section.questions).filter(q=>!q.ready);
 return <section className="qpg-question-navigator" aria-label="Question navigator"><header><h3>Jump to a question</h3>{issues.length>0&&<button type="button" onClick={onIssues}>{issues.length} need attention ↗</button>}</header>{sections.map(section=><div className="qpg-navigator-part" key={section.id}><h4>{section.name}</h4><div>{section.questions.map(q=><button type="button" key={q.id} className={q.ready?'ready':'attention'} aria-label={`Question ${q.number}: ${q.ready?'ready':q.reason}`} title={q.ready?`Q${q.number} · Ready`:`Q${q.number} · ${q.reason}`} aria-current={selected===q.id?'true':undefined} onClick={()=>onSelect(q.id)}>Q{q.number}</button>)}</div></div>)}<p>Green: ready · Amber: needs attention</p></section>;
}
