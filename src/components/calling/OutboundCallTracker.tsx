import { useEffect, useState } from 'react';
import {
  AlertCircle,
  Bot,
  Check,
  Clock,
  Loader2,
  Phone,
  PhoneCall,
  PhoneForwarded,
  Sparkles,
  X
} from 'lucide-react';
import type { OutboundCallStatus } from '@/api/outboundCalls';

export type OutboundCallTrackerProps = {
  call: OutboundCallStatus;
  contactName?: string;
  destination?: string;
  onClose?: () => void;
};

export function OutboundCallTracker({
  call,
  contactName,
  destination,
  onClose,
}: OutboundCallTrackerProps) {
  const [elapsed, setElapsed] = useState(0);

  // Compute elapsed time from creation
  useEffect(() => {
    const start = new Date(call.created_at).getTime();
    const update = () => {
      const now = Date.now();
      setElapsed(Math.max(0, Math.floor((now - start) / 1000)));
    };
    update();
    if (call.status === 'connected' || call.status === 'queued' || call.status === 'dialing') {
      const timer = window.setInterval(update, 1000);
      return () => window.clearInterval(timer);
    }
  }, [call.created_at, call.status]);

  // Determine which phase is currently active:
  // Phase 1: AI Collecting Data / Initializing Voice Agent (Status 'queued' or user_message mentions 'Connecting the AI')
  // Phase 2: Sending Call to User / Dialing (Status 'dialing' and AI is ready)
  // Phase 3: Connected & Active Conversation (Status 'connected')
  const isAiPreparing =
    call.status === 'queued' ||
    (call.status === 'dialing' &&
      (call.user_message?.toLowerCase().includes('connecting the ai') ||
        call.user_message?.toLowerCase().includes('preparing') ||
        !call.user_message));

  const isDialing = call.status === 'dialing' && !isAiPreparing;
  const isConnected = call.status === 'connected';
  const isFailed = call.status === 'failed' || call.status === 'blocked';

  const currentPhase = isConnected ? 3 : isDialing ? 2 : isAiPreparing ? 1 : 0;

  const formatSeconds = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const remaining = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${remaining.toString().padStart(2, '0')}`;
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-violet-200 bg-white p-5 shadow-sm dark:border-violet-900/60 dark:bg-slate-900">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-600 dark:bg-violet-950 dark:text-violet-300">
            {isConnected ? (
              <PhoneCall className="animate-pulse" size={20} />
            ) : isFailed ? (
              <AlertCircle size={20} className="text-rose-600" />
            ) : (
              <Sparkles className="animate-spin text-violet-600" size={20} />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {isConnected
                  ? 'Call Connected & In Progress'
                  : isFailed
                  ? 'Call Not Connected'
                  : 'AI Calling Pipeline'}
              </h3>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  isConnected
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                    : isFailed
                    ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                    : 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300'
                }`}
              >
                {!isFailed && <Loader2 size={11} className={isConnected ? '' : 'animate-spin'} />}
                {call.status.toUpperCase()}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              {contactName || call.contact_name || 'Contact'}
              {destination ? ` · ${destination}` : ''} · Call ID: {call.id.slice(0, 8)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-mono font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
            <Clock size={13} className="text-slate-400" />
            <span>{formatSeconds(elapsed)}</span>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
              title="Dismiss tracker"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* 3-Phase Stepper */}
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {/* Phase 1: AI Collecting Data */}
        <div
          className={`relative rounded-xl border p-3.5 transition-all ${
            currentPhase > 1
              ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/40 dark:bg-emerald-950/10'
              : currentPhase === 1
              ? 'border-violet-300 bg-violet-50/80 shadow-sm dark:border-violet-800 dark:bg-violet-950/20'
              : 'border-slate-200 bg-slate-50/50 opacity-60 dark:border-slate-800 dark:bg-slate-900'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Phase 1
            </span>
            {currentPhase > 1 ? (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white">
                <Check size={12} strokeWidth={3} />
              </span>
            ) : currentPhase === 1 && !isFailed ? (
              <Loader2 size={16} className="animate-spin text-violet-600" />
            ) : isFailed && currentPhase === 1 ? (
              <AlertCircle size={16} className="text-rose-600" />
            ) : (
              <div className="h-4 w-4 rounded-full border border-slate-300 dark:border-slate-700" />
            )}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <Bot size={16} className={currentPhase >= 1 ? 'text-violet-600' : 'text-slate-400'} />
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">AI Collecting Data</h4>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {currentPhase > 1
              ? 'AI voice agent & greeting synthesized'
              : currentPhase === 1 && !isFailed
              ? 'Synthesizing voice greeting & loading context (~15s)...'
              : 'Context & voice model warmup'}
          </p>
        </div>

        {/* Phase 2: Send Call to User */}
        <div
          className={`relative rounded-xl border p-3.5 transition-all ${
            currentPhase > 2
              ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/40 dark:bg-emerald-950/10'
              : currentPhase === 2
              ? 'border-violet-300 bg-violet-50/80 shadow-sm dark:border-violet-800 dark:bg-violet-950/20'
              : 'border-slate-200 bg-slate-50/50 opacity-60 dark:border-slate-800 dark:bg-slate-900'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Phase 2
            </span>
            {currentPhase > 2 ? (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white">
                <Check size={12} strokeWidth={3} />
              </span>
            ) : currentPhase === 2 && !isFailed ? (
              <Loader2 size={16} className="animate-spin text-violet-600" />
            ) : isFailed && currentPhase === 2 ? (
              <AlertCircle size={16} className="text-rose-600" />
            ) : (
              <div className="h-4 w-4 rounded-full border border-slate-300 dark:border-slate-700" />
            )}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <PhoneForwarded
              size={16}
              className={currentPhase >= 2 ? 'text-violet-600' : 'text-slate-400'}
            />
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">Send Call to User</h4>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {currentPhase > 2
              ? 'Handset answered by callee'
              : currentPhase === 2 && !isFailed
              ? 'Ringing handset via LiveKit SIP trunk...'
              : 'Dialing recipient on phone network'}
          </p>
        </div>

        {/* Phase 3: Connected & Active Conversation */}
        <div
          className={`relative rounded-xl border p-3.5 transition-all ${
            isConnected
              ? 'border-emerald-300 bg-emerald-50/80 shadow-sm dark:border-emerald-800 dark:bg-emerald-950/20'
              : 'border-slate-200 bg-slate-50/50 opacity-60 dark:border-slate-800 dark:bg-slate-900'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Phase 3
            </span>
            {isConnected ? (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white">
                <Check size={12} strokeWidth={3} />
              </span>
            ) : (
              <div className="h-4 w-4 rounded-full border border-slate-300 dark:border-slate-700" />
            )}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <Phone size={16} className={isConnected ? 'text-emerald-600' : 'text-slate-400'} />
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              Connected & Speaking
            </h4>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {isConnected
              ? 'Live conversation streaming in real-time'
              : 'Multi-turn conversation & recording'}
          </p>
        </div>
      </div>

      {/* Live Status Message & Guidance */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-3 text-xs dark:bg-slate-800/60">
        <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
          <span className="font-semibold text-slate-900 dark:text-white">Current status:</span>
          <span>
            {call.user_message ||
              (currentPhase === 1
                ? 'AI is collecting data and synthesizing greeting audio...'
                : currentPhase === 2
                ? 'Dialing recipient via phone carrier...'
                : currentPhase === 3
                ? 'Call in progress. AI is conversing with the caller.'
                : 'Call completed.')}
          </span>
        </div>

        {currentPhase === 1 && (
          <span className="text-violet-600 dark:text-violet-400">
            * Note: VoiceDots pre-generates opening greeting so user hears AI immediately upon answering.
          </span>
        )}

        {isFailed && (
          <div className="w-full text-rose-600 dark:text-rose-400">
            <strong>Error:</strong> {call.error || 'The call could not be completed.'}
          </div>
        )}
      </div>
    </div>
  );
}

