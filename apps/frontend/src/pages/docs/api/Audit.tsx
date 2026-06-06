import DocsPage from '../../../components/docs/DocsPage';
import { H2, P, Code, CodeBlock, Callout } from '../../../components/docs/DocsPrimitives';

export default function ApiAudit() {
  return (
    <DocsPage
      section="Modules"
      title="Audit Trail"
      plainEnglish={
        <>
          <p>
            Every decision Progue makes — whether it was accepted, halted, or escalated — is written to a permanent
            log. This log is what you pull when a customer asks &ldquo;what did your AI decide, and why?&rdquo; or when
            an auditor asks for records. It includes the inputs, outputs, which rules fired, which model ran, and how
            long it took.
          </p>
          <p>You don&rsquo;t need to build this logging yourself. Every call writes to it automatically.</p>
        </>
      }
    >
      <H2>Overview</H2>
      <Callout>
        Namespace: <Code>progue.audit</Code> · Module: <Code>AUDIT_TRAIL</Code> · External APIs: Supabase (storage) ·{' '}
        <strong>[LIVE]</strong>
      </Callout>
      <P>
        Retention: 30 days (Starter) · 90 days (Growth) · 1 year (Enterprise). Export before your retention window
        closes or before cancelling.
      </P>

      <H2>
        <Code>logDecision</Code> → <Code>log_decision</Code>
      </H2>
      <P>
        Decisions are logged automatically. Use this only to add an out-of-band decision your own code made that should
        live in the same trail.
      </P>
      <CodeBlock language="ts">{`await progue.audit.logDecision({
  module:   'CARRIER_RATES',
  decision: 'accepted',
  detail:   { … },
});`}</CodeBlock>

      <H2>
        <Code>getDecisionHistory</Code> → <Code>get_decision_history</Code>
      </H2>
      <P>Retrieve a single record by <Code>auditId</Code>, or query a tenant&rsquo;s history with filters.</P>
      <CodeBlock language="ts">{`// Single record:
const record = await progue.audit.getDecisionHistory({ auditId: 'aud_01k…' });

// Filtered history:
const history = await progue.audit.getDecisionHistory({
  module:   'HTS_CLASSIFICATION',
  from:     '2026-05-01',
  to:       '2026-05-31',
  decision: 'halted',
  limit:    100,
});`}</CodeBlock>

      <H2>
        <Code>exportAuditReport</Code> → <Code>export_audit_report</Code>
      </H2>
      <P>Export a date-ranged, filterable report for compliance or a customer request.</P>
      <CodeBlock language="ts">{`const report = await progue.audit.exportAuditReport({
  from:   '2026-05-01',
  to:     '2026-05-31',
  format: 'csv', // 'csv' | 'json'
});
// { url, expiresAt }  — signed, time-limited download link`}</CodeBlock>
    </DocsPage>
  );
}
