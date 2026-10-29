import {useEffect,useState} from "react";
import {
  AlertTriangle,Award,BarChart3,BriefcaseBusiness,ChevronDown,Code2,
  Download,FileText,FolderKanban,GraduationCap,Info,Sparkles,Star,
} from "lucide-react";
import {collegeApi} from "@/api/collegeApi";
import {btn} from "./interviewAgentTypes";
import "./atsFitAssessment.css";

type Data=Record<string,unknown>;
type Candidate=Data&{
  student_id:string;full_name:string;email?:string;department_code?:string;
  program?:string;cgpa?:number;graduation_year?:number;assignment_status?:string;
  ats_fit_score?:number|null;ats_status?:string;compatibility_summary?:string;
  mandatory_coverage?:string;core_coverage?:string;preferred_coverage?:string;
  resume_parse_ready?:boolean;verified_requirements_count?:number;
  total_requirements_count?:number;job_description_ready_reason?:string|null;
};

const sectionRows=[
  ["Education",GraduationCap,"education"],
  ["Technical Skills",Code2,"technical_skills"],
  ["Experience & internships",BriefcaseBusiness,"internship"],
  ["Projects",FolderKanban,"projects"],
  ["Certifications",Award,"certifications"],
] as const;

const matchMeta=(value:unknown)=>{
  const key=String(value||"").toUpperCase();
  if(key==="FULL_MATCH")return{label:"Strong",bar:"bg-emerald-500",text:"text-emerald-700",width:"88%"};
  if(key==="RELATED_EVIDENCE")return{label:"Good",bar:"bg-teal-500",text:"text-teal-700",width:"68%"};
  if(key==="WEAK_OR_INFERRED")return{label:"Partial",bar:"bg-amber-400",text:"text-amber-700",width:"42%"};
  if(key==="NO_EVIDENCE")return{label:"Missing",bar:"bg-rose-500",text:"text-rose-600",width:"18%"};
  return{label:"Not assessed",bar:"bg-slate-300",text:"text-slate-500",width:"0%"};
};

const importanceClass=(value:unknown)=>{
  const key=String(value||"").toLowerCase();
  if(key.includes("mandatory"))return"bg-rose-100 text-rose-700";
  if(key.includes("preferred"))return"bg-sky-100 text-sky-700";
  if(key.includes("core"))return"bg-orange-100 text-orange-700";
  return"bg-slate-100 text-slate-600";
};

const coverage=(candidate:Candidate)=>{
  if(candidate.ats_status!=="evaluated")return{verified:null,total:candidate.total_requirements_count??null};
  let verified=0,total=0;
  for(const value of [candidate.mandatory_coverage,candidate.core_coverage,candidate.preferred_coverage]){
    const match=String(value||"").match(/^(\d+)\/(\d+)$/);
    if(match){verified+=Number(match[1]);total+=Number(match[2])}
  }
  return{verified:candidate.verified_requirements_count??verified,total:candidate.total_requirements_count??total};
};

function Avatar({candidate,localPreview=false}:{candidate:Candidate;localPreview?:boolean}){
  const[photo,setPhoto]=useState(String(candidate.photo_url||""));
  useEffect(()=>{if(localPreview){setPhoto(String(candidate.photo_url||""));return}let active=true;setPhoto("");collegeApi.get<{photo?:string}>(`attendance/photos/students/${candidate.student_id}`).then(value=>{if(active)setPhoto(value.photo||"")}).catch(()=>{});return()=>{active=false}},[candidate.student_id,candidate.photo_url,localPreview]);
  const initials=candidate.full_name.split(/\s+/).slice(0,2).map(part=>part[0]).join("").toUpperCase();
  return photo?<img src={photo} alt={`${candidate.full_name} profile`} className="h-14 w-14 rounded-full border-4 border-indigo-50 object-cover"/>:<span className="grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-indigo-100 to-violet-200 font-bold text-indigo-800">{initials}</span>;
}

