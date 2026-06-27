import DocsPage from '../../../components/docs/DocsPage';
import { H2, P, Code, CodeBlock, Callout, DocsTable } from '../../../components/docs/DocsPrimitives';

export default function ApiSupplierRisk() {
  return (
    <DocsPage
      section="Modules"
      title="Supplier Risk"
      plainEnglish={
        <>
          <p>
            Before you commit to a supplier, Progue can tell you how risky they are. Feed in their transaction history —
            delivery performance, quality records, compliance incidents, documentation accuracy — and get back a
            0&ndash;100 risk score, a recommendation (approve, review, probation, or reject), and flags for sanctions
            exposure and EU carbon border tax (CBAM) relevance.
          </p>
          <p>No manual spreadsheet, no guesswork.</p>
        </>
      }
    >
      <H2>Overview</H2>
      <Callout>
        Namespace: <Code>progue.supplierRisk</Code> · Module: <Code>SUPPLIER_RISK</Code> · External APIs: none ·{' '}
        <strong>[LIVE]</strong>
      </Callout>
      <P>
        Fully deterministic. An optional 2&ndash;3 sentence model-generated summary is added only for substantial,
        elevated-risk profiles (&ge; 10 transactions <em>and</em> a score &ge; 40); otherwise the structured output is
        the whole result.
      </P>

      <H2>
        <Code>score_supplier</Code>
      </H2>
      <CodeBlock language="ts">{`const result = await progue.supplierRisk.score_supplier({
  supplierId:    'SUP-4471',
  supplierName:  'Shenzhen Precision Components',
  countryCode:   'CN',
  hsCodesTraded: ['720810', '853710'],
  certifications: ['ISO_9001'],
  transactions: [
    { date: '2026-01-04T00:00:00Z', orderValue: 18200, currency: 'USD', deliveredOnTime: true,  qualityDefects: 0, documentAccuracy: true },
    { date: '2026-02-11T00:00:00Z', orderValue: 9400,  currency: 'USD', deliveredOnTime: false, qualityDefects: 1, documentAccuracy: true },
    { date: '2026-03-02T00:00:00Z', orderValue: 15600, currency: 'USD', deliveredOnTime: true,  qualityDefects: 0, documentAccuracy: false, complianceFlags: ['MISSING_COO'] },
    { date: '2026-03-28T00:00:00Z', orderValue: 21000, currency: 'USD', deliveredOnTime: false, qualityDefects: 2, documentAccuracy: true },
    { date: '2026-04-15T00:00:00Z', orderValue: 12800, currency: 'USD', deliveredOnTime: true,  qualityDefects: 0, documentAccuracy: true },
  ],
});

// → {
//   riskScore: 41,
//   riskLevel: 'medium',
//   recommendation: 'review',
//   breakdown: {
//     onTimeDelivery:     { score: 50, weight: 0.30, level: 'medium', detail: '60% on-time delivery', signals: ['on_time_fair'] },
//     qualityConsistency: { score: 20, weight: 0.25, level: 'low',    detail: '0.60 avg defects/shipment', signals: ['quality_good'] },
//     complianceHistory:  { score: 20, weight: 0.25, level: 'low',    detail: '1/5 transactions with compliance flags', signals: ['compliance_minor'] },
//     documentAccuracy:   { score: 25, weight: 0.15, level: 'low',    detail: '80% documentation accuracy', signals: ['docs_good'] },
//     countryRisk:        { score: 65, weight: 0.05, level: 'high',   detail: 'Country CN risk tier', signals: ['country_high'] },
//   },
//   sanctions:    { checked: true, flagged: false },
//   cbamRelevant: true,                 // 720810 → HS chapter 72 (iron/steel)
//   auditId: 'aud_01k…',
//   transactionCount: 5,
//   lookbackDays: 101,
// }`}</CodeBlock>
      <P>Model: none for the score itself — pure deterministic computation (an optional summary may use Haiku for elevated profiles).</P>

      <H2>
        <Code>get_supplier_profile</Code>
      </H2>
      <P>Quick gate check — same input, but returns only the headline fields (no factor breakdown).</P>
      <CodeBlock language="ts">{`const profile = await progue.supplierRisk.get_supplier_profile({ /* same ScoreSupplierInput */ });

// → {
//   riskLevel: 'medium',
//   recommendation: 'review',
//   sanctions: { checked: true, flagged: false },
//   cbamRelevant: true
// }`}</CodeBlock>

      <H2>
        <Code>list_certifications</Code>
      </H2>
      <P>
        Reference tool — the certification codes Progue recognizes: <Code>ISO_9001</Code>, <Code>ISO_14001</Code>,{' '}
        <Code>C_TPAT</Code>, <Code>AEO</Code>, <Code>SMETA</Code>, <Code>SA8000</Code>. (No scoring impact in v1.)
      </P>

      <H2>Risk score interpretation</H2>
      <DocsTable
        head={['Risk score', 'Level', 'Recommendation']}
        rows={[
          [<Code>0–29</Code>, <Code>low</Code>, <Code>approve</Code>],
          [<Code>30–59</Code>, <Code>medium</Code>, <Code>review</Code>],
          [<Code>60–79</Code>, <Code>high</Code>, <Code>probation</Code>],
          [<Code>80–100</Code>, <Code>critical</Code>, <Code>reject</Code>],
        ]}
      />
      <P>
        A supplier is also rejected outright if its country scores 95 (OFAC-adjacent), and dropped to at least{' '}
        <Code>probation</Code> if any single factor is <Code>critical</Code>.
      </P>

      <H2>Factor breakdown</H2>
      <DocsTable
        head={['Factor', 'Weight', 'What drives the score']}
        rows={[
          [<Code>onTimeDelivery</Code>, '0.30', '% of transactions delivered on time (fewer than 3 → "Insufficient history", score 40)'],
          [<Code>qualityConsistency</Code>, '0.25', 'Average quality defects per shipment'],
          [<Code>complianceHistory</Code>, '0.25', '% of transactions carrying compliance flags'],
          [<Code>documentAccuracy</Code>, '0.15', '% of transactions with complete, correct documentation'],
          [<Code>countryRisk</Code>, '0.05', 'Country tier (see below)'],
        ]}
      />

      <H2>Country risk tiers</H2>
      <DocsTable
        head={['Tier', 'Score', 'Example countries']}
        rows={[
          ['Low', '0 (AE: 5)', 'US, GB, DE, JP, SG, CA, AU, IL, AE'],
          ['Medium', '35', 'MX, BR, IN, VN, TH, TR, ID, ZA'],
          ['High', '65', 'CN, PK, BD, ET, KE, KZ'],
          ['Critical', '95', 'RU, BY, IR, KP, SY, CU, VE'],
        ]}
      />
      <P>Unlisted countries default to 45 (medium-high).</P>

      <H2>Sanctions and CBAM flags</H2>
      <Callout tone="warn">
        The sanctions check is a lightweight country-tier heuristic — <strong>not</strong> a live OFAC API query — and
        is labeled as such in the response (<Code>matchedList: 'OFAC-adjacent'</Code>).
      </Callout>
      <P>
        <strong>Sanctions:</strong> if the supplier&rsquo;s country is in the critical (score 95) tier,{' '}
        <Code>sanctions.flagged</Code> is <Code>true</Code>.{' '}
        <strong>CBAM:</strong> <Code>cbamRelevant</Code> is <Code>true</Code> when any traded HS code starts with a CBAM
        prefix (<Code>2523</Code>, <Code>2716</Code>, <Code>2804</Code>, <Code>3102</Code>&ndash;<Code>3105</Code>) or
        falls in HS chapters <Code>72</Code>/<Code>73</Code>/<Code>76</Code> (iron/steel, aluminum).
      </P>
    </DocsPage>
  );
}
