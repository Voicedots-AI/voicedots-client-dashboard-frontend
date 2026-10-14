import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { collegeApi, collegeError, type Drive } from "@/api/collegeApi";
import { attemptCounts, attemptValue, type CandidateAttempt } from "./CandidateAttemptBadge";
import { btn, field } from "./interviewAgentTypes";

type Assignment = CandidateAttempt & { drive_id?: string; full_name?: string; student_id?: string };
type History = { max_attempts?: number; attempts?: Array<{ attempt_number: number }> };

// Both entry points use the same tenant-scoped APIs; saving a limit never reopens an interview.
export default function ManageCandidateAttempts({ driveId, studentId, name, onClose, onSaved }: {
  driveId: string; studentId: string; name: string; onClose: () => void; onSaved: () => void;
}) {
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [drive, setDrive] = useState<Drive | null>(null);
  const [allowed, setAllowed] = useState(1), [limit, setLimit] = useState("1");
  const [loading, setLoading] = useState(true), [saving, setSaving] = useState(false);
  const [reopen, setReopen] = useState(false), [confirm, setConfirm] = useState(false);
  const [error, setError] = useState(""), [version, setVersion] = useState(0);
  const dialog = useRef<HTMLElement>(null);
  const busy = useRef(false);
  busy.current = saving;
  const path = `drives/${encodeURIComponent(driveId)}/candidates/${encodeURIComponent(studentId)}`;
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(""); setAssignment(null); setReopen(false); setConfirm(false);
    Promise.all([
      collegeApi.get<History>(`${path}/attempts`, controller.signal),
      collegeApi.get<{ drives?: Assignment[] }>(`students/${encodeURIComponent(studentId)}/reports`, controller.signal),
      collegeApi.get<Drive>(`drives/${encodeURIComponent(driveId)}`, controller.signal),
    ]).then(([history, bundle, currentDrive]) => {
      if (controller.signal.aborted) return;
      const current = bundle.drives?.find(item => item.drive_id === driveId);
      if (!current) throw new Error("Current assignment could not be loaded. Refresh before changing attempts.");
      const maximum = attemptValue(history.max_attempts, currentDrive.max_attempts || 1);
      // History includes saved earlier attempts even when a fresh attempt is waiting to start.
      const historicalUsed = Math.max(0, ...(history.attempts || []).map(item => item.attempt_number));
      setAssignment({ ...current, attempt_number: Math.max(attemptValue(current.attempt_number, 1), historicalUsed), max_attempts: maximum });
      setDrive(currentDrive); setAllowed(maximum); setLimit(String(maximum));
    }).catch(reason => { if (!controller.signal.aborted) setError(collegeError(reason)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [driveId, studentId, path, version]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const element = dialog.current;
    element?.querySelector<HTMLButtonElement>("button")?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy.current) { event.preventDefault(); onClose(); }
      if (event.key !== "Tab") return;
      const items = [...(element?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), [tabindex="0"]') || [])];
      const first = items[0], last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", keydown);
    return () => { document.body.style.overflow = overflow; document.removeEventListener("keydown", keydown); previous?.focus(); };
  }, [onClose]);
  const [used] = assignment ? attemptCounts(assignment, allowed) : [0];
  const minimum = Math.max(allowed, attemptValue(assignment?.attempt_number, 1));
  const nextLimit = Number(limit);
  const valid = Number.isInteger(nextLimit) && nextLimit >= minimum && nextLimit <= 20;
  const canReopen = Boolean(assignment && drive && ["scheduled", "active"].includes(drive.status) && ["completed", "expired", "cancelled"].includes(assignment.assignment_status || "") && nextLimit > attemptValue(assignment.attempt_number, 1));
  const update = async () => {
    if (!valid || !assignment || loading || saving || (reopen && !canReopen)) return;
    setSaving(true); setError("");
    try {
      await collegeApi.save(`${path}/${reopen ? "reopen" : "attempt-limit"}`, reopen ? { max_attempts_override: nextLimit } : { max_attempts: nextLimit }, true);
      onSaved(); onClose();
    } catch (reason) { setError(`${collegeError(reason)}${reopen ? " Refresh the policy before retrying; the allowed limit may already have been updated." : ""}`); setConfirm(false); }
    finally { setSaving(false); }
  };
  return createPortal(<div className="fixed inset-0 z-[110] grid place-items-center bg-slate-950/50 p-4" onMouseDown={event => { if (event.target === event.currentTarget && !saving) onClose(); }}>
    <section ref={dialog} role="dialog" aria-modal="true" aria-labelledby="manage-attempts-title" className="w-full max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl bg-white p-5 text-slate-800 shadow-xl dark:bg-slate-900 dark:text-slate-100">
      <header className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 id="manage-attempts-title" className="text-lg font-semibold">Manage Attempts</h2><p className="mt-1 truncate text-sm text-slate-500" title={name}>{name}</p></div><button type="button" className={btn} disabled={saving} aria-label="Close Manage Attempts" onClick={onClose}>Close</button></header>
      {error && <div role="alert" className="mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{error}<button className="ml-2 underline" disabled={saving} onClick={() => setVersion(value => value + 1)}>{assignment ? "Refresh policy" : "Retry"}</button></div>}
      {loading ? <p role="status" className="py-6 text-sm">Loading current attempt policy…</p> : assignment && <>
        <dl className="my-4 grid grid-cols-3 gap-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-800"><div><dt className="text-xs text-slate-500">Used</dt><dd className="font-semibold">{used}/{allowed}</dd></div><div><dt className="text-xs text-slate-500">Allowed</dt><dd className="font-semibold">{allowed}</dd></div><div><dt className="text-xs text-slate-500">Remaining</dt><dd className="font-semibold">{Math.max(0, allowed - used)}</dd></div></dl>
        <details className="mb-4 text-sm"><summary className="cursor-pointer font-medium">Existing attempt policy</summary><p className="mt-2 text-slate-500">Drive default: {drive?.max_attempts || 1}. Candidate limit: {allowed}.</p>{drive?.score_attempt_rules?.length ? drive.score_attempt_rules.map((rule, index) => <p className="mt-1 text-slate-500" key={index}>Score {rule.min_score}–{rule.max_score}: {rule.max_attempts} attempts{rule.require_coach ? " · AI Coach required" : ""}</p>) : <p className="mt-1 text-slate-500">No score-based rules.</p>}</details>
        <label className="block text-sm font-medium">Allowed attempts<input className={`${field} mt-1`} type="number" min={minimum} max={20} step={1} disabled={saving || confirm} value={limit} onChange={event => { setLimit(event.target.value); setReopen(false); }} /></label>
        {!valid && <p role="alert" className="mt-2 text-sm text-rose-700">Enter a whole number from {minimum} to 20. Previous attempts cannot be removed.</p>}
        <p className="mt-2 text-xs text-slate-500">{valid ? `${Math.max(0, nextLimit - used)} remaining after saving. ` : ""}Saving the limit keeps the interview’s current status.</p>
        {canReopen && <label className="mt-4 flex items-start gap-2 text-sm"><input className="mt-1 accent-violet-600" type="checkbox" checked={reopen} disabled={saving || confirm} onChange={event => setReopen(event.target.checked)} /><span>Reopen interview after saving<span className="mt-1 block text-xs text-slate-500">Creates the next attempt. Drive-window and AI Coach rules still apply.</span></span></label>}
        {confirm && <p role="status" className="mt-4 rounded-lg bg-violet-50 p-3 text-sm text-violet-800">Confirm {used}/{allowed} → {used}/{nextLimit} attempts used.{reopen ? " Also reopen the interview for the next attempt." : " The interview will not be reopened."} Saved results and scores stay unchanged.</p>}
        <footer className="mt-5 flex justify-end gap-2"><button type="button" className={btn} disabled={saving} onClick={() => confirm ? setConfirm(false) : onClose()}>{confirm ? "Back" : "Cancel"}</button><button type="button" className={`${btn} bg-violet-600 text-white`} disabled={!valid || saving || (nextLimit === allowed && !reopen)} onClick={() => confirm ? void update() : setConfirm(true)}>{saving ? "Saving…" : confirm ? "Confirm changes" : "Save changes"}</button></footer>
      </>}
    </section>
  </div>, document.body);
}
