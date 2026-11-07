import { useEffect, useState } from 'react';
import { apiClient } from '@/api/apiClient';

type Audit = {
  conversation_id: string; agent_id: string; model: string; key_fingerprint: string;
  status: string; started_at: string; updated_at: string; requested_by?: string;
  totals: Record<string, number>; evidence?: Record<string, unknown>; coverage?: string;
};
const PAGE_SIZE = 25;

export default function GeminiAuditPage() {
  const [query, setQuery] = useState('');
  const [since, setSince] = useState('');
  const [until, setUntil] = useState('');
  const [search, setSearch] = useState({ q: '', since: '', until: '', offset: 0, revision: 0 });
  const [rows, setRows] = useState<Audit[]>([]);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<Audit | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    apiClient.get('/v3/gemini-audits', { signal: controller.signal, params: {
      q: search.q, since: search.since ? new Date(search.since).toISOString() : undefined,
      until: search.until ? new Date(search.until).toISOString() : undefined,
      limit: PAGE_SIZE, offset: search.offset,
    } }).then(({ data }) => { setRows(data.items); setTotal(data.total); })
      .catch(() => { if (!controller.signal.aborted) setError('Unable to load audit logs. Please retry.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [search]);
  useEffect(() => {
    setSelected(null);
    if (!selectedId) return;
    const controller = new AbortController();
    setDetailLoading(true); setError('');
    apiClient.get(`/v3/gemini-audits/${encodeURIComponent(selectedId)}`, { signal: controller.signal })
      .then(({ data }) => setSelected(data))
      .catch(() => { if (!controller.signal.aborted) setError('Unable to load this audit record.'); })
      .finally(() => { if (!controller.signal.aborted) setDetailLoading(false); });
    return () => controller.abort();
  }, [selectedId, search.revision]);
  const download = () => {
    if (!selected) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(selected, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url;
    link.download = `gemini-audit-${selected.conversation_id}.json`; link.click();
    URL.revokeObjectURL(url);
  };
  const inputClass = 'rounded border border-slate-300 bg-transparent p-2 dark:border-slate-600';
  return <div className="space-y-5 p-6 text-slate-900 dark:text-slate-100">
    <div><h1 className="text-2xl font-semibold">Gemini investigation logs</h1>
      <p className="mt-1 text-sm text-slate-500">Trace voice calls, provider usage, prompts, tool activity, and failures across your agents.</p>
      <p className="mt-1 text-sm text-slate-500">Records begin when logging is enabled. Active calls checkpoint every five seconds. Token counts reflect usage reported by Gemini.</p></div>
    <form className="flex flex-wrap items-end gap-3" onSubmit={e => {
      e.preventDefault(); setSearch(s => ({ q: query, since, until, offset: 0, revision: s.revision + 1 }));
    }}>
      <label className="grid gap-1 text-sm">ID, model, or key fingerprint<input className={inputClass} value={query} onChange={e => setQuery(e.target.value)} /></label>
      <label className="grid gap-1 text-sm">From (local time)<input type="datetime-local" className={inputClass} value={since} onChange={e => setSince(e.target.value)} /></label>
      <label className="grid gap-1 text-sm">Until (local time)<input type="datetime-local" className={inputClass} value={until} onChange={e => setUntil(e.target.value)} /></label>
      <button className="rounded bg-blue-600 px-4 py-2 text-white" disabled={loading}>Search / refresh</button>
    </form>
    {error && <p role="alert" className="text-red-600">{error}</p>}
    <div aria-busy={loading} className="overflow-x-auto rounded border border-slate-200 dark:border-slate-700">
      <table className="w-full text-left text-sm"><thead><tr>{['Started', 'Agent / conversation', 'Model / key fingerprint', 'Status', 'Input / output tokens', 'Evidence'].map(h => <th key={h} className="p-3">{h}</th>)}</tr></thead>
        <tbody>{rows.map(row => <tr key={row.conversation_id} className="border-t border-slate-200 dark:border-slate-700">
          <td className="p-3">{new Date(row.started_at).toLocaleString()}</td>
          <td className="p-3"><div>{row.agent_id}</div><div className="font-mono text-xs">{row.conversation_id}</div></td>
          <td className="p-3"><div>{row.model}</div><div className="font-mono text-xs">{row.key_fingerprint || 'Unknown'}</div></td>
          <td className="p-3">{row.status}</td><td className="p-3">{row.totals.gemini_usage_events ? `${row.totals.llm_input_tokens} / ${row.totals.llm_output_tokens}` : 'Not reported'}</td>
          <td className="p-3"><button className="text-blue-600 underline" onClick={() => setSelectedId(row.conversation_id)} aria-label={`Inspect conversation ${row.conversation_id}`}>Inspect</button></td>
        </tr>)}</tbody></table>
      {!rows.length && <p className="p-4">{loading ? 'Loading…' : 'No audit records for this search.'}</p>}
    </div>
    <div className="flex items-center gap-4"><button disabled={loading || search.offset === 0} onClick={() => setSearch(s => ({ ...s, offset: Math.max(0, s.offset - PAGE_SIZE) }))}>Previous</button>
      <span>{total ? `${search.offset + 1}–${Math.min(search.offset + PAGE_SIZE, total)} of ${total}` : '0 records'}</span>
      <button disabled={loading || search.offset + PAGE_SIZE >= total} onClick={() => setSearch(s => ({ ...s, offset: s.offset + PAGE_SIZE }))}>Next</button></div>
    {detailLoading && <p role="status">Loading evidence…</p>}
    {selected && <section className="space-y-3 rounded border border-slate-300 p-4 dark:border-slate-600">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Conversation {selected.conversation_id}</h2>
        <button className="rounded bg-blue-600 px-3 py-2 text-white" onClick={download}>Download complete JSON</button></div>
      <p>Requested by: {selected.requested_by || 'Unknown / no authenticated outbound initiator'}</p>
      <p className="text-sm text-slate-500">{selected.coverage}</p>
      <p className="text-sm">Last checkpoint: {new Date(selected.updated_at).toLocaleString()}</p>
      {Object.entries(selected.evidence || {}).map(([name, value]) => <details key={name} className="rounded border border-slate-200 p-3 dark:border-slate-700">
        <summary className="cursor-pointer font-medium">{name.replaceAll('_', ' ')}</summary>
        <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap break-all text-xs">{JSON.stringify(value, null, 2)}</pre>
      </details>)}
    </section>}
  </div>;
}
