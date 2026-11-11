import './donut-hover-detail.css';
/** Normal-flow hover detail: its reserved row always sits outside the donut. */
export default function DonutHoverDetail({name,count,total,unit='responses',color}:{name?:string;count?:number;total:number;unit?:string;color?:string}){
 const visible=Boolean(name)&&count!=null&&total>0;
 return <div className="donut-hover-detail-slot" aria-live="polite"><div className="donut-hover-detail" data-visible={visible} aria-hidden={!visible}>{visible&&<><i style={{background:color}}/><strong>{name}</strong><span>{count!.toLocaleString('en-IN')} {unit} · {Math.round(count!/total*100)}%</span></>}</div></div>;
}
