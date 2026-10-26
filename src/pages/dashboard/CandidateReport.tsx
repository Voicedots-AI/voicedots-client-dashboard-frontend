import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  BarChart3,
  ChevronDown,
  ChevronRight,
  Code2,
  FileText,
  ChevronLeft,
  Download,
  Lightbulb,
  MessageCircle,
  Settings,
  ShieldCheck,
  Target,
  Trophy,
  Volume2,
  X,
} from "lucide-react";
import { collegeApi, collegeError, type Drive } from "@/api/collegeApi";
import { btn } from "./interviewAgentTypes";
import { displayName } from "./placementDisplay";
import { roleLabels } from "./interviewAgentTypes";

type Data = Record<string, unknown>;
type Report = Data & {
  drive_id?: string;
  session_id?: string;
  overall_score?: number;
  readiness?: string;
  completed_at?: string;
  detail?: Data;
  attempt_number?: number;
  recording?: Data | null;
};
const nav = [
  ["skills", "Skills proof"],
  ["rounds", "Rounds & competencies"], ["proctor", "AI Proctor"],
  ["feedback", "Student feedback"],
] as const;
const reportPanel = "rounded-2xl border border-sky-100 bg-white p-5 shadow-[0_10px_30px_rgba(15,42,82,0.06)]";
const competencyColors = ["#0dafa0", "#f2b313", "#11b39b", "#f4ad16", "#42b7ec"];
const reportField = "mt-1 w-full rounded-xl border border-sky-200 bg-white p-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-100";

// Extract a short topic from saved evidence; the complete assessment stays in the deep dive.
function evidenceTopic(value: unknown) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!text) return "—";
  if (text.split(/\s+/).length <= 3) return text;
  if (/\breporting a bug\b/i.test(text)) return "Reporting a bug";
  const topic = text.match(/\b(?:bug[- ]report(?: fields| explanation)?|regression (?:testing|checks|ordering)|personal (?:task|example|positioning)|automation tools|fillers and self-corrections|boundary[- ]value (?:inputs|analysis)|boundary values|defect[- ]tracking|reporting defects|testing knowledge|testing serves quality|software testing|supporting evidence|quality assurance|testing steps|project architecture|SQL (?:query|optimisation|optimization)|teamwork examples?|expected (?:versus|vs\.?) actual|role awareness|failed inputs?)\b/i)?.[0];
  if (topic) return topic.charAt(0).toUpperCase() + topic.slice(1);
  const words = text.replace(/[.,;:!?]/g, "").split(/\s+/).filter(word => !/^(the|a|an|candidate|answers?|is|are|was|were|has|have|had|some|there|this|that|of|to|in|on|and|or|but|for|with|by|as|it|their|they|gives?|shows?|demonstrates?|provides?|appears?|generally|how|did|do|you|your|what|would|can|could)$/i.test(word));
  return words.slice(0, 3).join(" ") || text.split(/\s+/).slice(0, 3).join(" ");
}

function CompetencyIcon({ label, index }: { label: string; index: number }) {
  const normalized = label.toLowerCase();
  const Icon = normalized.includes("communication")
    ? MessageCircle
    : normalized.includes("analytic") || normalized.includes("reason") || normalized.includes("thinking")
      ? BarChart3
      : normalized.includes("practical") || normalized.includes("applied") || normalized.includes("code")
        ? Code2
        : normalized.includes("problem") || normalized.includes("confidence")
          ? Lightbulb
          : Settings;
  const tones = ["text-blue-600", "text-teal-600", "text-sky-600", "text-amber-500"];
  return <Icon aria-hidden="true" className={`shrink-0 ${tones[index % tones.length]}`} size={18} strokeWidth={2.5}/>;
}

function highlightTopic(question: string) {
  const topics: Array<[RegExp, string]> = [
    [/edge detection/i, "Edge detection inputs / outputs"],
    [/regression.*(?:first|order|decide)|(?:first|order|decide).*regression/i, "Regression test priorities"],
    [/(?:bug|defect).*(?:details|fields)|(?:details|fields).*(?:bug|defect)/i, "Bug report details"],
    [/(?:bug|defect).*(?:report|developer)|report.*(?:bug|defect)/i, "Defect reporting"],
    [/(?:why|what made|motivat).*(?:role|testing)|(?:role|testing).*(?:why|what made)/i, "Motivation for testing"],
    [/check first.*order/i, "Test execution order"],
  ];
  return topics.find(([pattern]) => pattern.test(question))?.[1] || question;
}

function observedStrengths(dimensions: Data[]) {
  // These describe positive observations explicitly present in the saved rationale,
  // including developing-level skills; they do not imply mastery or a higher score.
  const rules: Array<[string, RegExp, string]> = [
    ["domain_knowledge", /demonstrates basic testing knowledge/i, "Basic testing knowledge"],
    ["applied_evidence", /concrete actions for reporting defects.*(?:images|video)/i, "Defect reporting with evidence"],
    ["structured_thinking", /some method.*regression ordering/i, "Ordered regression checks"],
  ];
  return rules.filter(([dimension, pattern]) => dimensions.some(item => item.dimension === dimension && Number(item.percentage) >= 50 && pattern.test(String(item.rationale || item.reason || item.evidence || "")))).map(([, , label]) => label);
}
function PreviewToggle({ shown, total, onClick, noun = "items" }: { shown: number; total: number; onClick: () => void; noun?: string }) {
  if (total <= 4) return null;
  const expanded = shown >= total;
  return <button type="button" onClick={onClick} className="mt-3 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-violet-700 transition hover:bg-violet-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-500">{expanded ? "Show less" : `Show all ${total} ${noun}`}<ChevronDown size={14} className={`transition-transform ${expanded ? "rotate-180" : ""}`}/></button>;
}
const show = (value: unknown, fallback = "Not available") =>
  value === null || value === undefined || value === ""
    ? fallback
    : String(value);
const stamp = (value: unknown) =>
  value ? new Date(String(value)).toLocaleString() : "Not available";
const durationLabel=(value:unknown)=>{const total=Math.max(0,Math.floor(Number(value)||0)),hours=Math.floor(total/3600),minutes=Math.floor(total%3600/60),seconds=total%60;return hours?`${hours}h ${minutes}m ${seconds}s`:`${minutes}m ${seconds}s`};
const decisionLabel = (value: unknown) => value === "shortlist" ? "Shortlisted" : value === "reject" ? "Rejected" : displayName(show(value, "undecided"));
const eventExplanation = (event: Data) => {
  const details = event.details;
  if (details && typeof details === "object" && typeof (details as Data).message === "string") return String((details as Data).message);
  const descriptions: Record<string, string> = {
    camera_lost: "The interview camera connection was interrupted.",
    candidate_not_visible: "The candidate was not detected in the camera view.",
    multiple_people_visible: "More than one person was detected in the camera view.",
    multiple_people_cleared: "The additional person was no longer detected.",
    tab_hidden: "The interview page moved out of the foreground.",
    fullscreen_exit: "The interview left full-screen mode.",
    screen_share_ended: "Screen sharing ended during the interview.",
    gaze_off_camera: "A gaze direction change was recorded for review.",
  };
  return descriptions[String(event.event_type || event.type)] || "A proctoring observation was recorded for human review.";
};

function List({ items, empty }: { items: unknown; empty: string }) {
  const values = Array.isArray(items) ? items : [];
  if (!values.length) return <p className="text-sm text-slate-500">{empty}</p>;
  return (
    <div className="space-y-3">
      {values.map((raw, index) => {
        const item: Data =
          typeof raw === "object" && raw ? (raw as Data) : { label: raw };
        const actions: unknown[] = Array.isArray(item.actions)
          ? item.actions
          : [];
        return (
          <article
            className="rounded-xl border border-slate-200 bg-white p-4 text-sm transition hover:border-violet-200 hover:shadow-sm"
            key={index}
          >
            <div className="flex justify-between gap-3">
              <strong>
                {show(
                  item.label ||
                    item.focus ||
                    item.requirement ||
                    item.role ||
                    item.dimension ||
                    item.strength ||
                    item.skill ||
                    item.name ||
                    item.title ||
                    item.text ||
                    item.content,
                  "Evidence recorded",
                )}
              </strong>
              {item.current_band != null && (
                <span>
                  {show(item.current_band)} → {show(item.target_band)}
                </span>
              )}
            </div>
            {(item.evidence ||
              item.problem ||
              item.summary ||
              item.reason ||
              item.description) != null && (
              <p className="mt-2 text-slate-600">
                {show(
                  item.evidence ||
                    item.problem ||
                    item.summary ||
                    item.reason ||
                    item.description,
                )}
              </p>
            )}
            {actions.length > 0 && (
              <ul className="mt-2 list-disc pl-5">
                {actions.map((action, i) => (
                  <li key={i}>{show(action)}</li>
                ))}
              </ul>
            )}
          </article>
        );
      })}
    </div>
  );
}
function Audio({ path }: { path: string }) {
  const [url, setUrl] = useState(""),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false);
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );
  if (url) return <audio className="mt-3 w-full" controls src={url} />;
  return (
    <>
      <button
        className={`${btn} mt-3`}
        disabled={loading}
        onClick={async () => {
          setLoading(true);
          setError("");
          try {
            setUrl(await collegeApi.audio(path));
          } catch (e) {
            setError(collegeError(e) || "Audio is unavailable for this response.");
          } finally {
            setLoading(false);
          }
        }}
      >
        <Volume2 size={15} />
        {loading ? "Loading response audio…" : "Play response audio"}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-xs text-rose-600">
          {error}
        </p>
      )}
    </>
  );
}

function ReportKeyboardShortcuts({
  videoRef,
  onNextFlag,
}: {
  videoRef: { current: HTMLVideoElement | null };
  onNextFlag: () => void;
}) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("button,a,input,textarea,select,[contenteditable]")) return;
      const video = videoRef.current;
      if (event.code === "Space" && video) {
        event.preventDefault();
        if (video.paused) void video.play().catch(() => {});
        else video.pause();
      }
      if (event.key === "ArrowLeft" && video && video.readyState >= 1) video.currentTime = Math.max(0, video.currentTime - 5);
      if (event.key === "ArrowRight" && video && video.readyState >= 1) video.currentTime = Math.min(video.duration || Infinity, video.currentTime + 5);
      if (event.key.toLowerCase() === "n") onNextFlag();
      if (event.key.toLowerCase() === "b") document.getElementById("bookmark-note")?.focus();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [videoRef, onNextFlag]);
  return null;
}

