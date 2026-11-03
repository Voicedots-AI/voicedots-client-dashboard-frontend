import React, { useState, useRef, useEffect } from "react";
import {
  Bold,
  Italic,
  Underline,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  Quote,
  Link2,
  Minus,
  Sparkles,
  Eye,
  Code2,
  Edit3,
  RotateCcw,
  Check,
  Copy,
  Info,
  Download,
  Mail,
  GraduationCap,
  Phone,
  HelpCircle,
} from "lucide-react";

interface RichEmailEditorProps {
  value: string;
  onChange: (value: string) => void;
  subject?: string;
  collegeName?: string;
  brochureName?: string;
}

const VARIABLES = [
  { key: "name", label: "Student Name", example: "Ramesh Kumar" },
  { key: "college", label: "College Name", example: "Dhanalakshmi Srinivasan CET" },
  { key: "phone", label: "Helpline", example: "+91 93053 02337" },
  { key: "email", label: "Admissions Email", example: "dscet@voicedots.io" },
  { key: "course", label: "Course / Stream", example: "B.Tech Computer Science" },
  { key: "brochure_url", label: "Brochure URL", example: "https://dscet.ac.in" },
];

const DEFAULT_SAMPLE_TEMPLATE = `Dear {{name}},

Thank you for your interest in {{college}}!

We are pleased to provide you with the official Course Brochure & Prospectus for the upcoming academic year.

Key Highlights:
- NAAC Accredited & Anna University Affiliated
- 94% Placement Record with top MNC recruiters
- Cutting-edge AI, Data Science & Robotics Labs
- Merit Scholarships & Hostel Accommodation

If you have any questions regarding admissions, eligibility, or campus visits, please feel free to reach out directly:
Admissions Helpline: {{phone}}
Email: {{email}}
Website: https://dscet.ac.in

Warm regards,
Admissions & Outreach Office
{{college}}`;

