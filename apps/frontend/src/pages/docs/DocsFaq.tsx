import type { ReactNode } from 'react';
import DocsPage from '../../components/docs/DocsPage';
import { Code } from '../../components/docs/DocsPrimitives';

interface QA {
  q: string;
  a: ReactNode;
}

const FAQS: QA[] = [
  {
    q: "My call returned decision: 'halted'. Is that an error?",
    a: (
      <>
        No — a guardrail did exactly what it&rsquo;s supposed to do. Check <Code>guardrailsFired</Code> to see which
        rule fired, and the <Code>approval</Code> object to see who needs to act. Resolve it through the Approval
        Workflow.
      </>
    ),
  },
  {
    q: 'A 422 schema_violation — what does that mean?',
    a: (
      <>
        Your input failed validation before the model ran. The <Code>field</Code> tells you which value is wrong or
        missing. These calls don&rsquo;t count toward billing and don&rsquo;t write an audit record.
      </>
    ),
  },
  {
    q: 'Do sandbox (pgk_test_) calls count against my quota or bill?',
    a: 'No. Sandbox calls are free and don’t count toward billing.',
  },
  {
    q: 'How do I trace a specific decision a customer is asking about?',
    a: (
      <>
        Every response includes an <Code>auditId</Code>. Pass it to <Code>audit.getDecisionHistory</Code>. Store{' '}
        <Code>auditId</Code> in your own logs as soon as you receive a response — it&rsquo;s your reference handle for
        any future support or compliance query.
      </>
    ),
  },
  {
    q: 'Which model runs my call?',
    a: (
      <>
        Claude Opus for complex decisions, Sonnet for lighter ones. The <Code>model</Code> field on every response
        tells you which one ran.
      </>
    ),
  },
  {
    q: 'Can I bring my own AI model, or run Progue self-hosted?',
    a: 'Not in v1. Progue is a managed API.',
  },
  {
    q: 'Does Progue support agent-to-agent orchestration?',
    a: (
      <>
        Not yet. The architecture is designed not to block it; it&rsquo;s on the roadmap beyond v1. See{' '}
        <a className="text-[var(--brand)] no-underline hover:underline" href="/docs/roadmap">
          Roadmap
        </a>
        .
      </>
    ),
  },
  {
    q: 'A carrier rate looks off or stubbed.',
    a: 'During launch some carrier integrations return stubbed data while live wiring lands. The module reference notes the current status per carrier.',
  },
  {
    q: 'What happens to my audit logs if I cancel?',
    a: (
      <>
        Export them any time before cancellation via <Code>audit.exportAuditReport</Code>. Retention follows your tier
        while your account is active.
      </>
    ),
  },
];

export default function DocsFaq() {
  return (
    <DocsPage
      section="FAQ &amp; troubleshooting"
      title="FAQ and Troubleshooting"
      plainEnglish="Common questions and what to do about them."
    >
      <div className="divide-y divide-[var(--border)]">
        {FAQS.map((item) => (
          <div key={item.q} className="py-5 first:pt-0">
            <p className="mb-2 text-[15px] font-medium text-[var(--text)]">{item.q}</p>
            <p className="text-[14px] leading-7 text-[var(--text-2)]">{item.a}</p>
          </div>
        ))}
      </div>
    </DocsPage>
  );
}
