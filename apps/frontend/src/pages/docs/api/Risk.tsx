import DocsPage from '../../../components/docs/DocsPage';
import { H2, P, Code, CodeBlock, Callout, DocsTable } from '../../../components/docs/DocsPrimitives';

export default function ApiRisk() {
  return (
    <DocsPage
      section="Modules"
      title="Shipment Risk Score"
      plainEnglish={
        <>
          <p>
            Every shipment touches several modules on its way through — HTS classification, BOL compliance checks,
            carrier approval, cost thresholds, customs readiness. Each produces its own signal, but none on its own
            answers the question that matters: <em>should this shipment proceed?</em>
          </p>
          <p>
            Shipment Risk Score is the synthesis step. Feed it the outputs you already have from the other modules and
            it returns a single 0&ndash;100 risk score, a recommendation, and a per-factor breakdown explaining exactly
            why. It is a pure computation — no model call — so it is fast and deterministic, and every call writes an
            audit record, including the ones that halt.
          </p>
        </>
      }
    >
      <H2>Overview</H2>
      <Callout>
        Namespace: <Code>progue.risk</Code> · Module: <Code>RISK_SCORING</Code> · External APIs: none ·{' '}
        <strong>[LIVE]</strong>
      </Callout>
      <P>
        Combine HTS classification confidence, BOL compliance flags, carrier approval, shipment cost, and customs
        readiness into one weighted score, a recommendation, and an audited decision. All input fields are optional —
        fields you omit are scored as &ldquo;not evaluated&rdquo; and contribute a neutral or low-risk default rather
        than failing the call.
      </P>

      <H2>
        <Code>score</Code> &rarr; <Code>score_shipment</Code>
      </H2>
      <P>
        Score a shipment using whatever upstream results are available. The response carries the composite{' '}
        <Code>riskScore</Code>, a <Code>riskLevel</Code>, a <Code>recommendation</Code>, the five-factor{' '}
        <Code>breakdown</Code>, the <Code>guardrailsFired</Code> list, an <Code>auditId</Code>, and the final{' '}
        <Code>decision</Code>.
      </P>
      <CodeBlock language="ts">{`const result = await progue.risk.score_shipment({
  bolType: 'OCEAN_BOL',
  htsResult:     { hsCode: '8471.30.01', confidence: 0.92, dutyRate: '0%' },
  carrierResult: { carrier: 'Maersk', isApprovedCarrier: true, score: 88 },
  shipmentCost:  { total: 7400, currency: 'USD' },
  customsRequired: true,
  customsBroker:   { name: 'Atlas Customs Brokerage', verified: true },
  complianceFlags: [],
});

// → {
//   riskScore: 12,
//   riskLevel: 'low',
//   recommendation: 'proceed',
//   breakdown: {
//     htsConfidence:    { score: 0,  weight: 0.25, level: 'low', detail: '…', signals: ['hts_confidence_high'] },
//     complianceFlags:  { score: 0,  weight: 0.30, level: 'low', detail: '…', signals: ['compliance_clean'] },
//     carrierApproval:  { score: 0,  weight: 0.20, level: 'low', detail: '…', signals: ['carrier_approved'] },
//     costThreshold:    { score: 20, weight: 0.15, level: 'low', detail: '…', signals: ['cost_moderate'] },
//     customsReadiness: { score: 10, weight: 0.10, level: 'low', detail: '…', signals: ['customs_broker_verified'] },
//   },
//   guardrailsFired: ['audit_trail'],
//   auditId: 'aud_01jx…',
//   decision: 'accepted',
// }`}</CodeBlock>

      <P>
        A halted shipment has the same shape, but at least one factor reaches <Code>critical</Code> and{' '}
        <Code>guardrailsFired</Code> carries the rule that tripped. A single critical factor halts the shipment
        regardless of the composite <Code>riskScore</Code> — always check <Code>decision</Code> /{' '}
        <Code>recommendation</Code>, not just the number.
      </P>
      <CodeBlock language="ts">{`const result = await progue.risk.score_shipment({
  htsResult:     { hsCode: '9018.90.80', confidence: 0.95 },
  carrierResult: { carrier: 'Approved Co', isApprovedCarrier: true },
  shipmentCost:  { total: 100, currency: 'USD' },
  customsRequired: true,
  customsBroker:   { name: 'Unverified Brokers LLC', verified: false },
});

// → {
//   riskScore: 8,
//   riskLevel: 'low',
//   recommendation: 'halt',
//   breakdown: {
//     …,
//     customsReadiness: { score: 80, weight: 0.10, level: 'critical',
//                         detail: 'Customs broker Unverified Brokers LLC is unverified',
//                         signals: ['customs_broker_unverified', 'customs_flag'] },
//   },
//   guardrailsFired: ['audit_trail', 'customs_flag'],
//   auditId: 'aud_01jy…',
//   decision: 'halted',
// }`}</CodeBlock>
      <P>
        Model: none — <Code>score_shipment</Code> is pure deterministic computation, with no LLM call.
      </P>

      <H2>Risk score interpretation</H2>
      <DocsTable
        head={['Risk score band', 'Risk level', 'Recommendation', 'What to do']}
        rows={[
          [<Code>0–29</Code>, <Code>low</Code>, <Code>proceed</Code>, 'Release the shipment (decision: accepted)'],
          [<Code>30–59</Code>, <Code>medium</Code>, <Code>review</Code>, 'Route for human review (decision: escalated)'],
          [<Code>60–79</Code>, <Code>high</Code>, <Code>review</Code>, 'Strongly review before release (decision: escalated)'],
          [<Code>80–100</Code>, <Code>critical</Code>, <Code>halt</Code>, 'Block the shipment (decision: halted)'],
        ]}
      />
      <P>
        Override rule: if any single factor reaches <Code>critical</Code> (score &ge; 80) the decision is{' '}
        <Code>halted</Code> regardless of the composite score; if any factor reaches <Code>high</Code> (score &ge; 60)
        the decision is <Code>escalated</Code> even when the composite is otherwise low.
      </P>

      <H2>Factor breakdown</H2>
      <P>
        Each factor contributes a 0&ndash;100 score scaled by its weight; the weights sum to 1.0. The composite{' '}
        <Code>riskScore</Code> is the rounded weighted sum.
      </P>
      <DocsTable
        head={['Factor', 'Weight', 'What drives its score']}
        rows={[
          [<Code>htsConfidence</Code>, '0.25', 'Confidence of the HTS classification — high confidence scores low risk, missing/very-low confidence scores high'],
          [<Code>complianceFlags</Code>, '0.30', 'Highest severity among BOL compliance flags — a critical flag dominates the composite'],
          [<Code>carrierApproval</Code>, '0.20', 'Whether the carrier is on the tenant’s approved list, adjusted upward for a low reliability score'],
          [<Code>costThreshold</Code>, '0.15', 'Shipment cost relative to the $10,000 high-cost threshold'],
          [<Code>customsReadiness</Code>, '0.10', 'Whether customs is required and the broker is verified — required + unverified is critical'],
        ]}
      />
    </DocsPage>
  );
}