export default function RichEmailEditor({
  value,
  onChange,
  subject = "Official Course Brochure & Admissions Guide — 2026",
  collegeName = "Dhanalakshmi Srinivasan CET",
  brochureName = "DSCET_Admissions_Brochure_2026.pdf",
}: RichEmailEditorProps) {
  const [tab, setTab] = useState<"edit" | "preview" | "html">("edit");
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Formatting tool helper: wraps or prefixes text at cursor
  const applyFormat = (prefix: string, suffix: string = "", defaultText: string = "text") => {
    const el = textareaRef.current;
    if (!el) return;

    const start = el.selectionStart;
    const end = el.selectionEnd;
    const text = value;
    const selected = text.substring(start, end) || defaultText;

    const replacement = `${prefix}${selected}${suffix}`;
    const updated = text.substring(0, start) + replacement + text.substring(end);

    onChange(updated);

    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + prefix.length, start + prefix.length + selected.length);
    }, 50);
  };

  // Insert variable at cursor
  const insertVariable = (varKey: string) => {
    const el = textareaRef.current;
    const token = `{{${varKey}}}`;
    if (!el) {
      onChange(value ? `${value} ${token}` : token);
      return;
    }

    const start = el.selectionStart;
    const end = el.selectionEnd;
    const text = value;
    const updated = text.substring(0, start) + token + text.substring(end);

    onChange(updated);

    setTimeout(() => {
      el.focus();
      const pos = start + token.length;
      el.setSelectionRange(pos, pos);
    }, 50);
  };

  const insertLink = () => {
    const url = prompt("Enter hyperlink URL:", "https://dscet.ac.in");
    if (!url) return;
    const label = prompt("Enter link text:", "Visit College Website") || url;
    applyFormat(`[${label}](`, `${url})`, "");
  };

  const resetToDefault = () => {
    if (window.confirm("Reset email body to the recommended admissions brochure template?")) {
      onChange(DEFAULT_SAMPLE_TEMPLATE);
    }
  };

  const copyContent = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Compile preview with mock values for variables
  const getRenderedPreview = () => {
    let rendered = value || "";
    VARIABLES.forEach((v) => {
      const reg = new RegExp(`\\{\\{${v.key}\\}\\}`, "gi");
      if (v.key === "college") rendered = rendered.replace(reg, collegeName);
      else rendered = rendered.replace(reg, v.example);
    });
    return rendered;
  };

  const previewText = getRenderedPreview();
  const wordCount = value.trim() ? value.trim().split(/\s+/).length : 0;
  const detectedVars = VARIABLES.filter((v) =>
    new RegExp(`\\{\\{${v.key}\\}\\}`, "i").test(value)
  );

  return (
    <div className="w-full rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden transition-all">
      {/* 1. Header Toolbar with Mode Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-slate-100 bg-slate-50/80 px-4 py-2.5 dark:border-slate-800 dark:bg-slate-800/50">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setTab("edit")}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
              tab === "edit"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-200/60 dark:text-slate-400 dark:hover:bg-slate-800"
            }`}
          >
            <Edit3 size={13} /> Visual Editor
          </button>

          <button
            type="button"
            onClick={() => setTab("preview")}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
              tab === "preview"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-200/60 dark:text-slate-400 dark:hover:bg-slate-800"
            }`}
          >
            <Eye size={13} /> Live Email Preview
          </button>

          <button
            type="button"
            onClick={() => setTab("html")}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
              tab === "html"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-200/60 dark:text-slate-400 dark:hover:bg-slate-800"
            }`}
          >
            <Code2 size={13} /> HTML Template View
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={resetToDefault}
            title="Reset to recommended template"
            className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400"
          >
            <RotateCcw size={11} /> Reset Template
          </button>

          <span className="h-3 w-[1px] bg-slate-300 dark:bg-slate-700" />

          <button
            type="button"
            onClick={copyContent}
            title="Copy content"
            className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400"
          >
            {copied ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
            <span>{copied ? "Copied" : "Copy"}</span>
          </button>
        </div>
      </div>

      {/* 2. Formatting Bar (shown in edit mode) */}
      {tab === "edit" && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-white px-3.5 py-2 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center gap-1">
            <button
              type="button"
              onClick={() => applyFormat("**", "**", "Bold text")}
              title="Bold (**text**)"
              className="flex h-7 w-7 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <Bold size={13} />
            </button>
            <button
              type="button"
              onClick={() => applyFormat("*", "*", "Italic text")}
              title="Italic (*text*)"
              className="flex h-7 w-7 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <Italic size={13} />
            </button>
            <button
              type="button"
              onClick={() => applyFormat("<u>", "</u>", "Underlined text")}
              title="Underline"
              className="flex h-7 w-7 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <Underline size={13} />
            </button>

            <span className="mx-1 h-4 w-[1px] bg-slate-200 dark:bg-slate-800" />

            <button
              type="button"
              onClick={() => applyFormat("\n## ", "\n", "Heading Title")}
              title="Heading 2"
              className="flex h-7 w-7 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <Heading2 size={13} />
            </button>
            <button
              type="button"
              onClick={() => applyFormat("\n- ", "\n", "List item")}
              title="Bullet List"
              className="flex h-7 w-7 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <List size={13} />
            </button>
            <button
              type="button"
              onClick={() => applyFormat("\n1. ", "\n", "Numbered item")}
              title="Numbered List"
              className="flex h-7 w-7 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <ListOrdered size={13} />
            </button>
            <button
              type="button"
              onClick={() => applyFormat("\n> ", "\n", "Quote or Note")}
              title="Blockquote"
              className="flex h-7 w-7 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <Quote size={13} />
            </button>
            <button
              type="button"
              onClick={insertLink}
              title="Insert Link"
              className="flex h-7 w-7 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <Link2 size={13} />
            </button>
            <button
              type="button"
              onClick={() => applyFormat("\n---\n", "", "")}
              title="Horizontal Divider"
              className="flex h-7 w-7 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <Minus size={13} />
            </button>
          </div>

          {/* Quick Insert Variable Badges */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Insert Variable:
            </span>
            {VARIABLES.map((v) => (
              <button
                key={v.key}
                type="button"
                onClick={() => insertVariable(v.key)}
                title={`Insert {{${v.key}}} (e.g. ${v.example})`}
                className="inline-flex items-center gap-1 rounded-md border border-indigo-200/80 bg-indigo-50/70 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-100 transition-colors dark:border-indigo-800/60 dark:bg-indigo-950/40 dark:text-indigo-300"
              >
                <span>+{`{{${v.key}}}`}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 3. Main Body Container */}
      <div className="p-4">
        {tab === "edit" ? (
          <div className="space-y-3">
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              rows={9}
              required
              placeholder="Compose your automated email message here..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-4 font-sans text-xs text-slate-800 leading-relaxed outline-none transition-all focus:border-indigo-500 focus:bg-white focus:ring-1 focus:ring-indigo-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 resize-y"
            />

            {/* Bottom Meta & Variable Badges */}
            <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-400 border-t border-slate-100 pt-3 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <span>{wordCount} words</span>
                <span>•</span>
                <span>{value.length} characters</span>
                <span>•</span>
                <span className="text-emerald-600 font-medium dark:text-emerald-400">
                  {detectedVars.length} variable(s) active:{" "}
                  {detectedVars.map((v) => `{{${v.key}}}`).join(", ") || "none"}
                </span>
              </div>
              <div className="flex items-center gap-1 text-slate-400">
                <HelpCircle size={12} />
                <span>Supports Markdown formatting & HTML line breaks</span>
              </div>
            </div>
          </div>
        ) : tab === "preview" ? (
          /* Live Recipient Email Preview */
          <div className="rounded-xl border border-slate-200 bg-slate-100/70 p-4 sm:p-6 dark:border-slate-800 dark:bg-slate-950/60">
            <div className="mx-auto max-w-xl rounded-2xl border border-slate-200/80 bg-white shadow-md overflow-hidden dark:border-slate-700 dark:bg-slate-900">
              {/* Email Envelope Header */}
              <div className="border-b border-slate-100 bg-slate-50 px-5 py-3 dark:border-slate-800 dark:bg-slate-800/60">
                <div className="text-[11px] text-slate-500 space-y-1">
                  <div>
                    <strong className="text-slate-700 dark:text-slate-200">From:</strong>{" "}
                    Admissions Office &lt;dscet@voicedots.io&gt;
                  </div>
                  <div>
                    <strong className="text-slate-700 dark:text-slate-200">Subject:</strong>{" "}
                    <span className="font-semibold text-slate-800 dark:text-white">{subject}</span>
                  </div>
                  <div>
                    <strong className="text-slate-700 dark:text-slate-200">To:</strong>{" "}
                    Ramesh Kumar &lt;ramesh.kumar@example.com&gt;
                  </div>
                </div>
              </div>

              {/* Branded College Banner */}
              <div className="bg-gradient-to-r from-indigo-600 to-violet-700 px-6 py-5 text-white">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 backdrop-blur-xs">
                    <GraduationCap size={20} className="text-white" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold tracking-tight">{collegeName}</h3>
                    <p className="text-[11px] text-indigo-100">Admissions & Prospectus Counseling</p>
                  </div>
                </div>
              </div>

              {/* Email Body Content */}
              <div className="p-6 space-y-4 text-xs leading-relaxed text-slate-700 dark:text-slate-200 whitespace-pre-wrap font-sans">
                {previewText}
              </div>

              {/* Download Brochure Button Card */}
              <div className="px-6 pb-6 pt-2">
                <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4 text-center dark:border-indigo-900/40 dark:bg-indigo-950/30">
                  <p className="text-[11px] font-semibold text-indigo-900 dark:text-indigo-200 mb-2">
                    Official College Brochure & Fee Schedule
                  </p>
                  <a
                    href="#"
                    onClick={(e) => e.preventDefault()}
                    className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 transition"
                  >
                    <Download size={14} /> Download {brochureName}
                  </a>
                </div>

                {/* Footer details */}
                <div className="mt-5 border-t border-slate-100 pt-4 text-[10px] text-slate-400 text-center dark:border-slate-800">
                  <p>© {new Date().getFullYear()} {collegeName}. All rights reserved.</p>
                  <p className="mt-0.5">Automated Prospectus Dispatch powered by VoiceDots AI</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* HTML Template View */
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                Generated HTML Output (Sent via Email Service Gateway)
              </span>
              <span className="text-[11px] text-slate-400">Read-only template preview</span>
            </div>
            <pre className="w-full max-h-[320px] overflow-auto rounded-xl border border-slate-200 bg-slate-950 p-4 font-mono text-[11px] text-emerald-400 dark:border-slate-800 leading-relaxed">
{`<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
</head>
<body style="margin:0;padding:24px;background:#f5f3ff;font-family:sans-serif;">
  <table role="presentation" style="width:100%;max-width:620px;margin:auto;background:#ffffff;border-radius:16px;">
    <tr>
      <td style="padding:24px;background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%);color:#fff;">
        <h1 style="margin:0;font-size:20px;">${collegeName}</h1>
      </td>
    </tr>
    <tr>
      <td style="padding:24px;font-size:14px;color:#334155;line-height:1.6;">
        ${value.replace(/\n/g, "<br>")}
      </td>
    </tr>
    <tr>
      <td style="padding:24px;text-align:center;">
        <a href="https://dscet.ac.in" style="background:#4f46e5;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;">
          Download ${brochureName}
        </a>
      </td>
    </tr>
  </table>
</body>
</html>`}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