export default function CandidateReport({
  driveId,
  studentId,
  onBack,
  candidatePosition,
  candidateTotal,
  canPrevious,
  canNext,
  onNavigate,
}: {
  driveId: string;
  studentId: string;
  onBack: () => void;
  candidatePosition?: number | null;
  candidateTotal?: number;
  canPrevious?: boolean;
  canNext?: boolean;
  onNavigate?: (direction: -1 | 1) => void;
}) {
  const [bundle, setBundle] = useState<Data | null>(null),
    [drive, setDrive] = useState<Drive | null>(null),
    [decisionData, setDecisionData] = useState<Data | null>(null),
    [resultSettings, setResultSettings] = useState<Data | null>(null);
  const [transcript, setTranscript] = useState<Data | null>(null),
    [integrity, setIntegrity] = useState<Data | null>(null);
  const [recording, setRecording] = useState<Data | null>(null),
    [recordingLoading, setRecordingLoading] = useState(false),
    [recordingError, setRecordingError] = useState("");
  const [candidatePhoto, setCandidatePhoto] = useState({ studentId: "", url: "" });
  useEffect(() => {
    if (!bundle) return;
    const frame = requestAnimationFrame(() => document.getElementById("glance")?.scrollIntoView({ block: "start" }));
    return () => cancelAnimationFrame(frame);
  }, [bundle, studentId]);
  const [focusGroup, setFocusGroup] = useState<"strengths" | "growth" | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const toggleExpanded = (key: string) => setExpanded(current => ({ ...current, [key]: !current[key] }));
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [transcriptLoading, setTranscriptLoading] = useState(false),
    [integrityLoading, setIntegrityLoading] = useState(false),
    [transcriptError, setTranscriptError] = useState(""),
    [integrityError, setIntegrityError] = useState(""),
    [activeEvent, setActiveEvent] = useState(0);
  const [activeTab, setActiveTab] = useState<(typeof nav)[number][0]>("skills");
  const [skillFilter, setSkillFilter] = useState("all");
  const [bookmarkFilter, setBookmarkFilter] = useState("all");
  const [resumeSkillFilter, setResumeSkillFilter] = useState("all");
  const [bookmarkNote, setBookmarkNote] = useState("");
  const [bookmarkNotes, setBookmarkNotes] = useState<Array<{ id: string; seconds: number; text: string }>>([]);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [driveError, setDriveError] = useState(""),
    [decisionError, setDecisionError] = useState("");
  const [decision, setDecision] = useState(""),
    [note, setNote] = useState(""),
    [schedule, setSchedule] = useState("");
  const [confirm, setConfirm] = useState<
      "decision" | "release" | "schedule" | "cancel_schedule" | null
    >(null),
    [busy, setBusy] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const loadRequest = useRef(0);
  const reportIdentity = `${driveId}:${studentId}`;
  const currentIdentity = useRef(reportIdentity);
  currentIdentity.current = reportIdentity;
  async function load() {
    const identity = reportIdentity;
    if (identity !== currentIdentity.current) return;
    const request = ++loadRequest.current;
    const isCurrent = () => identity === currentIdentity.current && request === loadRequest.current;
    setBusy(true);
    setError("");
    try {
      const [reports, driveValue, decisionValue, settingsValue] = await Promise.allSettled([
        collegeApi.get<Data>(`students/${studentId}/reports`),
        collegeApi.get<Drive>(`drives/${driveId}`),
        collegeApi.get<Data>(
          `drives/${driveId}/candidates/${studentId}/decision`,
        ),
        collegeApi.get<Data>("interview-results-settings"),
      ]);
      if (!isCurrent()) return;
      if (reports.status === "fulfilled") setBundle(reports.value);
      else setError(`Interview report could not be loaded: ${collegeError(reports.reason)}`);
      if (driveValue.status === "fulfilled") { setDrive(driveValue.value); setDriveError(""); }
      else setDriveError(collegeError(driveValue.reason));
      if (decisionValue.status === "fulfilled") {
        setDecisionData(decisionValue.value);
        setDecisionError("");
        const current = decisionValue.value.decision as Data | undefined;
        setDecision(current?.decision ? String(current.decision) : "");
        setNote(current?.note ? String(current.note) : "");
      } else setDecisionError(collegeError(decisionValue.reason));
      if (settingsValue.status === "fulfilled") setResultSettings(settingsValue.value);
    } catch (e) {
      if (isCurrent()) setError(collegeError(e));
    } finally {
      if (isCurrent()) setBusy(false);
    }
  }
  useEffect(() => {
    setBundle(null);
    setDrive(null);
    setDecision(""); setNote(""); setSchedule(""); setNotice(""); setConfirm(null);
    setDecisionData(null);
    setTranscript(null);
    setIntegrity(null);
    setRecording(null);
    setTranscriptError("");
    setIntegrityError("");
    setRecordingError("");
    setBookmarkNotes([]);
    setPlaybackTime(0);
    setIsPlaying(false);
    setBookmarkNote("");
    void load();
    return () => { loadRequest.current += 1; };
  }, [driveId, studentId]);
  useEffect(() => {
    let active = true;
    collegeApi.get<{ photo?: string }>(`attendance/photos/students/${studentId}`)
      .then(result => { if (active) setCandidatePhoto({ studentId, url: result.photo || "" }); })
      .catch(() => { if (active) setCandidatePhoto({ studentId, url: "" }); });
    return () => { active = false; };
  }, [studentId]);
  const report = useMemo(
    () =>
      ((bundle?.reports || []) as Report[]).find(
        (item) => item.drive_id === driveId,
      ),
    [bundle, driveId],
  );
  function openAnswer(index: number) {
    setBookmarkFilter("question");
    window.setTimeout(() => { const item = document.getElementById(`answer-${index}`) as HTMLDetailsElement | null; if (item) { item.open = true; item.scrollIntoView({ behavior: "smooth", block: "nearest" }); } }, 0);
  }
  const recordingRequest = useRef(0);
  const refreshedPlayback = useRef(false);
  async function loadRecording() {
    if (!report?.session_id) return;
    const request = ++recordingRequest.current;
    setRecordingLoading(true);
    setRecordingError("");
    try {
      const value = await collegeApi.get<Data>(`students/${studentId}/reports/${report.session_id}/recording`);
      if (request === recordingRequest.current) setRecording(value);
    } catch (e) {
      if (request === recordingRequest.current) setRecordingError(collegeError(e));
    } finally {
      if (request === recordingRequest.current) setRecordingLoading(false);
    }
  }
  function recoverPlayback() {
    const url = String(recording?.playback_url || "");
    if (url && !refreshedPlayback.current) {
      refreshedPlayback.current = true;
      void loadRecording();
    } else setRecordingError("Playback could not load. Refresh the secure link and try again.");
  }
  useEffect(() => {
    refreshedPlayback.current = false;
    setRecording(null);setRecordingError('');setRecordingLoading(false);
    if (report?.session_id) void loadRecording();
    return () => { recordingRequest.current += 1; };
  },[report?.session_id,studentId]);
  useEffect(() => {
    if (!['recording','uploading','processing'].includes(String(recording?.status))) return;
    const timer=window.setInterval(()=>{if(document.visibilityState!=='hidden')void loadRecording();},10000);
    return()=>window.clearInterval(timer);
  },[recording?.status,report?.session_id,recordingLoading]);
  function seekToQuestion(askedAt: unknown) {
    // After a reconnect the finished file concatenates browser segments and
    // has no single wall-clock offset for the full timeline. Never offer a
    // misleading seek in that case.
    if (Number(recording?.segment_count || 0) > 1) return;
    const start = Date.parse(String(recording?.started_at || ""));
    const question = Date.parse(String(askedAt || ""));
    if (!videoRef.current || !Number.isFinite(start) || !Number.isFinite(question)) return;
    const offset = (question - start) / 1000;
    const duration = Number(recording?.duration_seconds || 0);
    if (offset < 0 || (duration > 0 && offset > duration)) return;
    seekToOffset(offset);
  }
  function seekToOffset(offset: number) {
    const video = videoRef.current;
    if (!video || !Number.isFinite(offset) || offset < 0) return;
    const identity = reportIdentity;
    video.scrollIntoView({ behavior: "smooth", block: "center" });
    const seekAndPlay = () => {
      if (videoRef.current !== video || identity !== currentIdentity.current) return;
      try {
        video.currentTime = Number.isFinite(video.duration) ? Math.min(offset, video.duration) : offset;
        void video.play().catch(() => undefined);
      } catch {
        // A secure video URL may still be loading; the one-shot metadata
        // listener below retries only after the browser can seek it.
      }
    };
    if (video.readyState === 0) video.addEventListener("loadedmetadata", seekAndPlay, { once: true });
    else seekAndPlay();
  }
  function seekToEvent(event: Data) {
    seekToQuestion(event.occurred_at || event.created_at);
  }
  function recordingOffset(timestamp: unknown): number | null {
    if (Number(recording?.segment_count || 0) > 1) return null;
    const start = Date.parse(String(recording?.started_at || ""));
    const point = Date.parse(String(timestamp || ""));
    if (!Number.isFinite(start) || !Number.isFinite(point)) return null;
    const offset = (point - start) / 1000;
    const duration = Number(recording?.duration_seconds || 0);
    return offset >= 0 && (!duration || offset <= duration) ? offset : null;
  }
  const evidenceRequest = useRef(0);
  useEffect(() => { evidenceRequest.current += 1; setTranscript(null); setIntegrity(null); setTranscriptLoading(false); setIntegrityLoading(false); setTranscriptError(""); setIntegrityError(""); return () => { evidenceRequest.current += 1; }; }, [report?.session_id, studentId]);
  async function evidence(kind: "transcript" | "integrity-events") {
    if (!report?.session_id) return;
    const request = evidenceRequest.current;
    const isTranscript = kind === "transcript";
    if (isTranscript) { setTranscriptLoading(true); setTranscriptError(""); }
    else { setIntegrityLoading(true); setIntegrityError(""); }
    try {
      const value = await collegeApi.get<Data>(
        `students/${studentId}/reports/${report.session_id}/${kind}`,
      );
      if (request !== evidenceRequest.current) return;
      if (kind === "transcript") setTranscript(value);
      else setIntegrity(value);
    } catch (e) {
      if (request !== evidenceRequest.current) return;
      if (isTranscript) setTranscriptError(collegeError(e));
      else setIntegrityError(collegeError(e));
    } finally {
      if (request === evidenceRequest.current && isTranscript) setTranscriptLoading(false);
      else if (request === evidenceRequest.current) setIntegrityLoading(false);
    }
  }
  useEffect(() => {
    if (!report?.session_id) return;
    if (!transcript && !transcriptLoading && !transcriptError) void evidence("transcript");
    if (!integrity && !integrityLoading && !integrityError) void evidence("integrity-events");
  }, [report?.session_id]);
  async function perform() {
    if (!confirm) return;
    const action = confirm;
    const identity = reportIdentity;
    setConfirm(null);
    setBusy(true);
    try {
      if (action === "decision")
        await collegeApi.save(
          `drives/${driveId}/candidates/${studentId}/decision`,
          { decision, note },
          true,
        );
      if (action === "release")
        await collegeApi.save(
          `drives/${driveId}/candidates/${studentId}/release`,
          {},
          true,
        );
      if (action === "schedule")
        await collegeApi.save(
          `drives/${driveId}/candidates/${studentId}/release/schedule`,
          { scheduled_for: new Date(schedule).toISOString() },
          true,
        );
      if (action === "cancel_schedule")
        await collegeApi.remove(
          `drives/${driveId}/candidates/${studentId}/release/schedule`,
        );
      if (identity !== currentIdentity.current) return;
      if (action === "decision") setBookmarkNotes([]);
      setNotice(
        action === "decision"
          ? "Officer decision saved."
          : "Student result publication updated.",
      );
      await load();
    } catch (e) {
      if (identity === currentIdentity.current) setError(collegeError(e));
    } finally {
      if (identity === currentIdentity.current) setBusy(false);
    }
  }
  if (busy && !bundle) return <section role="status" className="mx-auto max-w-7xl animate-pulse rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">Loading candidate report…</section>;
  if (!report)
    return (
      <section className={reportPanel}>
        <p role="alert">
          {error || "No report exists for this candidate in this drive."}
        </p>
        <button className={`${btn} mt-4`} onClick={onBack}>
          <ArrowLeft size={16} />
          Back
        </button>
      </section>
    );

  const student = (bundle?.student || {}) as Data,
    detail = report.detail || {},
    pri = (detail.placement_readiness || {}) as Data,
    jobFit = (detail.job_fit || {}) as Data,
    confidence = (detail.evaluation_confidence || {}) as Data,
    hiring = (detail.hiring_recommendation || {}) as Data,
    placement = (detail.placement_recommendation || {}) as Data,
    proctor = (detail.proctoring_score || {}) as Data,
    publication = (decisionData?.publication || {}) as Data;
  const dimensions = [
      ...((detail.core_dimensions || []) as Data[]),
      ...((detail.domain_dimensions || []) as Data[]),
    ],
    rounds = (detail.agent_breakdown || []) as Data[],
    reviews = (detail.question_reviews || []) as Data[],
    requirements = (detail.requirement_evidence_matrix ||
      detail.requirement_assessment ||
      []) as Data[],
    turns = (transcript?.turns || []) as Data[],
    events = (integrity?.events || []) as Data[],
    history = (decisionData?.history || []) as Data[];
  const recommendationLabels = (resultSettings?.recommendation_labels || {}) as Data;
  const roundRole = (trackValue: unknown, configured?: unknown) => {
    const track = String(trackValue || "").toLowerCase();
    const saved = drive?.agent_selection?.find(item => item.track === track)?.profile?.role;
    const allowed = new Set([...(drive?.agent_selection || []).map(item => item.profile?.role).filter(Boolean), ...Object.values(roleLabels)]);
    const candidate = String(saved || configured || "").trim();
    if (candidate && allowed.has(candidate)) return candidate;
    return roleLabels[track] || "Interview question";
  };
  const orderedHistory = [...history].sort((a, b) => {
    const aTime = Date.parse(String(a.decided_at || a.created_at || ""));
    const bTime = Date.parse(String(b.decided_at || b.created_at || ""));
    if (!Number.isFinite(aTime)) return Number.isFinite(bTime) ? 1 : 0;
    if (!Number.isFinite(bTime)) return -1;
    return bTime - aTime;
  });
  const comparable = pri.comparable !== false && typeof pri.score === "number";
  const recordingStatus = recording?.status || report.recording?.status || "unavailable";
  const recordingDuration = recording?.duration_seconds ?? report.recording?.duration_seconds;
  const executiveSummary = detail.executive_summary || detail.not_assessed_notice;
  const strengths = Array.isArray(detail.strengths) ? detail.strengths : [];
  const growthAreas = [detail.priority_improvement_areas, placement.recommended_preparation, placement.needs_improvement_before].find((items): items is unknown[] => Array.isArray(items) && items.length > 0) || [];
  const recommendationReasons = Array.isArray(hiring.reasons) ? hiring.reasons : [];
  const suitableRoles = Array.isArray(placement.suitable_roles) ? placement.suitable_roles : [];
  const preparationSteps = Array.isArray(placement.recommended_preparation) ? placement.recommended_preparation : Array.isArray(placement.needs_improvement_before) ? placement.needs_improvement_before : [];
  const nextRoundQuestions = Array.isArray(detail.next_round_questions) ? detail.next_round_questions : Array.isArray(placement.next_round_questions) ? placement.next_round_questions : [];
  const feedbackSummary = detail.student_feedback_summary || detail.student_summary || executiveSummary;
  const filteredRequirements = requirements.filter(item => skillFilter === "all" || (skillFilter === "gaps" && item.requirement_was_asked === true && item.candidate_mentioned !== true) || (skillFilter === "demonstrated" && item.candidate_mentioned === true) || (skillFilter === "not_asked" && item.requirement_was_asked !== true));
  const videoReady = typeof recording?.playback_url === "string" && recording.playback_url.trim().length > 0;
  const currentDecisionNote = String((decisionData?.decision as Data | undefined)?.note || "");
  const timeLabel = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
  const addBookmarkNote = () => {
    const videoTime = videoRef.current?.currentTime;
    const content = bookmarkNote.trim();
    if (!content || videoTime == null) return;
    setBookmarkNotes(current => [...current, { id: `${Date.now()}-${current.length}`, seconds: videoTime, text: content }]);
    setBookmarkFilter("note");
    setNotice("Timestamped note added to this page. Include it in the officer note and save the decision to persist it.");
    setBookmarkNote("");
  };
  const jumpToAdjacentFlag = (direction: -1 | 1) => {
    if (!videoReady || !events.length) return;
    const next = (activeEvent + direction + events.length) % events.length;
    setActiveEvent(next);
    seekToEvent(events[next]);
  };
  const communication = (detail.communication || {}) as Data;
  const resumeAlignment = (detail.resume_alignment || {}) as Data;
  const resumeSkills = Array.isArray(resumeAlignment.skills) ? resumeAlignment.skills as Data[] : [];
  const testedResumeSkills = resumeSkills.filter(item => !["not_assessed", ""].includes(String(item.evidence_level || "").toLowerCase()));
  const verifiedResumeSkills = testedResumeSkills.filter(item => String(item.evidence_level || "").toLowerCase() === "verified");
  const claimGaps = resumeSkills.filter(item => String(item.evidence_level || "").toLowerCase() === "not_demonstrated");
  const notTestedResumeSkills = resumeSkills.filter(item => String(item.evidence_level || "").toLowerCase() === "not_assessed");
  const filteredResumeSkills = resumeSkills.filter(item => resumeSkillFilter === "all" || (resumeSkillFilter === "gaps" && String(item.evidence_level || "").toLowerCase() === "not_demonstrated") || (resumeSkillFilter === "verified" && String(item.evidence_level || "").toLowerCase() === "verified") || (resumeSkillFilter === "not_tested" && String(item.evidence_level || "").toLowerCase() === "not_assessed"));
  const dontKnowCount = reviews.filter(review => String(review.answer_state || review.evidence_status || "").toLowerCase() === "explicit_dont_know").length;
  const proctorViolations = events.filter(event => String(event.severity || "").toLowerCase() === "violation");
  const proctorScore = typeof proctor.overall_score === "number" ? proctor.overall_score : typeof proctor.score === "number" ? proctor.score : null;
  const feedback = (detail.student_feedback || detail.learning_plan || {}) as Data;
  const feedbackAreas = Array.isArray(feedback.growth_areas) ? feedback.growth_areas : growthAreas;
  const savedNoteBookmarks = [currentDecisionNote, ...orderedHistory.map(item => String(item.note || ""))]
    .flatMap(value => [...value.matchAll(/\[Recording (\d{1,2}:\d{2})\] ([^\n]+)/g)].map(match => {
      const [minutes, seconds] = match[1].split(":").map(Number);
      return { id: `${match[0]}-${value.slice(0, 20)}`, seconds: minutes * 60 + seconds, text: match[2], saved: true };
    }));
  const visibleBookmarks: Array<{ id: string; seconds: number | null; text: string; detail?: string; event?: Data; saved?: boolean; questionIndex?: number }> = [
    ...(bookmarkFilter === "all" || bookmarkFilter === "question" ? reviews.map((review,index) => ({id:`question-${index}`,seconds:recordingOffset(turns.find(turn=>String(turn.turn_id)===String(review.turn_id))?.asked_at || review.asked_at || review.answer_started_at),text:`Q${index+1} · ${show(review.question || review.question_text,"Interview question")}`,questionIndex:index,saved:true})) : []),
    ...(bookmarkFilter === "all" || bookmarkFilter === "note" ? [...bookmarkNotes.map(item => ({ ...item, saved: false }))] : []),
    ...(bookmarkFilter === "all" || bookmarkFilter === "proctor" ? events.map((event, index) => ({ id: String(event.event_id || index), seconds: recordingOffset(event.occurred_at || event.created_at), text: displayName(show(event.event_type || event.type, "Proctor observation")), detail: eventExplanation(event), event, saved: true })) : []),
    ...(bookmarkFilter === "all" || bookmarkFilter === "note" ? savedNoteBookmarks : []),
  ].sort((a, b) => Number(a.seconds ?? Infinity) - Number(b.seconds ?? Infinity));
  const answerState = (review: Data) => String(review.answer_state || review.evidence_status || review.status || "not_assessed").toLowerCase();
  const answerLabel = (review: Data) => { const state = answerState(review); return state === "answered" ? "Answered" : ["explicit_dont_know", "no_response", "capture_unavailable", "system_interrupted", "irrelevant_answer"].includes(state) ? "Needs review" : state === "not_assessed" ? "Not assessed" : "Limited evidence"; };
  const answerIsMissing = (review: Data) => ["explicit_dont_know", "no_response", "capture_unavailable", "system_interrupted", "irrelevant_answer"].includes(answerState(review));
  const roundEntries = rounds.map((round, index) => ({
    round,
    index,
    label: roundRole(round.agent_type || round.track, round.interviewer_role),
    roundReviews: reviews.filter(review => String(review.agent_type || review.track || review.round || "").toLowerCase() === String(round.agent_type || round.track || "").toLowerCase()),
  }));
  const dimensionsWithScore = dimensions.filter(item => typeof item.percentage === "number");
  const proctorSubscores = Object.entries((proctor.sub_scores || proctor.subscores || {}) as Data);
  const priComponents = pri.components && typeof pri.components === "object" ? pri.components as Data : {};
  const interviewComponent = (priComponents.overall_performance || {}) as Data;
  const jobFitComponent = (priComponents.job_fit || {}) as Data;
  const priFormulaAvailable = typeof interviewComponent.weight === "number" && typeof interviewComponent.score === "number" && typeof jobFitComponent.weight === "number" && typeof jobFitComponent.score === "number";
  const advisoryFlags = [
    ...(claimGaps.length ? [`${claimGaps.length} resume skills not demonstrated`] : []),
    ...(dontKnowCount ? [`${dontKnowCount} answers marked “I don’t know”`] : []),
    ...(proctorViolations.length ? [`${proctorViolations.length} proctor violations to review`] : []),
  ];
  const strengthText = (item: unknown) => typeof item === "string" ? item.trim() : item && typeof item === "object" ? String((item as Data).text || (item as Data).label || (item as Data).summary || (item as Data).evidence || "").trim() : "";
  const savedStrengths = strengths.map(strengthText).filter(Boolean);
  const answerStrengths = reviews.flatMap(review => Array.isArray(review.strength_feedback) ? review.strength_feedback.map(strengthText) : []).filter(Boolean);
  const verifiedStrengths = resumeSkills.filter(item => item.evidence_level === "verified").map(item => `${show(item.skill, "Resume skill")} · verified in interview`);
  const strengthBriefs = [...new Set([...savedStrengths, ...answerStrengths, ...verifiedStrengths, ...observedStrengths(dimensions)])].slice(0, 3);
  const growthBriefs = growthAreas.map(item => typeof item === "string" ? item : show((item as Data).label || (item as Data).focus || (item as Data).summary || (item as Data).evidence || (item as Data).text));
  const followUpBriefs = nextRoundQuestions.map(item => typeof item === "string" ? item : show((item as Data).question || (item as Data).text || (item as Data).prompt));
  const candidateProfile = (bundle?.candidate_info || {}) as Data;
  const studentInitials = String(student.full_name || "Candidate").trim().split(/\s+/).slice(0, 2).map(part => part[0] || "").join("").toUpperCase();
  const readinessScore = comparable ? Number(pri.score) : null;
  const readinessLabel = report.readiness ? displayName(String(report.readiness)) : "—";
  const scoreWidth = (value: unknown) => `${Math.max(0, Math.min(100, typeof value === "number" ? value : 0))}%`;
  const competencyRows = dimensions.map(item => ({
    label: show(item.label || (item.dimension ? displayName(String(item.dimension)) : null), "—"),
    score: typeof item.percentage === "number" ? item.percentage : typeof item.score === "number" ? item.score : null,
    target: typeof item.role_target === "number" ? item.role_target : typeof item.target_score === "number" ? item.target_score : typeof item.rubric_target === "number" ? item.rubric_target : null,
    evidence: evidenceTopic(item.evidence_label || item.evidence || item.reason || item.rationale || item.summary),
  }));
  const evidenceHighlights = reviews.map((review, index) => {
    const turn = turns.find(item => review.turn_id != null && item.turn_id != null && String(item.turn_id) === String(review.turn_id))
      || turns.find(item => review.answer_id != null && item.answer_id != null && String(item.answer_id) === String(review.answer_id));
    const askedAt = turn?.asked_at || review.asked_at || review.answer_started_at;
    const offset = recordingOffset(askedAt);
    const questionScore = [review.score, review.percentage, review.question_score].find(value => typeof value === "number") as number | undefined;
    return {
      key: String(review.answer_id || review.turn_id || index),
      offset,
      timestamp: offset == null ? "—" : timeLabel(offset),
      question: highlightTopic(show(review.topic || review.question || review.question_text || turn?.question_text, "—")),
      score: questionScore == null ? "—" : `${questionScore}/100`,
    };
  }).filter(item => item.offset != null).sort((a, b) => a.offset! - b.offset!).slice(0, 3);

  return (
    <section className="candidate-review mx-auto max-w-[1440px] space-y-5 pb-12 text-slate-900">
      <ReportKeyboardShortcuts videoRef={videoRef} onNextFlag={() => jumpToAdjacentFlag(1)} />
      <style>{`
        @media (min-width: 1280px) {
          .candidate-review { gap: 0; }
          .candidate-review #glance { padding: 14px; }
          .candidate-review #glance { scroll-margin-top: 76px; }
          .candidate-review #glance > * + * { margin-top: 8px; }
          .candidate-review #glance > article { padding: 8px 14px; }
          .candidate-review #glance .report-candidate-header > article { padding: 12px; min-height: 144px; }
          .candidate-review #glance .report-candidate-header h1 { font-size: 26px; }
          .candidate-review #glance .report-candidate-header dl { margin-top: 6px; line-height: 16px; }
          .candidate-review #glance .report-candidate-header dl > * + * { margin-top: 0; }
          .candidate-review #glance .report-candidate-header img, .candidate-review #glance .report-candidate-header [aria-label$="initials"] { height: 112px; width: 88px; }
          .candidate-review #glance h2 { font-size: 19px; line-height: 24px; font-weight: 800; }
          .candidate-review #glance table { table-layout: fixed; }
          .candidate-review #glance th, .candidate-review #glance td { padding: 5px 12px; font-size: 13px; line-height: 20px; }
          .candidate-review #glance > section table th:nth-child(1) { width: 24%; }
          .candidate-review #glance > section table th:nth-child(2) { width: 27%; }
          .candidate-review #glance > section table th:nth-child(3) { width: 13%; }
          .candidate-review #glance > div > article, .candidate-review #glance > div > section { padding: 8px 12px; }
          .candidate-review #glance > div > article > div > span { width: 26px; height: 26px; }
          .candidate-review #glance > div > article ul { margin-top: 4px; }
          .candidate-review #glance > div > article ul > * + * { margin-top: 0; }
          .candidate-review #glance > div > section > div { margin-top: 8px; }
          .candidate-review #glance > div > section table { min-width: 0; }
          .candidate-review #glance > div > section table th, .candidate-review #glance > div > section table td { padding-top: 3px; padding-bottom: 3px; }
          .candidate-review #glance > div > section table th:first-child { width: 22%; }
          .candidate-review #glance > div > section table th:last-child { width: 16%; }
        }
      `}</style>
      <style>{".candidate-review .text-indigo-700{color:#146fc7!important}.candidate-review .bg-indigo-600{background-color:#1e7be6!important}.candidate-review .border-indigo-600{border-color:#1e7be6!important}.candidate-review .border-indigo-300{border-color:#7cc4f5!important}.candidate-review .focus\\:border-violet-400:focus{border-color:#38a7e8!important}.candidate-report-content>section>div:first-child h2{color:#092653;font-weight:800}.candidate-review aside>article,.candidate-review aside form{border-color:#e0f2fe;border-radius:1rem}@media print{.report-nav,.report-back,.report-actions,.candidate-pager,.no-print{display:none!important}.candidate-report-content .hidden{display:block!important}details:not([open])>*:not(summary){display:block!important}article,details{break-inside:avoid}body{color:#111!important;background:#fff!important}}"}</style>
      <div className="candidate-pager no-print flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex min-w-0 items-center gap-2 text-sm text-slate-500">
          <button type="button" className="report-back inline-flex items-center gap-1.5 font-semibold text-slate-700 hover:text-indigo-700" onClick={onBack}><ArrowLeft size={15}/> Interview results</button>
          <span>/</span><span className="truncate">{show(drive?.company_name, "Placement drive")} · {show(drive?.role_title, "Role")}</span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button type="button" className={`${btn} shrink-0 px-2.5 py-1.5`} disabled={!canPrevious} aria-label="Previous candidate" onClick={() => onNavigate?.(-1)}><ChevronLeft size={15}/></button>
          <span className="min-w-16 shrink-0 text-center text-xs font-semibold text-slate-600">{candidatePosition ?? "—"} of {candidateTotal ?? "—"}</span>
          <button type="button" className={`${btn} shrink-0 px-2.5 py-1.5`} disabled={!canNext} aria-label="Next candidate" onClick={() => onNavigate?.(1)}><ChevronRight size={15}/></button>
          <button type="button" aria-label="Export PDF" title="Export PDF" className={`${btn} report-actions inline-flex h-10 min-w-[102px] shrink-0 items-center justify-center gap-2 whitespace-nowrap px-3 py-1 text-xs`} onClick={() => window.print()}><Download className="shrink-0" size={14}/><span className="whitespace-nowrap">Export PDF</span></button>
        </div>
      </div>

      {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}<button className={`${btn} inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap`} onClick={() => void load()}>Retry report</button></div>}
      {notice && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{notice}</p>}

      <section id="glance" className="scroll-mt-4 space-y-3.5 rounded-[1.75rem] border border-sky-100 bg-white p-4 shadow-[0_18px_55px_rgba(15,42,82,0.08)] sm:p-5">
        <header className="report-candidate-header grid items-stretch gap-3 xl:grid-cols-[minmax(30rem,2.7fr)_repeat(3,minmax(9rem,1fr))]">
          <article className="min-w-0 rounded-2xl border border-sky-100 bg-white p-4">
            <div className="flex min-w-0 gap-4">
              {candidatePhoto.studentId === studentId && candidatePhoto.url ? <img src={candidatePhoto.url} alt={`${show(student.full_name, "Candidate")} profile`} className="h-[118px] w-[104px] shrink-0 rounded-xl border border-slate-100 object-cover object-top shadow-sm"/> : <div aria-label={`${show(student.full_name, "Candidate")} initials`} className="grid h-[118px] w-[104px] shrink-0 place-items-center rounded-xl bg-[#123765] text-2xl font-extrabold tracking-wide text-white shadow-sm">{studentInitials || "C"}</div>}
              <div className="min-w-0 flex-1">
                <h1 className="text-[1.75rem] font-extrabold leading-none tracking-[-0.035em] text-[#092653]">{show(student.full_name, "Candidate")}</h1>
                <p className="mt-1.5 text-[13px] font-medium leading-5 text-slate-600">{[student.program, student.department_code, (student.graduation_year ?? candidateProfile.graduation_year) ? `Class of ${String(student.graduation_year ?? candidateProfile.graduation_year)}` : null].filter(Boolean).join(" · ") || "—"}</p>
                <dl className="mt-2.5 space-y-0.5 text-[13px] leading-[1.15rem] text-slate-600">
                  <div className="min-w-0"><dt className="inline font-bold text-[#0b2b59]">Target Role: </dt><dd className="inline">{show(drive?.role_title, "—")}</dd></div>
                  <div className="min-w-0"><dt className="inline font-bold text-[#0b2b59]">Scorecard ID: </dt><dd className="inline break-all">{show(report.session_id, "—")}</dd></div>
                  <div className="min-w-0"><dt className="inline font-bold text-[#0b2b59]">Assessment Date: </dt><dd className="inline">{report.completed_at ? stamp(report.completed_at) : "—"}</dd></div>
                  <div className="min-w-0"><dt className="inline font-bold text-[#0b2b59]">Interview: </dt><dd className="inline">{recordingDuration == null ? "—" : durationLabel(recordingDuration)} · {reviews.length} questions</dd></div>
                </dl>
                {driveError && <p role="alert" className="mt-1 text-xs text-rose-700">Drive details: {driveError} <button className="underline" onClick={() => void load()}>Retry</button></p>}
              </div>
            </div>
          </article>
          <article className="flex min-h-[152px] flex-col rounded-2xl border border-sky-100 bg-[#eef8ff] p-4">
            <p className="text-[13px] font-bold text-[#0b2b59]">Overall Score</p>
            <p className="mt-3 flex items-baseline gap-1 tabular-nums text-[#0b2b59]"><span className="text-[32px] font-extrabold leading-none">{report.overall_score == null ? "—" : report.overall_score}</span>{report.overall_score != null && <span className="text-sm font-semibold">/100</span>}</p>
            <div className="mt-auto pt-4"><div className="h-2 w-full overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-[#1e7be6]" style={{ width: scoreWidth(report.overall_score) }}/></div></div>
          </article>
          <article className="flex min-h-[152px] flex-col rounded-2xl border border-amber-100 bg-[#fff8e8] p-4">
            <p className="text-[13px] font-bold text-[#0b2b59]">Readiness</p>
            <p className="mt-3 flex items-baseline gap-1 tabular-nums text-[#0b2b59]"><span className="text-[32px] font-extrabold leading-none">{readinessScore == null ? "—" : readinessScore}</span>{readinessScore != null && <span className="text-sm font-semibold">/100</span>}</p>
            <span className="mt-2 self-start rounded-full bg-amber-200/80 px-2.5 py-0.5 text-xs font-bold text-amber-800">{readinessLabel}</span>
            <div className="mt-auto pt-3"><div className="h-2 w-full overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-amber-400" style={{ width: scoreWidth(readinessScore) }}/></div></div>
          </article>
          <article className="flex min-h-[152px] flex-col items-center rounded-2xl border border-teal-100 bg-[#eafaf8] p-4 text-center">
            <p className="text-[13px] font-bold text-[#0b2b59]">Assessment Scope</p>
            <p className="mt-3 text-[32px] font-extrabold leading-none text-[#0b2b59]">{competencyRows.length}</p>
            <p className="mt-1 text-[13px] font-medium text-[#0b2b59]">Competencies</p>
            <div className="mt-auto flex h-8 items-end gap-1" aria-hidden="true"><span className="h-2.5 w-2 rounded-sm bg-teal-300"/><span className="h-5 w-2 rounded-sm bg-teal-400"/><span className="h-8 w-2 rounded-sm bg-teal-600"/></div>
          </article>
        </header>

        <article className="flex items-center gap-4 rounded-2xl border border-sky-100 bg-[#eaf6fd] p-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-sky-200/70 text-[#0b4d86]"><FileText aria-hidden="true" size={25} strokeWidth={2.4}/></span>
          <div className="min-w-0 border-l border-sky-300 pl-4"><h2 className="text-[20px] font-extrabold leading-tight text-[#092653]">Executive Assessment Summary</h2><p className="mt-1 text-sm leading-5 text-slate-700">{show(executiveSummary, "—")}</p></div>
        </article>

        <section>
          <div className="mb-2 flex flex-wrap items-end justify-between gap-2"><h2 className="text-[20px] font-extrabold text-[#092653]">Competency Results</h2><span className="text-xs text-slate-500">Saved assessment evidence</span></div>
          <div className="overflow-x-auto rounded-2xl border border-sky-100">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-[#e7f4fc] text-[#092653]"><tr><th className="px-4 py-3 font-extrabold">Competency</th><th className="px-4 py-3 font-extrabold">Score</th><th className="px-4 py-3 font-extrabold">Role Target</th><th className="px-4 py-3 font-extrabold">Evidence</th></tr></thead>
              <tbody>{competencyRows.length ? competencyRows.map((item, index) => <tr key={`${item.label}-${index}`} className="border-t border-sky-100">
                <th className="px-4 py-2.5 font-bold text-[#0b2b59]"><span className="flex items-center gap-2.5"><CompetencyIcon label={item.label} index={index}/><span>{item.label}</span></span></th>
                <td className="px-4 py-2.5"><div className="flex items-center gap-3"><strong className="w-14 tabular-nums" style={{ color: competencyColors[index % competencyColors.length] }}>{item.score == null ? "—" : `${item.score}/100`}</strong><div className="h-2 min-w-24 flex-1 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full" style={{ width: scoreWidth(item.score), backgroundColor: competencyColors[index % competencyColors.length] }}/></div></div></td>
                <td className="px-4 py-3 text-slate-700">{item.target == null ? "—" : `${item.target}/100`}</td>
                <td className="max-w-[28rem] px-4 py-2.5 text-[13px] leading-5 text-slate-600">{item.evidence}</td>
              </tr>) : <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-500">No competency results are available in this report.</td></tr>}</tbody>
            </table>
          </div>
        </section>

        <div className="grid gap-4 md:grid-cols-2">
          <article className="rounded-2xl border border-teal-100 bg-[#eafaf6] p-4"><div className="flex items-center gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-teal-100 text-teal-700"><Trophy aria-hidden="true" size={21}/></span><h2 className="text-lg font-extrabold text-[#092653]">Demonstrated Strengths</h2></div>{strengthBriefs.length ? <ul className="mt-3 space-y-1.5">{strengthBriefs.map((item, index) => <li key={index} className="flex gap-3 text-sm leading-5 text-slate-700"><span aria-hidden="true" className="mt-1.5 grid h-2.5 w-2.5 shrink-0 place-items-center rounded-full bg-teal-600 text-[7px] font-bold leading-none text-white">✓</span><span>{item}</span></li>)}</ul> : <p className="mt-3 text-sm text-slate-500">No strengths are available in this report.</p>}</article>
          <article className="rounded-2xl border border-amber-100 bg-[#fff8e8] p-4"><div className="flex items-center gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-amber-100 text-rose-600"><Target aria-hidden="true" size={21}/></span><h2 className="text-lg font-extrabold text-[#092653]">Areas to Explore</h2></div>{growthBriefs.length ? <ul className="mt-3 space-y-1.5">{growthBriefs.map((item, index) => <li key={index} className="flex gap-3 text-sm leading-5 text-slate-700"><span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-amber-500"/><span>{item}</span></li>)}</ul> : <p className="mt-3 text-sm text-slate-500">No areas to explore are available in this report.</p>}</article>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-2xl border border-sky-100 bg-white p-4">
            <h2 className="text-lg font-extrabold text-[#092653]">Interview Evidence Highlights</h2>
            <div className="mt-3 overflow-x-auto rounded-xl border border-sky-100">
              <table className="w-full min-w-[500px] text-left text-sm">
                <thead className="bg-[#e7f4fc] text-[#092653]"><tr><th className="px-3 py-2 font-bold">Timestamp</th><th className="px-3 py-2 font-bold">Question / Topic</th><th className="px-3 py-2 font-bold">Score</th></tr></thead>
                <tbody>{evidenceHighlights.length ? evidenceHighlights.map(item => <tr key={item.key} className="border-t border-sky-100">
                  <td className="whitespace-nowrap px-3 py-2 text-slate-600">{item.offset == null ? "—" : <button type="button" disabled={!videoReady} aria-label={`Play interview at ${item.timestamp}`} className="font-semibold text-blue-700 underline decoration-blue-200 underline-offset-2 hover:decoration-blue-700 disabled:cursor-not-allowed disabled:text-slate-400" onClick={() => seekToOffset(item.offset!)}>{item.timestamp}</button>}</td>
                  <td className="px-3 py-2 text-slate-700"><p className="line-clamp-2 leading-4" title={item.question}>{item.question}</p></td>
                  <td className="whitespace-nowrap px-3 py-2 font-bold text-[#0b2b59]">{item.score}</td>
                </tr>) : <tr><td colSpan={3} className="px-3 py-6 text-center text-slate-500">No timestamped question evidence is available.</td></tr>}</tbody>
              </table>
            </div>
          </section>
          <section className="rounded-2xl border border-sky-100 bg-white p-4"><h2 className="text-lg font-extrabold text-[#092653]">Recommended Employer Follow-Up</h2>{followUpBriefs.length ? <ol className="mt-4 space-y-3">{followUpBriefs.map((item, index) => <li key={index} className="flex items-start gap-3 text-sm leading-6 text-slate-700"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#147fdf] text-xs font-extrabold text-white">{index + 1}</span><span>{item}</span></li>)}</ol> : <p className="mt-3 text-sm text-slate-500">No employer follow-up is available in this report.</p>}</section>
        </div>
      </section>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <main className="candidate-report-content min-w-0 space-y-5">
          <section id="recording" className={`${reportPanel} scroll-mt-4`}>
            <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Evidence</p><h2 className="mt-1 text-lg font-bold">Interview recording</h2><p className="mt-1 text-xs text-slate-500">{recordingStatus === "ready" ? `Secure recording · ${durationLabel(recordingDuration)}${recording?.started_at || report.recording?.started_at ? ` · ${stamp(recording?.started_at ?? report.recording?.started_at)}` : ""}` : recordingStatus === "expired" ? "Recording retention period ended" : recordingStatus === "failed" ? "Video upload failed" : recordingStatus === "unavailable" || recordingStatus === "not_configured" ? "No recording is available for this attempt" : `Recording ${displayName(show(recordingStatus))}`}</p></div><details className="text-xs text-slate-500"><summary className="cursor-pointer">Session details</summary><p className="mt-1 break-all">{report.session_id || "Session ID unavailable"}</p></details></div>
            {!videoReady ? <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4"><div><p className="text-sm text-slate-700">{recordingLoading ? "Checking recording availability…" : recordingStatus === "processing" || recordingStatus === "recording" ? "Recording is being prepared" : "Video is unavailable for this attempt"}</p><p className="mt-1 text-xs text-slate-500">{show(recording?.message, "The saved answers and feedback remain available.")}</p>{recordingError && <p role="alert" className="mt-2 text-xs text-rose-700">{recordingError}</p>}</div>{report.session_id && recordingStatus !== "expired" && <button type="button" className={`${btn} inline-flex items-center gap-2 whitespace-nowrap`} disabled={recordingLoading} onClick={() => void loadRecording()}>Refresh recording</button>}</div> : <>
            <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(15rem,1fr)]">
              <div className="min-w-0">
                <div className={`relative overflow-hidden rounded-xl ${videoReady ? "aspect-video bg-slate-950 text-white" : "min-h-36 border border-slate-200 bg-slate-50 text-slate-700"}`}>
                  {videoReady ? <video ref={videoRef} className="h-full w-full object-contain" src={recording.playback_url as string} controls playsInline preload="metadata" onError={recoverPlayback} aria-label="Interview recording" onTimeUpdate={event => setPlaybackTime(event.currentTarget.currentTime)} onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} /> : <div className="absolute inset-0 grid place-items-center px-5 text-center"><div><p className="text-sm font-semibold">{recordingLoading ? "Loading private recording…" : recordingStatus === "expired" ? "Recording is no longer available" : recordingStatus === "failed" ? "Recording could not be saved" : "No recording is available"}</p><p className="mt-1 text-xs text-slate-500">{recordingStatus === "expired" || recordingStatus === "failed" ? "Transcript and assessment evidence remain available below." : recordingLoading ? "Requesting secure playback." : "Review the saved answers and assessment below."}</p></div></div>}
                  {videoReady && <button type="button" disabled={!videoReady} title={videoReady ? (isPlaying ? "Pause interview video" : "Play interview video") : "Video unavailable for this candidate"} aria-label={videoReady ? (isPlaying ? "Pause interview video" : "Play interview video") : "Video unavailable for this candidate"} className={`absolute inset-0 m-auto grid h-14 w-14 place-items-center rounded-full bg-white/90 text-xl text-slate-900 shadow transition disabled:cursor-not-allowed disabled:opacity-60 ${isPlaying ? "pointer-events-none opacity-0" : "hover:bg-white"}`} onClick={() => { if (!videoRef.current) return; if (videoRef.current.paused) void videoRef.current.play(); else videoRef.current.pause(); }}>{isPlaying ? "Ⅱ" : "▶"}</button>}
                  {videoReady && <span className="absolute left-3 top-3 rounded-md bg-black/60 px-2 py-1 text-[10px] font-semibold">Interview recording</span>}
                </div>
                {recordingError && <p role="alert" className="mt-2 text-xs text-rose-700">Recording error: {recordingError}<button className="ml-2 underline" onClick={() => void loadRecording()}>Retry</button></p>}
                {!videoReady && report.recording?.status === "ready" && <button type="button" className={`${btn} mt-2`} disabled={recordingLoading} onClick={() => { setRecordingError(""); void loadRecording(); }}>{recordingLoading ? "Loading recording…" : "Retry secure recording"}</button>}
                <div className="no-print mt-3 flex flex-wrap items-center gap-2">
                  <button type="button" className={`${btn} h-[34px] w-[34px] justify-center p-0`} aria-label={isPlaying ? "Pause" : "Play"} title={isPlaying ? "Pause" : "Play"} disabled={!videoReady} onClick={() => { if (!videoRef.current) return; if (videoRef.current.paused) void videoRef.current.play(); else videoRef.current.pause(); }}>{isPlaying ? "Ⅱ" : "▶"}</button>
                  <button type="button" className={`${btn} h-[34px] w-[34px] justify-center p-0`} aria-label="Back 10 seconds" title="Back 10 seconds" disabled={!videoReady} onClick={() => { if (videoRef.current) videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 10); }}>↺</button>
                  <button type="button" className={`${btn} h-[34px] w-[34px] justify-center p-0`} aria-label="Forward 10 seconds" title="Forward 10 seconds" disabled={!videoReady} onClick={() => { if (videoRef.current) videoRef.current.currentTime = Math.min(videoRef.current.duration || Infinity, videoRef.current.currentTime + 10); }}>↻</button>
                  <span className="text-xs font-semibold tabular-nums text-slate-500">{timeLabel(playbackTime)} / {timeLabel(Number(recording?.duration_seconds ?? recordingDuration ?? 0))}</span>
                  <span className="flex-1"/>
                  <button type="button" className={`${btn} inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap`} disabled={!videoReady || !events.length} onClick={() => jumpToAdjacentFlag(-1)}>‹ Flag</button>
                  <button type="button" className={`${btn} inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap`} disabled={!videoReady || !events.length} onClick={() => jumpToAdjacentFlag(1)}>Flag ›</button>
                  <select aria-label="Playback speed" className="h-[34px] rounded-lg border border-slate-300 bg-white px-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50" value={playbackRate} disabled={!videoReady} onChange={event => { const rate = Number(event.target.value); setPlaybackRate(rate); if (videoRef.current) videoRef.current.playbackRate = rate; }}><option value={1}>1×</option><option value={1.5}>1.5×</option><option value={2}>2×</option><option value={4}>4×</option></select>
                </div>
                <div className="relative mt-4 pt-3">
                  <div className="flex items-center justify-between text-[10px] font-semibold text-slate-500"><span>Recording timeline</span><span>{recordingDuration != null ? timeLabel(Number(recordingDuration)) : "Not available"}</span></div>
                  {videoReady && Number(recording?.segment_count || 0) <= 1 && Number(recording?.duration_seconds || 0) > 0 ? <><div className="relative mt-1 h-7 rounded-lg bg-slate-100" role="group" aria-label="Recording timeline"><div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 bg-slate-300"/>{turns.map((turn, index) => { const offset = recordingOffset(turn.asked_at); if (offset == null) return null; const left = Math.min(100, Math.max(0, offset / Number(recording.duration_seconds) * 100)); return <button key={String(turn.turn_id || index)} type="button" disabled={!videoReady} className="absolute top-1/2 z-10 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-sm border border-white bg-indigo-600 disabled:cursor-not-allowed" style={{ left: `${left}%` }} title={show(turn.question_text, `Question ${index + 1}`)} aria-label={`Jump to interview question ${index + 1}`} onClick={() => seekToQuestion(turn.asked_at)}/>; })}{events.map((event, index) => { const offset = recordingOffset(event.occurred_at || event.created_at); if (offset == null) return null; const left = Math.min(100, Math.max(0, offset / Number(recording.duration_seconds) * 100)); return <button key={String(event.event_id || index)} type="button" disabled={!videoReady} className="absolute top-1/2 z-20 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-amber-600 disabled:cursor-not-allowed" style={{ left: `${left}%` }} title={`${displayName(show(event.event_type || event.type))} · ${stamp(event.occurred_at || event.created_at)}`} aria-label={`Jump to proctor bookmark ${index + 1}`} onClick={() => { setActiveEvent(index); seekToEvent(event); }}/>; })}{bookmarkNotes.map(item => <button key={item.id} type="button" disabled={!videoReady} className="absolute top-1/2 z-30 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rotate-45 border-2 border-white bg-slate-700 disabled:cursor-not-allowed" style={{ left: `${Math.min(100, item.seconds / Number(recording.duration_seconds) * 100)}%` }} title={`My note · ${timeLabel(item.seconds)} · ${item.text}`} aria-label={`My note at ${timeLabel(item.seconds)}`} onClick={() => { seekToOffset(item.seconds); }}/>)}</div><div className="mt-1 flex justify-between text-[10px] text-slate-500"><span>0:00</span><span>{timeLabel(Number(recording.duration_seconds))}</span></div></> : <div className="mt-1 flex h-7 items-center rounded-lg bg-slate-100 px-3 text-[10px] text-slate-500">{Number(recording?.segment_count || 0) > 1 ? "Timeline alignment unavailable for combined recording segments." : "No recording timeline is available for this attempt."}</div>}
                  <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-slate-500"><span><i className="mr-1 inline-block h-2 w-2 rounded-sm bg-indigo-600"/>Question</span><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-amber-600"/>AI Proctor flag</span><span><i className="mr-1 inline-block h-2 w-2 rotate-45 bg-slate-700"/>My note</span></div>
                </div>
                {videoReady && Number(recording?.segment_count || 0) > 1 && <p className="mt-3 text-xs text-slate-500">This recording combines multiple capture segments, so wall-clock timeline markers cannot be aligned reliably.</p>}

              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap gap-1 border-b border-slate-200 pb-2" role="tablist" aria-label="Recording bookmarks">{[["all", "All"], ["question", "Questions"], ["proctor", "AI Proctor"], ["note", "My notes"]].map(([value, label]) => <button key={value} type="button" role="tab" aria-selected={bookmarkFilter === value} className={`rounded-md px-2.5 py-1.5 text-xs font-semibold ${bookmarkFilter === value ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-100"}`} onClick={() => setBookmarkFilter(value)}>{label}</button>)}</div>
                <div id="evidence" className="mt-2 max-h-[28rem] space-y-1 overflow-auto pr-1">{visibleBookmarks.length ? visibleBookmarks.map(item => {
                  if (item.questionIndex != null) {
                    const index = item.questionIndex, review = reviews[index], turnId = String(review?.turn_id || ""), persistedTurn = turns.find(turn => String(turn.turn_id) === turnId), responseText = String((persistedTurn ? persistedTurn.transcript : review?.answer || review?.transcript) || ""), responseReview = persistedTurn && !responseText.trim() ? { ...review, answer_state: "no_response", evidence_status: "no_response" } : review, state = answerState(responseReview), feedbackMatchesResponse = !persistedTurn || responseText.trim() === String(review?.answer || review?.transcript || "").trim(), feedbackItems = [...(Array.isArray(review?.strength_feedback) ? review.strength_feedback : []), ...(Array.isArray(review?.improvement_feedback) ? review.improvement_feedback : [])], answerTimestamp = persistedTurn?.answer_started_at || persistedTurn?.asked_at || review?.answer_started_at || review?.asked_at;
                    return <details id={`answer-${index}`} key={item.id} className="group rounded-md border border-slate-200 bg-white open:border-indigo-300 open:shadow-sm"><summary className="flex cursor-pointer list-none items-start gap-2 p-2 text-left text-xs hover:bg-slate-50" onClick={() => { if (item.seconds != null) seekToOffset(item.seconds); }}><span className="min-w-10 font-bold tabular-nums text-slate-700">{item.seconds == null ? "—" : timeLabel(item.seconds)}</span><span className="min-w-0 flex-1"><strong className="block font-semibold leading-5">{item.text}</strong><span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${answerIsMissing(responseReview) ? "bg-rose-50 text-rose-800" : state === "answered" ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>{answerLabel(responseReview)}</span></span><ChevronDown size={14} className="mt-1 shrink-0 text-slate-400 transition group-open:rotate-180"/></summary><div className="border-t border-slate-100 p-3"><p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Saved candidate transcript</p><p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-slate-700">{show(responseText, "No response text was captured.")}</p>{Boolean(persistedTurn?.transcript_review_note) && <p className="mt-2 text-xs text-amber-800">{String(persistedTurn?.transcript_review_note)}</p>}{!feedbackMatchesResponse && <p className="mt-2 text-xs text-amber-800">The saved response differs from the evaluated version. Feedback needs a fresh evaluation.</p>}{feedbackMatchesResponse && feedbackItems.length > 0 && <div className="mt-3 space-y-2">{Array.isArray(review?.strength_feedback) && review.strength_feedback.length > 0 && <div className="rounded-md bg-emerald-50 p-2 text-xs text-emerald-900"><strong>Strengths noted</strong><ul className="mt-1 list-disc pl-4">{review.strength_feedback.map((feedback, feedbackIndex) => <li key={feedbackIndex}>{show(feedback)}</li>)}</ul></div>}{Array.isArray(review?.improvement_feedback) && review.improvement_feedback.length > 0 && <div className="rounded-md bg-amber-50 p-2 text-xs text-amber-950"><strong>Improvement feedback</strong><ul className="mt-1 list-disc pl-4">{review.improvement_feedback.map((feedback, feedbackIndex) => <li key={feedbackIndex}>{show(feedback)}</li>)}</ul></div>}</div>}{answerTimestamp != null && videoReady && recordingOffset(answerTimestamp) != null && <button type="button" className={`${btn} mt-3 px-2 py-1 text-xs`} onClick={() => seekToQuestion(answerTimestamp)}>Play this answer</button>}{turnId && report.session_id && (persistedTurn?.has_audio ?? review?.has_audio) !== false && responseText.trim() && <Audio path={`students/${studentId}/reports/${report.session_id}/turns/${turnId}/audio`}/>}<p className="mt-3 border-t border-slate-100 pt-2 text-[10px] text-slate-500">Words: <strong>{responseText.trim().split(/\s+/).filter(Boolean).length}</strong></p></div></details>;
                  }
                  return <button key={item.id} type="button" className="flex w-full items-start gap-2 rounded-md border border-slate-200 p-2 text-left text-xs hover:bg-slate-50" onClick={() => { if (item.event) { setActiveEvent(events.indexOf(item.event)); seekToEvent(item.event); } else if (item.seconds != null) seekToOffset(item.seconds); }}><span className="min-w-10 font-bold tabular-nums text-slate-700">{item.seconds == null ? "—" : timeLabel(item.seconds)}</span><span className="min-w-0"><strong className="block">{item.text}</strong>{"detail" in item && <span className="mt-0.5 block text-slate-500">{item.detail}</span>}{"saved" in item && !item.saved && <span className="mt-0.5 block text-indigo-700">Draft · not saved</span>}</span></button>;
                }) : <p className="py-3 text-xs text-slate-500">{bookmarkFilter === "note" ? "No timestamped notes have been added." : bookmarkFilter === "proctor" ? "No proctor bookmarks are available." : "No recording bookmarks are available."}</p>}</div>
                <form className="mt-3 rounded-lg border border-slate-200 p-3" onSubmit={event => { event.preventDefault(); addBookmarkNote(); }}><label htmlFor="bookmark-note" className="text-xs font-semibold">Add note at current time</label><div className="mt-2 flex gap-2"><input id="bookmark-note" className="min-w-0 flex-1 rounded-md border border-slate-300 px-2 py-1.5 text-xs" maxLength={120} placeholder={videoReady ? "Add a review note…" : "Load recording to timestamp a note"} value={bookmarkNote} onChange={event => setBookmarkNote(event.target.value)} disabled={!videoReady}/><button type="submit" className={`${btn} px-2 py-1 text-xs`} disabled={!videoReady || !bookmarkNote.trim()}>Add</button></div><p className="mt-1 text-[10px] leading-4 text-slate-500">Notes are draft-only until copied into the officer note and saved with a decision.</p><p className="mt-2 text-[10px] text-slate-400"><kbd>Space</kbd> play · <kbd>←</kbd>/<kbd>→</kbd> seek · <kbd>N</kbd> next flag · <kbd>B</kbd> note</p></form>
              </div>
            </div>
            </>}
          </section>

          <section id="deep-dive" className={`${reportPanel} scroll-mt-4 p-0`}>
            <div className="border-b border-slate-200 px-4 pt-4 sm:px-5"><p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Assessment details</p><h2 className="mt-1 text-lg font-bold">Interview deep dive</h2><nav className="report-nav mt-3 flex flex-wrap gap-1" role="tablist" aria-label="Candidate report sections">{nav.map(([item, label]) => <button key={item} type="button" role="tab" aria-selected={activeTab === item} className={`whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-semibold ${activeTab === item ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500 hover:text-slate-800"}`} onClick={() => setActiveTab(item)}>{label}{item === "skills" && <span className="ml-1.5 text-xs text-slate-400">{claimGaps.length} gaps</span>}{item === "rounds" && rounds.length > 0 && <span className="ml-1.5 text-xs text-slate-400">{rounds.length}</span>}{item === "proctor" && events.length > 0 && <span className="ml-1.5 text-xs text-slate-400">{events.length}</span>}</button>)}</nav></div>
            <div className="report-tab-content p-4 sm:p-5" role="tabpanel" aria-label={nav.find(([key])=>key===activeTab)?.[1]}>

              {activeTab === "skills" && <section id="role-fit" className="space-y-4">
                <div><h3 className="text-base font-bold">Skills proof</h3><p className="mt-1 text-xs text-slate-500">Resume claims are compared with evidence recorded in the interview.</p></div>
                <div className="grid gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-3"><div><p className="text-xs text-slate-500">Job fit</p><strong className="text-xl">{typeof jobFit.score === "number" ? `${jobFit.score}/100` : "Not assessed"}</strong><p className="text-[10px] text-slate-500">Role requirements vs interview evidence</p></div><div className="border-slate-200 sm:border-l sm:pl-3"><p className="text-xs text-slate-500">Resume credibility</p><strong className="text-xl">{resumeAlignment.credibility_score == null ? "—" : `${String(resumeAlignment.credibility_score)}/100`}</strong><p className="text-[10px] text-slate-500">Based on assessed resume claims</p></div><div className="border-slate-200 sm:border-l sm:pl-3"><p className="text-xs text-slate-500">Claims verified</p><strong className="text-xl">{testedResumeSkills.length ? `${verifiedResumeSkills.length}/${testedResumeSkills.length}` : "—"}</strong><p className="text-[10px] text-slate-500">{claimGaps.length} not demonstrated · {notTestedResumeSkills.length} not tested</p></div></div>
                {claimGaps.length > 0 && <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-slate-700"><strong className="text-amber-900">Resume claims not demonstrated:</strong> {claimGaps.map(item => String(item.skill || "")).filter(Boolean).join(", ")}. Check the cited interview evidence before deciding.</div>}
                <div className="flex flex-wrap gap-1" role="group" aria-label="Filter resume claim evidence">{[["all", `All (${resumeSkills.length})`], ["gaps", `Claim gaps (${claimGaps.length})`], ["verified", `Verified (${verifiedResumeSkills.length})`], ["not_tested", `Not tested (${notTestedResumeSkills.length})`]].map(([value, label]) => <button key={value} type="button" aria-pressed={resumeSkillFilter === value} className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${resumeSkillFilter === value ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 text-slate-600"}`} onClick={() => setResumeSkillFilter(value)}>{label}</button>)}</div>
                <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="w-full min-w-[620px] text-left text-sm"><thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500"><tr><th className="p-3">Skill / claim</th><th className="p-3">Resume says</th><th className="p-3">Interview showed</th><th className="p-3">Evidence</th></tr></thead><tbody>{filteredResumeSkills.length ? filteredResumeSkills.map((item, index) => { const level = String(item.evidence_level || "not_assessed").toLowerCase(); const matchingRequirements = requirements.filter(requirement => String(requirement.requirement || "").trim().toLowerCase() === String(item.skill || "").trim().toLowerCase()); const answerIds = matchingRequirements.flatMap(requirement => Array.isArray(requirement.answer_ids) ? requirement.answer_ids : []); const questionReviews = reviews.filter(review => answerIds.includes(review.answer_id)); const verdict = level === "verified" ? "Verified" : level === "weak" ? "Partial" : level === "not_demonstrated" ? "Not shown" : "Not tested"; return <tr key={String(item.claim_id || item.skill || index)} className={`border-t border-slate-100 align-top ${level === "not_demonstrated" ? "bg-rose-50/40" : ""}`}><th className="p-3 font-semibold">{show(item.skill, `Skill ${index + 1}`)}</th><td className="p-3 text-slate-600">Listed on resume</td><td className="p-3"><span className="font-semibold">{verdict}</span></td><td className="max-w-sm p-3 text-xs text-slate-600">{show(item.note, "No interview evidence note was included.")}{questionReviews.length > 0 && <div className="mt-1">{questionReviews.map((review, i) => <button key={i} type="button" className="mr-2 font-semibold text-indigo-700 underline" onClick={() => { openAnswer(reviews.indexOf(review)); }}>Q{reviews.indexOf(review) + 1}</button>)}</div>}</td></tr>; }) : <tr><td colSpan={4} className="p-5 text-center text-sm text-slate-500">{resumeSkills.length ? "No resume claims match this filter." : "Resume claim analysis is not available for this report."}</td></tr>}</tbody></table></div>
                <details className="rounded-lg border border-slate-200 p-3"><summary className="cursor-pointer text-sm font-semibold">Role requirements evidence · {requirements.length}</summary><div className="mt-3 space-y-3"><div className="flex flex-wrap gap-1" aria-label="Filter role requirement evidence">{[["all", "All"], ["gaps", "Asked · no evidence"], ["demonstrated", "Evidence found"], ["not_asked", "Not asked"]].map(([value, label]) => <button key={value} type="button" aria-pressed={skillFilter === value} className={`rounded-full border px-3 py-1 text-xs font-semibold ${skillFilter === value ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 text-slate-600"}`} onClick={() => setSkillFilter(value)}>{label}</button>)}</div><div className="overflow-x-auto rounded-lg border border-slate-200"><table className="w-full min-w-[620px] text-left text-sm"><thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500"><tr><th className="p-3">Requirement</th><th className="p-3">Status</th><th className="p-3">Evidence strength</th><th className="p-3">Questions</th></tr></thead><tbody>{filteredRequirements.length ? filteredRequirements.map((item, index) => { const linkedReviews = reviews.filter(review => (Array.isArray(item.answer_ids) ? item.answer_ids : []).includes(review.answer_id)); return <tr key={String(item.requirement_id || index)} className="border-t border-slate-100 align-top"><th className="p-3 font-semibold">{show(item.requirement, `Requirement ${index + 1}`)}{item.critical === true && <span className="ml-2 text-[10px] font-normal text-slate-500">Critical</span>}</th><td className="p-3 text-xs">{item.candidate_mentioned === true ? "Evidence found" : item.requirement_was_asked === true ? "Asked · no evidence" : "Not asked"}</td><td className="p-3 text-xs">{displayName(show(item.evidence_strength || item.status, "Not assessed"))}</td><td className="p-3">{linkedReviews.length ? linkedReviews.map((review, i) => <button key={i} type="button" className="mr-1 text-xs font-semibold text-indigo-700 underline" onClick={() => { openAnswer(reviews.indexOf(review)); }}>Q{reviews.indexOf(review) + 1}</button>) : Array.isArray(item.question_refs) && item.question_refs.length ? item.question_refs.join(", ") : <span className="text-xs text-slate-400">—</span>}</td></tr>; }) : <tr><td colSpan={4} className="p-5 text-center text-sm text-slate-500">No role requirement evidence matches this filter.</td></tr>}</tbody></table></div></div></details>
                <div className="grid gap-3 md:grid-cols-2"><article className="rounded-lg border border-slate-200 p-3"><h4 className="text-sm font-bold">Suitable roles</h4><div className="mt-3"><List items={suitableRoles} empty="No suitable roles were recorded."/></div></article><article className="rounded-lg border border-slate-200 p-3"><h4 className="text-sm font-bold">Recommended preparation</h4><div className="mt-3"><List items={preparationSteps} empty="No preparation guidance was recorded."/></div></article></div>
              </section>}

              {activeTab === "rounds" && <section id="panel-rounds" className="space-y-5"><div><h3 className="text-base font-bold">Rounds & competencies</h3><p className="mt-1 text-xs text-slate-500">Round performance, scored dimensions and communication measures from the evaluation.</p></div><div className="grid gap-3 sm:grid-cols-2">{roundEntries.length ? roundEntries.map(({ round, index, label, roundReviews }) => <article key={String(round.agent_type || index)} className="rounded-lg border border-slate-200 p-3"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] uppercase tracking-wide text-slate-500">Round {index + 1}</p><h4 className="mt-1 text-sm font-bold">{label}</h4></div><strong className="text-sm tabular-nums">{round.sub_score == null ? displayName(show(round.status, "Not assessed")) : `${String(round.sub_score)}/100`}</strong></div>{typeof round.sub_score === "number" && <div className="mt-2 h-1.5 rounded bg-slate-100"><div className="h-full rounded bg-indigo-600" style={{ width: `${Math.max(0, Math.min(100, round.sub_score))}%` }}/></div>}<p className="mt-2 text-xs text-slate-600">{show(round.summary || round.evidence || (Array.isArray(round.dimensions) ? (round.dimensions as Data[]).filter(item=>item.band != null).slice(0,2).map(item=>show(item.reason || item.rationale || item.interpretation,displayName(show(item.dimension)))).join(" · ") : ""), "No round summary was recorded.")}</p><p className="mt-2 border-t border-slate-100 pt-2 text-[10px] text-slate-500">{roundReviews.length} reviewed answer{roundReviews.length === 1 ? "" : "s"}</p></article>) : <p className="text-sm text-slate-500">No round-level assessment was recorded.</p>}</div><div className="grid gap-4 lg:grid-cols-2"><article className="rounded-lg border border-slate-200 p-3"><h4 className="text-sm font-bold">Competencies</h4>{dimensions.length ? <div className="mt-3 space-y-3">{dimensions.map((item, index) => <div key={index}><div className="flex justify-between gap-3 text-xs"><span>{show(item.label || displayName(show(item.dimension)))}</span><span className="font-semibold">{item.percentage != null ? `${String(item.percentage)}/100` : item.band != null ? `Band ${String(item.band)}` : "Not assessed"}</span></div>{typeof item.percentage === "number" && <div className="mt-1 h-1.5 rounded bg-slate-100"><div className="h-full rounded bg-indigo-600" style={{ width: `${Math.max(0, Math.min(100, item.percentage))}%` }}/></div>}{(item.interpretation || item.reason) != null && <p className="mt-1 text-xs text-slate-500">{String(item.interpretation || item.reason)}</p>}</div>)}</div> : <p className="mt-3 text-sm text-slate-500">No competency scores were recorded.</p>}</article><article className="rounded-lg border border-slate-200 p-3"><h4 className="text-sm font-bold">Communication measures</h4>{Object.keys(communication).length ? <dl className="mt-3 divide-y divide-slate-100 text-sm">{[["Speaking speed", communication.speaking_speed_wpm == null ? null : `${String(communication.speaking_speed_wpm)} words/min`], ["Pace", communication.pace_label], ["Filler words", communication.filler_word_count], ["Timed answers", communication.timed_answer_count], ...Object.entries((communication.scores || {}) as Data).map(([key, value]) => [displayName(key), value == null ? null : `${String(value)}%`])].filter(([, value]) => value != null).map(([label, value]) => <div key={String(label)} className="flex justify-between gap-4 py-2"><dt className="text-slate-500">{String(label)}</dt><dd className="font-medium">{String(value)}</dd></div>)}</dl> : <p className="mt-3 text-sm text-slate-500">Communication measures are not available.</p>}{Array.isArray(communication.top_filler_words) && communication.top_filler_words.length > 0 && <p className="mt-2 text-xs text-slate-500">Recorded filler words: {communication.top_filler_words.map(String).join(", ")}</p>}</article></div><details className="rounded-lg border border-slate-200 p-3"><summary className="cursor-pointer text-sm font-semibold">Dimensions chart</summary>{dimensionsWithScore.length ? <div className="mt-3 space-y-2">{dimensionsWithScore.map((item, index) => <div key={index} className="grid grid-cols-[minmax(6rem,.6fr)_minmax(0,1fr)_2.5rem] items-center gap-2 text-xs"><span>{show(item.label || item.dimension)}</span><div className="h-2 rounded bg-slate-100"><div className="h-full rounded bg-indigo-600" style={{ width: `${Math.max(0, Math.min(100, Number(item.percentage)))}%` }}/></div><span className="text-right font-semibold">{String(item.percentage)}</span></div>)}</div> : <p className="mt-3 text-sm text-slate-500">There are no percentage scores to chart.</p>}</details></section>}

              {activeTab === "proctor" && <section id="integrity" className="space-y-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-base font-bold">AI Proctor review</h3><p className="mt-1 text-xs text-slate-500">Recorded integrity signals for human review; events are not a final misconduct finding.</p></div><button className={`${btn} inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap`} disabled={integrityLoading || !report.session_id} onClick={() => void evidence("integrity-events")}><ShieldCheck size={14}/>{integrityLoading ? "Loading…" : integrity ? "Reload events" : "Load events"}</button></div>{integrityError && <p role="alert" className="rounded-md bg-rose-50 p-2 text-xs text-rose-700">{integrityError}<button className="ml-2 underline" onClick={() => void evidence("integrity-events")}>Retry</button></p>}<div className="grid gap-3 sm:grid-cols-3"><div className="rounded-lg border border-slate-200 p-3"><p className="text-xs text-slate-500">Integrity score</p><strong className="text-xl">{proctorScore == null ? "Not assessed" : `${proctorScore}/100`}</strong></div><div className="rounded-lg border border-slate-200 p-3"><p className="text-xs text-slate-500">Recorded events</p><strong className="text-xl">{events.length}</strong></div><div className="rounded-lg border border-slate-200 p-3"><p className="text-xs text-slate-500">Assessment status</p><strong className="text-sm">{displayName(show(proctor.status, "Not assessed"))}</strong></div></div>{proctorSubscores.length > 0 && <div className="grid gap-2 sm:grid-cols-2">{proctorSubscores.map(([key, value]) => <div key={key} className="flex justify-between rounded-md border border-slate-200 px-3 py-2 text-xs"><span>{displayName(key)}</span><strong>{value && typeof value === "object" ? show((value as Data).score ?? (value as Data).percentage ?? (value as Data).status) : show(value)}</strong></div>)}</div>}<div className="overflow-x-auto rounded-lg border border-slate-200"><table className="w-full min-w-[700px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-600"><tr><th className="p-3">Time</th><th className="p-3">Event</th><th className="p-3">Severity</th><th className="p-3">Details</th><th className="p-3">Recording</th></tr></thead><tbody>{events.length ? events.map((event, index) => { const key = String(event.event_id || index); return <tr key={key} className="border-t border-slate-100 align-top"><td className="whitespace-nowrap p-3 text-xs">{stamp(event.occurred_at || event.created_at)}</td><th className="p-3 text-sm font-semibold">{displayName(show(event.event_type || event.type, "Proctor observation"))}</th><td className="p-3 text-xs">{displayName(show(event.severity, "Not specified"))}</td><td className="max-w-sm p-3 text-xs text-slate-600">{eventExplanation(event)}</td><td className="p-3"><button type="button" className={`${btn} text-xs`} disabled={!videoReady || recordingOffset(event.occurred_at || event.created_at)==null} onClick={()=>seekToEvent(event)}>Watch event</button></td></tr>; }) : <tr><td colSpan={5} className="p-5 text-center text-sm text-slate-500">{integrityLoading ? "Loading integrity events…" : integrity ? "No proctor observations were recorded." : "Integrity events have not been loaded."}</td></tr>}</tbody></table></div><p className="text-xs text-slate-500">Record your review findings in the officer note. Only a saved placement decision is published to the student.</p></section>}

              {activeTab === "feedback" && <section id="student-feedback" className="space-y-4"><div><h3 className="text-base font-bold">Student feedback</h3><p className="mt-1 text-xs text-slate-500">Feedback and preparation guidance included with this saved evaluation.</p></div><article className="rounded-lg border border-slate-200 p-4"><h4 className="text-sm font-bold">Interview summary</h4><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{show(feedbackSummary, "No student-facing summary is available in this report.")}</p></article><div className="grid gap-3 lg:grid-cols-2"><article className="rounded-lg border border-slate-200 p-4"><h4 className="text-sm font-bold">Growth areas</h4><div className="mt-3"><List items={feedbackAreas} empty="No growth areas are available in this report."/></div></article><article className="rounded-lg border border-slate-200 p-4"><h4 className="text-sm font-bold">Preparation plan</h4><div className="mt-3"><List items={preparationSteps} empty="No preparation guidance is available in this report."/></div></article></div>{suitableRoles.length > 0 && <article className="rounded-lg border border-slate-200 p-4"><h4 className="text-sm font-bold">Roles aligned with this report</h4><div className="mt-3"><List items={suitableRoles} empty="No roles recorded."/></div></article>}</section>}
            </div>
          </section>
        </main>

        <aside className="min-w-0 space-y-3 xl:sticky xl:top-[70px] xl:self-start xl:pr-1">
          <article className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Placement readiness index</p>
            <div className="mt-3 flex items-center gap-3">
              <div className="relative h-[120px] w-[120px] shrink-0"><svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 120 120" aria-label={comparable ? `Placement readiness ${String(pri.score)} out of 100` : "Placement readiness unavailable"}><circle cx="60" cy="60" r="46" fill="none" stroke="#e2e8f0" strokeWidth="10"/>{comparable && <circle cx="60" cy="60" r="46" fill="none" stroke={Number(pri.score) >= 75 ? "#059669" : Number(pri.score) >= 50 ? "#f59e0b" : "#e11d48"} strokeWidth="10" strokeLinecap="round" strokeDasharray={`${2 * Math.PI * 46}`} strokeDashoffset={`${2 * Math.PI * 46 * (1 - Number(pri.score) / 100)}`}/>}</svg><div className="absolute inset-0 flex flex-col items-center justify-center text-center text-2xl font-extrabold leading-none tabular-nums">{comparable ? <><span className="block whitespace-nowrap">{String(pri.score)}</span><small className="mt-1 block text-[10px] font-semibold leading-3 text-slate-500">/ 100</small></> : "—"}</div></div>
              <div><p className="text-lg font-extrabold">{comparable ? (Number(pri.score) >= 75 ? "Ready" : Number(pri.score) >= 50 ? "Developing" : "Not Ready") : "Needs evidence review"}</p><p className="text-xs text-slate-500">Evidence confidence {show(confidence.score, "—")}{confidence.score != null ? "/100" : ""}</p></div>
            </div>
            <div className="relative mt-3"><div className="flex h-2 overflow-hidden rounded-full"><i className="w-1/2 bg-rose-100"/><i className="w-1/4 bg-amber-100"/><i className="w-1/4 bg-emerald-100"/></div>{comparable && <span className="absolute -top-1 h-4 w-[3px] rounded bg-slate-900" style={{ left: `${Math.max(0, Math.min(100, Number(pri.score)))}%` }}/>}</div>
            <div className="mt-1 flex justify-between text-[9px] font-semibold text-slate-500"><span>Not ready &lt;50</span><span>Developing</span><span>Ready ≥75</span></div>
            <p className="mt-3 rounded-lg bg-slate-50 px-2.5 py-2 text-[10px] leading-5 text-slate-600">{priFormulaAvailable ? `${Math.round(Number(interviewComponent.weight) * 100)}% × ${String(interviewComponent.score)} interview + ${Math.round(Number(jobFitComponent.weight) * 100)}% × ${String(jobFitComponent.score)} job fit = ${comparable ? String(pri.score) : "score withheld"}` : show(pri.explanation, "Score components were not included in this report.")}</p>
            {!comparable && Array.isArray(pri.blockers) && pri.blockers.length > 0 && <ul className="mt-2 list-disc pl-4 text-[10px] text-slate-500">{pri.blockers.map((blocker, index) => <li key={index}>{typeof blocker === "string" ? blocker : show((blocker as Data).message)}</li>)}</ul>}
          </article>
          <article className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-2"><div><p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">AI recommendation · advisory</p><p className="mt-1 text-xl font-extrabold">{show(recommendationLabels[String(hiring.label || "Review Required")] || hiring.label, "Review required")}</p></div><span className="text-[10px] text-slate-500">Confidence {show(hiring.confidence, "—")}</span></div>
            <ul className="mt-3 space-y-2 border-t border-slate-100 pt-3">{advisoryFlags.map((flag, index) => <li key={index} className="flex gap-2 text-xs leading-5 text-slate-700"><span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-rose-50 text-[10px] font-bold text-rose-700">!</span>{flag}</li>)}</ul>{!advisoryFlags.length && <p className="mt-2 text-xs leading-5 text-slate-500">Review the interview scores and supporting evidence before deciding.</p>}
            <details className="mt-3 border-t border-slate-100 pt-2 text-xs"><summary className="cursor-pointer font-semibold">Why this recommendation</summary><ul className="mt-2 list-disc space-y-1 pl-4 text-slate-600">{recommendationReasons.length ? recommendationReasons.map((reason, index) => <li key={index}>{show(reason)}</li>) : <li>No recommendation reasons were included in this report.</li>}</ul></details>
          </article>
          <section id="decision" className="space-y-3 scroll-mt-4"><div><p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Placement workflow</p><h2 className="mt-1 text-lg font-bold">Decision & publication</h2></div>{decisionError && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-xs text-rose-800">Decision details could not be loaded: {decisionError}<button className="ml-2 underline" onClick={() => void load()}>Retry</button></p>}
            <form className="rounded-xl border border-slate-200 bg-white p-4" onSubmit={event => { event.preventDefault(); setConfirm("decision"); }}><div className="flex items-center justify-between gap-2"><h3 className="text-sm font-bold">Officer decision</h3><span className="text-[10px] text-slate-500">{decision ? decisionLabel(decision) : "Not decided"}</span></div><fieldset className="mt-3"><legend className="mb-2 text-xs font-medium text-slate-600">Choose an outcome</legend><div className="grid grid-cols-3 gap-1">{[["shortlist", "Shortlist"], ["hold", "Hold"], ["reject", "Not selected"]].map(([value, label]) => <button key={value} type="button" aria-pressed={decision === value} onClick={() => setDecision(value)} className={`rounded-md border px-1.5 py-2 text-[10px] font-semibold sm:text-xs ${decision === value ? "border-indigo-600 bg-indigo-50 text-indigo-800" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>{label}</button>)}</div></fieldset><label className="mt-3 block text-xs font-semibold">Officer note<textarea className={reportField} rows={4} maxLength={2000} placeholder="Add decision context or save timestamped notes" value={note} onChange={event => setNote(event.target.value)}/><span className="mt-1 block text-right text-[10px] font-normal text-slate-500">{2000 - note.length} characters remaining</span></label>{bookmarkNotes.length > 0 && <button type="button" className="mt-2 text-xs font-semibold text-indigo-700" onClick={() => setNote(current => [current.trim(), ...bookmarkNotes.map(item => `[Recording ${timeLabel(item.seconds)}] ${item.text}`)].filter(Boolean).join("\n"))}>Append {bookmarkNotes.length} timestamped note{bookmarkNotes.length === 1 ? "" : "s"}</button>}<button type="submit" className="mt-3 w-full rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={busy || !decision}>Record decision</button></form>
            <article className="rounded-xl border border-slate-200 bg-white p-4"><h3 className="text-sm font-bold">Student result publication</h3><p className="mt-1 text-xs text-slate-500">Current status: {displayName(show(publication.state, "Hidden"))}</p>{publication.scheduled_for != null && <p className="mt-2 text-xs">Scheduled {stamp(publication.scheduled_for)}</p>}{publication.released_at != null && <p className="mt-2 text-xs">Released {stamp(publication.released_at)}</p>}<div className="mt-3 flex flex-wrap gap-2">{publication.state !== "released" && <button className={`${btn} inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap`} onClick={() => setConfirm("release")}>Release now</button>}{publication.state === "scheduled" ? <button className={`${btn} inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap`} onClick={() => setConfirm("cancel_schedule")}>Cancel schedule</button> : publication.state !== "released" && <button className={`${btn} inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap`} onClick={() => setConfirm("schedule")}>Schedule release</button>}</div>{publication.state !== "scheduled" && publication.state !== "released" && <label className="mt-3 block text-xs font-medium">Schedule date/time<input className={reportField} type="datetime-local" value={schedule} onChange={event => setSchedule(event.target.value)}/></label>}</article>
            <article className="rounded-xl border border-slate-200 bg-white p-4"><div className="flex items-center justify-between gap-2"><h3 className="text-sm font-bold">Decision history</h3><span className="text-xs text-slate-500">{history.length}</span></div><div className="mt-3 space-y-2">{orderedHistory.length ? (expanded.history ? orderedHistory : orderedHistory.slice(0, 4)).map((item, index) => <div key={String(item.decision_id || index)} className="border-t border-slate-100 pt-2 text-xs"><div className="flex justify-between gap-2"><strong>{decisionLabel(item.decision)}</strong><span className="text-slate-500">{stamp(item.decided_at || item.created_at)}</span></div><p className="mt-1 whitespace-pre-wrap text-slate-600">{show(item.note, "No officer note.")}</p>{item.actor_name != null && <p className="mt-1 text-[10px] text-slate-500">Recorded by {String(item.actor_name)}</p>}</div>) : <p className="text-xs text-slate-500">No officer decision has been recorded.</p>}</div><PreviewToggle shown={expanded.history ? history.length : Math.min(4, history.length)} total={history.length} onClick={() => toggleExpanded("history")} noun="history entries"/></article>
          </section>
        </aside>
      </div>

      {focusGroup && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-3" onMouseDown={event => { if (event.target === event.currentTarget) setFocusGroup(null); }}><section role="dialog" aria-modal="true" aria-labelledby="focus-dialog-title" className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"><header className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Interview evidence</p><h2 id="focus-dialog-title" className="mt-1 text-lg font-bold">{focusGroup === "strengths" ? "Interview strengths" : "Growth areas"}</h2></div><button type="button" aria-label="Close details" onClick={() => setFocusGroup(null)} className="rounded p-2 text-slate-500 hover:bg-slate-100"><X size={18}/></button></header><div className="overflow-y-auto p-4"><List items={focusGroup === "strengths" ? strengths : growthAreas} empty="No evidence was recorded."/></div></section></div>}
      {confirm && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4"><section role="alertdialog" aria-modal="true" aria-labelledby="report-confirm-title" className={`${reportPanel} max-w-md`}><h3 id="report-confirm-title" className="text-lg font-bold">Confirm {displayName(confirm)}</h3><p className="mt-2 text-sm">{confirm === "decision" ? `Record ${displayName(decision)} as the officer decision?` : confirm === "schedule" ? "Schedule student result publication for the selected date and time?" : confirm === "cancel_schedule" ? "Cancel the scheduled student result publication?" : "Release this result to the student now?"}</p>{confirm === "schedule" && !schedule && <p className="mt-2 text-xs text-rose-700">Choose a release date and time before continuing.</p>}<div className="mt-5 flex justify-end gap-2"><button className={`${btn} inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap`} onClick={() => setConfirm(null)}>Cancel</button><button className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={confirm === "schedule" && !schedule} onClick={() => void perform()}>Confirm</button></div></section></div>}
    </section>
  );
}
