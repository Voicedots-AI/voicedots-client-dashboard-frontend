import { Check, Loader2 } from 'lucide-react';
import './qpg-syllabus-steps.css';

export default function QpgSyllabusSteps({ current, saving = false, published = false }: {
  current: 1 | 2 | 3;
  saving?: boolean;
  published?: boolean;
}) {
  const steps = [
    { title: 'Review content', help: 'Check outcomes, units and topics' },
    { title: 'Save draft', help: 'Keep your reviewed syllabus' },
    { title: 'Review & Publish', help: 'Enable questions and papers' },
  ];
  return <ol className="qpg-syllabus-steps" aria-label="Syllabus progress">
    {steps.map((step, index) => {
      const number = index + 1;
      const complete = published || number < current;
      const active = !published && number === current;
      return <li key={step.title} className={complete ? 'is-complete' : active ? 'is-current' : ''}
        aria-current={active ? 'step' : undefined}>
        <span className="qpg-syllabus-step-icon" aria-hidden="true">
          {complete ? <Check size={17} /> : active && saving ? <Loader2 size={17} className="animate-spin" /> : number}
        </span>
        <div className="qpg-syllabus-step-copy"><div><strong>{step.title}</strong>
          <span className="qpg-syllabus-step-state">{complete ? 'Completed' : active ? saving ? 'Saving…' : 'Current step' : 'Next'}</span>
        </div><p>{step.help}</p></div>
      </li>;
    })}
  </ol>;
}
