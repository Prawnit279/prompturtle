import DocsPage from '../../../components/docs/DocsPage';
import { H2, P, CodeBlock } from '../../../components/docs/DocsPrimitives';

export default function GuidesAuditExport() {
  return (
    <DocsPage
      section="Guides"
      title="Exporting Audit Reports"
      plainEnglish="When a customer or auditor asks to see every AI decision made on their account, you answer in one API call. This guide shows how to generate that export."
    >
      <H2>The export call</H2>
      <CodeBlock language="ts">{`const report = await progue.audit.exportAuditReport({
  from:   '2026-01-01',
  to:     '2026-03-31',
  module: 'HTS_CLASSIFICATION', // optional — omit to export all modules
  format: 'csv',                // 'csv' | 'json'
});
// report.url — signed, time-limited download link`}</CodeBlock>

      <H2>What each row contains</H2>
      <P>
        Decision · Inputs · Outputs · Model used · Token count · Latency · Guardrails fired · <code>auditId</code>
      </P>

      <H2>Retention</H2>
      <P>
        Retention follows your plan: 30 days (Starter), 90 days (Growth), 1 year (Enterprise). Export before your
        retention window closes. If you cancel, export before your cancellation takes effect.
      </P>
    </DocsPage>
  );
}
