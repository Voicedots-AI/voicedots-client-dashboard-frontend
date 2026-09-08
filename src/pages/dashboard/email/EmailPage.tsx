import { Clock3, FileText, Mail, Send, Sparkles } from "lucide-react";

const features = [
  { icon: FileText, title: "Email templates", text: "Build reusable, branded email templates." },
  { icon: Send, title: "Campaigns", text: "Send personalized campaigns to uploaded contacts." },
  { icon: Sparkles, title: "Smart follow-ups", text: "Create timely follow-ups from your conversations." },
];

export default function EmailPage() {
  return (
    <div className="min-h-[calc(100dvh-140px)] rounded-2xl bg-[#f9f8ff] p-4 text-slate-900 dark:bg-slate-950/30 dark:text-slate-100 sm:p-6">
      <div className="mx-auto flex min-h-[600px] max-w-5xl items-center justify-center">
        <section className="w-full overflow-hidden rounded-[28px] border border-violet-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="bg-gradient-to-br from-indigo-700 via-violet-700 to-purple-600 px-6 py-12 text-center text-white sm:px-12 sm:py-16">
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25 backdrop-blur">
              <Mail size={32} />
            </span>
            <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold ring-1 ring-white/20">
              <Clock3 size={14} /> Upcoming feature
            </div>
            <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
              Email workspace is coming soon
            </h1>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-indigo-100 sm:text-base">
              We are preparing a reliable workspace for templates, personalized campaigns, delivery tracking, and follow-ups.
            </p>
          </div>

          <div className="grid gap-4 p-5 sm:grid-cols-3 sm:p-8">
            {features.map(({ icon: Icon, title, text }) => (
              <article key={title} className="rounded-2xl bg-violet-50/70 p-5 dark:bg-slate-950/60">
                <span className="inline-flex rounded-xl bg-white p-2.5 text-indigo-700 shadow-sm dark:bg-slate-800 dark:text-indigo-300">
                  <Icon size={20} />
                </span>
                <h2 className="mt-4 text-sm font-semibold">{title}</h2>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{text}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