function ResumeDownload({driveId,studentId}:{driveId:string;studentId:string}){
  const[state,setState]=useState<"loading"|"ready"|"missing">("loading"),[url,setUrl]=useState("");
  useEffect(()=>{let active=true,objectUrl="";collegeApi.file(`drives/${driveId}/candidates/${studentId}/resume-file`).then(file=>{if(!active)return;if(!file.size){setState("missing");return}objectUrl=URL.createObjectURL(file);setUrl(objectUrl);setState("ready")}).catch(()=>active&&setState("missing"));return()=>{active=false;if(objectUrl)URL.revokeObjectURL(objectUrl)}},[driveId,studentId]);
  return state==="ready"?<a className={`${btn} gap-2 border-indigo-200 text-indigo-950`} href={url} download><Download size={15}/>Download resume</a>:<button className={btn} disabled><Download size={15}/>{state==="loading"?"Loading resume…":"Resume unavailable"}</button>;
}


export default function ATSFitAssessment({driveId,candidate,data,onReviewRequirements,localPreview=false,onOpenCoach}:{driveId:string;candidate:Candidate;data:Data;onReviewRequirements:()=>void;localPreview?:boolean;onOpenCoach?:()=>void}){
  const skills=Array.isArray(data.skills)?data.skills as Data[]:[];
  const totals=coverage(candidate),percent=totals.total&&totals.verified!==null?Math.round(totals.verified/totals.total*100):0;
  const sectionsReturned=!!data.resume_sections&&typeof data.resume_sections==="object";
  const parsed=(sectionsReturned?data.resume_sections:{}) as Data;
  const strengths=skills.filter(row=>["FULL_MATCH","RELATED_EVIDENCE"].includes(String(row.match_status)));
  const gaps=skills.filter(row=>["WEAK_OR_INFERRED","NO_EVIDENCE"].includes(String(row.match_status)));
  const evaluated=candidate.ats_status==="evaluated"&&typeof candidate.ats_fit_score==="number"&&Number.isFinite(candidate.ats_fit_score)&&candidate.ats_fit_score>=0&&candidate.ats_fit_score<=100;
  const score=Number(candidate.ats_fit_score||0);
  const review=evaluated?(gaps.length?"Needs review":"Requirements evidenced"):String(candidate.ats_status||"Needs re-evaluation").replaceAll("_"," ");
  const readinessReason=candidate.compatibility_summary||"Assessment details unavailable.";
  const[tab,setTab]=useState("requirements"),[requirementPage,setRequirementPage]=useState(0);
  const[showAllStrengths,setShowAllStrengths]=useState(false);
  const[showAllGaps,setShowAllGaps]=useState(false);
  const download=()=>{const payload={candidate:{student_id:candidate.student_id,full_name:candidate.full_name,email:candidate.email,department_code:candidate.department_code,program:candidate.program,cgpa:candidate.cgpa,graduation_year:candidate.graduation_year},assessment:{...data,skills,resume_sections:parsed}};const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:"application/json"})),anchor=document.createElement("a");anchor.href=url;anchor.download=`${candidate.student_id}-ats-assessment.json`;anchor.click();URL.revokeObjectURL(url)};

  return <div className="ats-fit-assessment text-slate-950">
    <section className="grid items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-[auto_1fr_auto]"><Avatar candidate={candidate} localPreview={localPreview}/><div><div className="flex flex-wrap items-center gap-2"><h3 className="text-lg font-bold text-indigo-950">{candidate.full_name}</h3><span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">{String(candidate.assignment_status||"Not started").replaceAll("_"," ")}</span><span className={`rounded-full px-3 py-1 text-xs font-semibold ${evaluated&&!gaps.length?"bg-emerald-100 text-emerald-800":"bg-amber-100 text-amber-800"}`}>{review}</span></div><p className="mt-1 text-sm text-slate-500">{candidate.email||"Email not supplied"}</p></div><dl className="grid grid-cols-3 divide-x divide-slate-200 text-sm"><div className="px-5"><dt className="text-slate-500">Program</dt><dd className="mt-1 font-semibold">{[candidate.department_code,candidate.program].filter(Boolean).join(" / ")||"—"}</dd></div><div className="px-5"><dt className="text-slate-500">CGPA</dt><dd className="mt-1 font-semibold">{candidate.cgpa??"—"}</dd></div><div className="px-5"><dt className="text-slate-500">Graduation</dt><dd className="mt-1 font-semibold">{candidate.graduation_year??"—"}</dd></div></dl></section>

    <section className="grid gap-3 lg:grid-cols-3"><article className="flex min-h-32 items-center gap-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="grid h-24 w-24 shrink-0 place-items-center rounded-full" style={{background:evaluated?`conic-gradient(#f5a800 ${Math.max(0,Math.min(100,score))*3.6}deg,#e7edf7 0)`:"#edf2f7"}}><div className="grid h-16 w-16 place-items-center rounded-full bg-white text-center"><strong className="text-2xl text-indigo-950">{evaluated?score:"—"}</strong>{evaluated&&<span className="-mt-3 text-xs text-slate-500">/ 100</span>}</div></div><div><div className="flex items-center gap-2"><h4 className="font-bold text-indigo-950">Resume Match</h4><Info size={14} className="text-slate-400"/></div><p className={`mt-1 font-semibold ${evaluated?"text-amber-600":"text-violet-600"}`}>{evaluated?(score>=80?"Strong alignment":score>=60?"Moderate alignment":"Limited alignment"):"Not assessed"}</p><p className="mt-2 text-xs leading-5 text-slate-500">{evaluated?`Backend resume-to-JD match score: ${score}/100.`:"A backend ATS score is not available for this candidate and drive."}</p></div></article><article className="flex min-h-32 gap-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-amber-50"><BarChart3 className="text-amber-500"/></span><div><div className="flex items-center gap-2"><h4 className="font-bold text-indigo-950">Role readiness</h4><Info size={14} className="text-slate-400"/></div><span className={`mt-2 inline-block rounded-full px-3 py-1 text-sm font-semibold ${evaluated&&!gaps.length?"bg-emerald-100 text-emerald-800":"bg-amber-100 text-amber-800"}`}>{review}</span><p className="mt-2 text-xs leading-5 text-slate-500">{readinessReason}</p></div></article><article className="flex min-h-32 gap-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-violet-50"><FileText className="text-violet-600"/></span><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><h4 className="font-bold text-indigo-950">Evidence coverage</h4><Info size={14} className="text-slate-400"/></div><strong className="mt-2 block text-xl text-indigo-950">{totals.total&&totals.verified!==null?`${totals.verified} of ${totals.total}`:"—"}</strong><p className="text-sm text-slate-500">requirements verified</p><div className="mt-4 h-2.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-violet-600 to-violet-400" style={{width:`${percent}%`}}/></div></div></article></section>

    <p className="flex items-center gap-3 rounded-xl bg-blue-50 px-4 py-3 text-xs text-slate-600"><Info size={18} className="shrink-0 text-blue-600"/>Based on resume evidence and job description completeness. Requirements without backend evidence remain unverified.</p>

    <nav className="ats-detail-tabs" aria-label="Assessment sections">{[["requirements","Requirements"],["resume","Resume evidence"],["insights","Insights"],["details","Assessment & JD"]].map(([key,label])=><button type="button" key={key} aria-pressed={tab===key} onClick={()=>setTab(key)}>{label}{key==="resume"&&<small>Education · skills · experience · certifications</small>}</button>)}</nav>
    <div className="ats-layout grid gap-3 lg:grid-cols-[1.65fr_.95fr]"><div className="ats-left" hidden={tab==="insights"||tab==="details"}><section hidden={tab!=="requirements"} className="ats-requirements overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-100 p-4"><div className="flex items-center gap-2 text-indigo-950"><BarChart3 size={20} className="text-violet-600"/><h4 className="font-bold">Requirement alignment</h4></div><span className="text-xs text-slate-500">{skills.length} requirements</span></div>{skills.length?<div className="ats-requirement-scroll overflow-x-auto"><table className="w-full min-w-[720px] text-left text-xs"><thead className="bg-blue-50/70 text-indigo-950"><tr>{["#","Requirement","Importance","Resume evidence","Match"].map(value=><th className="p-3 font-bold" key={value}>{value}</th>)}</tr></thead><tbody>{skills.slice(requirementPage*8,requirementPage*8+8).map((row,index)=>{const match=matchMeta(row.match_status);const evidence=String(row.evidence_text||(row.match_status==="NOT_ASSESSED"?"Assessment pending":"No evidence found"));const numeric=typeof row.match_strength==="number"?row.match_strength:typeof row.confidence==="number"?row.confidence*100:null;const matchPercent=numeric!=null&&Number.isFinite(numeric)?Math.max(0,Math.min(100,numeric)):null;return <tr className="border-t border-slate-100" key={String(row.target_id||index)}><td className="p-3">{requirementPage*8+index+1}</td><td className="p-3 font-semibold text-indigo-950">{String(row.requirement||row.skill||"Unnamed requirement")}</td><td className="p-3"><span className={`rounded-md px-2 py-1 font-semibold ${importanceClass(row.priority)}`}>{String(row.priority||"Core")}</span></td><td className="max-w-sm p-3 text-slate-600"><span className="ats-evidence-snippet" title={evidence}>{evidence}</span></td><td className="p-3"><div className="flex items-center gap-2"><span className="h-2 w-20 overflow-hidden rounded-full bg-slate-100"><span className={`block h-full rounded-full ${match.bar}`} style={{width:matchPercent==null?"0%":`${matchPercent}%`}}/></span><b className={match.text}>{match.label}{matchPercent!=null?` · ${Math.round(matchPercent)}%`:""}</b></div></td></tr>})}</tbody></table></div>:<p className="p-5 text-sm text-slate-500">No job requirements were returned. {readinessReason}</p>}{skills.length>8&&<nav className="ats-detail-pagination" aria-label="Requirement pages"><span>{requirementPage*8+1}–{Math.min(skills.length,requirementPage*8+8)} of {skills.length}</span><div><button disabled={requirementPage===0} onClick={()=>setRequirementPage(value=>value-1)}>Previous</button><button disabled={(requirementPage+1)*8>=skills.length} onClick={()=>setRequirementPage(value=>value+1)}>Next</button></div></nav>}</section>

      <section hidden={tab!=="resume"} className="ats-resume rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"><div className="mb-2 flex items-center justify-between gap-3 px-1"><div className="flex items-center gap-2 text-indigo-950"><FileText size={20}/><h4 className="font-bold">Resume evidence</h4></div>{localPreview?<button className={btn} disabled title="Open the authenticated candidate view to download the original resume"><Download size={15}/>Download resume</button>:<ResumeDownload driveId={driveId} studentId={candidate.student_id}/>}</div>{!sectionsReturned&&<p role="status" className="mb-2 rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-800">The ATS API did not return parsed resume sections for this candidate. This does not mean the saved resume is empty.</p>}{sectionRows.map(([label,Icon,key])=>{const items=Array.isArray(parsed[key])?parsed[key] as unknown[]:[],empty=candidate.resume_parse_ready?`No ${label.toLowerCase()} found in the parsed resume`:"Not returned by ATS API";return <details open={key==="education"||key==="certifications"} className="group border-t border-slate-100" key={key}><summary className="flex cursor-pointer list-none items-center gap-3 p-3"><span className="grid h-7 w-7 place-items-center rounded-lg bg-violet-50"><Icon size={16} className="text-violet-600"/></span><b className="w-32 text-sm text-indigo-950">{label}</b><span className="min-w-0 flex-1 truncate text-xs text-slate-500">{items.length?items.map(String).join(" · "):empty}</span><ChevronDown size={15} className="transition group-open:rotate-180"/></summary><div className="space-y-1 px-12 pb-3 text-sm text-slate-600">{items.length?items.map((item,index)=><p key={index}>{String(item)}</p>):empty}</div></details>})}</section></div>

      <div hidden={tab!=="insights"} className="ats-right"><section className="ats-insights rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"><div className="flex items-center gap-2 px-1 text-indigo-950"><FileText size={20}/><h4 className="font-bold">Evidence-based insights</h4></div><div className="mt-3 overflow-hidden rounded-xl border border-emerald-100 bg-emerald-50/70"><h5 className="flex items-center gap-2 bg-emerald-100/70 px-3 py-2 font-semibold text-emerald-800"><Star size={18} fill="currentColor"/>Strengths</h5><div className="p-3">{strengths.length?(showAllStrengths?strengths:strengths.slice(0,2)).map((row,index)=><p className="mb-3 text-sm last:mb-0" key={index}><b className="text-indigo-950">{String(row.requirement||row.skill)}</b><br/><small className="leading-5 text-slate-600">{String(row.evidence_text||row.reason||"")}</small></p>):<p className="text-sm text-slate-600">No requirements have verified resume evidence.</p>}{strengths.length>2&&<button type="button" className="mt-2 text-xs font-semibold text-emerald-800 underline" aria-expanded={showAllStrengths} onClick={()=>setShowAllStrengths(value=>!value)}>{showAllStrengths?"Show fewer strengths":`View all ${strengths.length} strengths`}</button>}</div></div><div className="mt-2 overflow-hidden rounded-xl border border-amber-100 bg-amber-50/70"><h5 className="flex items-center gap-2 bg-amber-100/70 px-3 py-2 font-semibold text-amber-800"><AlertTriangle size={18}/>Gaps to verify</h5><div className="p-3">{gaps.length?(showAllGaps?gaps:gaps.slice(0,3)).map((row,index)=><p className="mb-3 text-sm last:mb-0" key={index}><b className="text-indigo-950">{String(row.requirement||row.skill)}</b><br/><small className="leading-5 text-slate-600">{String(row.reason||row.evidence_text||"No matching resume evidence was returned.")}</small></p>):<p className="text-sm text-slate-600">No partial or missing requirements were returned.</p>}{gaps.length>3&&<button type="button" className="mt-2 text-xs font-semibold text-amber-800 underline" aria-expanded={showAllGaps} onClick={()=>setShowAllGaps(value=>!value)}>{showAllGaps?"Show fewer gaps":`Show all ${gaps.length} gaps`}</button>}{candidate.job_description_ready_reason&&<p className="mt-3 text-sm"><b className="text-indigo-950">Job description needs review</b><br/><small className="leading-5 text-slate-600">{candidate.job_description_ready_reason}</small></p>}</div></div></section><section className="ats-student-suggestions rounded-xl border border-slate-200 bg-white p-4"><h4 className="font-bold">Personalized resume suggestions</h4>{Array.isArray(data.resume_edit_suggestions)&&data.resume_edit_suggestions.length?(data.resume_edit_suggestions as Data[]).map((suggestion,index)=><article key={index} className="mt-3 border-t border-slate-100 pt-3"><strong>{String(suggestion.requirement||"")}</strong><p className="mt-1 text-sm text-slate-600">{String(suggestion.suggestion||"")}</p></article>):<p className="mt-2 text-sm text-slate-500">{evaluated?"No evidence-gap edit suggestions were returned.":"Suggestions will appear after assessment."}</p>}</section></div></div>

    <details hidden={tab!=="details"} open className="ats-existing-details rounded-xl border bg-white p-4"><summary className="font-bold text-indigo-950">Assessment details &amp; job description</summary><dl className="mt-3 grid gap-3 sm:grid-cols-3">{[["Mandatory coverage",candidate.mandatory_coverage],["Core coverage",candidate.core_coverage],["Preferred coverage",candidate.preferred_coverage],["Resume evidence",data.resume_evidence||candidate.resume_evidence],["Assessment status",review],["Resume version",data.resume_version]].map(([label,value])=><div key={String(label)}><dt className="text-xs text-slate-500">{String(label)}</dt><dd className="mt-1 break-words text-sm">{String(value??"Not available")}</dd></div>)}</dl><h5 className="mt-4 font-semibold">Drive Job Description</h5><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{String(data.job_description||data.current_drive_job_description||"The API has not returned a job description for this drive.")}</p></details>

    <footer className="fixed bottom-0 right-0 z-10 flex w-full max-w-6xl justify-end gap-3 border-t border-slate-200 bg-white/95 p-3 shadow-[0_-8px_24px_rgba(15,23,42,.06)] backdrop-blur"><button className={btn} disabled={!evaluated} onClick={download}><Download size={16}/>Download assessment</button>{onOpenCoach&&<button className={btn} onClick={onOpenCoach}><Sparkles size={16}/>AI Coach</button>}<button className={`${btn} bg-gradient-to-r from-violet-700 to-indigo-600 text-white shadow-md hover:from-violet-800 hover:to-indigo-700`} onClick={onReviewRequirements}>Review job requirements <Sparkles size={16}/></button></footer>
  </div>;
}
