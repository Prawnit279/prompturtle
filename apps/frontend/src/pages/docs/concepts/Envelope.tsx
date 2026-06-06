import DocsPage from '../../../components/docs/DocsPage';
import { H2, P, Code, CodeBlock, DocsTable } from '../../../components/docs/DocsPrimitives';

export default function ConceptsEnvelope() {
  return (
    <DocsPage
      section="Core concepts"
      title="Response Envelope and Audit IDs"
      plainEnglish="Every successful call returns two kinds of information: the answer to your question (the HS code, the carrier scores, the approval status), and a standard set of fields that appear on every call — including an audit ID. The audit ID is your permanent reference to this specific decision. Store it in your own systems so you can trace any decision end-to-end if a customer or auditor asks about it."
    >
      <H2>The response shape</H2>
      <P>Every response includes the tool&rsquo;s specific result fields plus a common envelope:</P>
      <CodeBlock language="ts">{`{
  // Tool-specific fields — for hts.classify:
  hsCode:     '8501.52',
  dutyRate:   0.025,
  confidence: 0.94,

  // Common envelope — on every response:
  auditId:       'aud_01jx…',           // permanent record for this decision
  decision:      'accepted',            // 'accepted' | 'halted' | 'escalated'
  guardrailsFired: ['audit_trail'],     // IDs of rules that fired
  module:        'HTS_CLASSIFICATION',
  model:         'claude-opus-4-6',
  usage: {
    inputTokens:  812,
    outputTokens: 392,
    latencyMs:    42,
  },
}`}</CodeBlock>

      <H2>Decision values</H2>
      <DocsTable
        head={['Value', 'Meaning']}
        rows={[
          [<Code>accepted</Code>, 'The decision proceeded normally.'],
          [
            <Code>halted</Code>,
            <>
              A guardrail stopped the decision. Check <Code>guardrailsFired</Code> and the <Code>approval</Code> object
              to see who must act before it can proceed.
            </>,
          ],
          [
            <Code>escalated</Code>,
            <>Routed to a named human role (e.g. a customs halt routed to <Code>compliance_officer</Code>).</>,
          ],
        ]}
      />

      <H2>Using auditId</H2>
      <P>
        Pass <Code>auditId</Code> to <Code>audit.getDecisionHistory</Code> to retrieve the full record. Include it in
        your own logs so any support request or compliance query can be traced end-to-end in one lookup.
      </P>
    </DocsPage>
  );
}
