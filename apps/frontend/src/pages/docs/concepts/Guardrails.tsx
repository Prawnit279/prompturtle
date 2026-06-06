import DocsPage from '../../../components/docs/DocsPage';
import { H2, P, Code, CodeBlock, UL, DocsTable } from '../../../components/docs/DocsPrimitives';

export default function ConceptsGuardrails() {
  return (
    <DocsPage
      section="Core concepts"
      title="Guardrails"
      plainEnglish={
        <>
          <p>
            Guardrails are the rules that decide when an AI agent must stop and wait for a human. Think of them as
            automatic checkpoints: before Progue returns a decision, it checks whether the decision meets certain
            conditions. If it doesn&rsquo;t — if a shipment costs too much, if a carrier isn&rsquo;t on the approved
            list, if customs documentation is missing — the agent halts and the right person gets notified.
          </p>
          <p>
            This is the part most teams skip when building AI features themselves. Progue ships it on by default so
            turning it off requires a deliberate choice, not an oversight.
          </p>
        </>
      }
    >
      <H2>The five launch rules</H2>
      <DocsTable
        head={['Rule', 'Fires when', 'Action', 'Who gets notified']}
        rows={[
          [<Code>high_cost_approval</Code>, 'Shipment cost exceeds threshold (default $10,000)', 'Halt until approved', 'finance_manager'],
          [<Code>new_carrier_check</Code>, "Carrier not in the tenant's approved list", 'Warn + require confirmation', 'manager'],
          [<Code>customs_flag</Code>, 'Customs required and broker not verified', 'Halt + escalate', 'compliance_officer'],
          [<Code>audit_trail</Code>, 'Every decision, no exceptions', 'Log to audit trail', 'automatic'],
          [<Code>schema_violation</Code>, 'Input fails JSON schema', 'Reject with structured error', 'automatic'],
        ]}
      />

      <H2>Customization by tier</H2>
      <UL
        items={[
          <><strong>Starter</strong> — Standard rules as listed above.</>,
          <><strong>Growth</strong> — Custom cost thresholds for <Code>high_cost_approval</Code>.</>,
          <><strong>Enterprise</strong> — Fully custom rules and approver role mappings.</>,
        ]}
      />

      <H2>Reading guardrail output</H2>
      <P>
        Check <Code>guardrailsFired</Code> and <Code>decision</Code> on every response. When <Code>decision</Code> is{' '}
        <Code>halted</Code> or <Code>escalated</Code>, the response includes an <Code>approval</Code> object:
      </P>
      <CodeBlock language="ts">{`{
  decision: 'halted',
  guardrailsFired: ['high_cost_approval', 'audit_trail'],
  approval: {
    approvalId:   'apr_01k…',
    requiredRole: 'finance_manager',
    reason:       'shipment.cost.total 41200 > threshold 10000',
    status:       'pending',
  },
  auditId: 'aud_01k…',
}`}</CodeBlock>
      <P>
        Resolve it through the <a className="text-[var(--brand)] no-underline hover:underline" href="/docs/api/approval">Approval Workflow</a> module.
      </P>
    </DocsPage>
  );
}
