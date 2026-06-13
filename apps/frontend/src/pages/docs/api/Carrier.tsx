import DocsPage from '../../../components/docs/DocsPage';
import { H2, P, Code, CodeBlock, Callout } from '../../../components/docs/DocsPrimitives';

export default function ApiCarrier() {
  return (
    <DocsPage
      section="Modules"
      title="Carrier Rates"
      plainEnglish={
        <>
          <p>
            This module produces structured freight rate estimates for a shipment, scores and ranks the resulting
            quotes on cost and speed, and recommends a carrier weighted by your priorities and constraints — with a
            rationale your agent can act on and an audit trail behind it.
          </p>
          <p>
            If you want your AI to recommend carriers based on cost, speed, and your business rules (rather than just
            showing a price list), this is the module for that.
          </p>
        </>
      }
    >
      <H2>Overview</H2>
      <Callout>
        Namespace: <Code>progue.carrier</Code> · Module: <Code>CARRIER_RATES</Code> · External APIs: none ·{' '}
        <strong>[LIVE]</strong>
      </Callout>

      <H2>
        <Code>get_carrier_rates</Code>
      </H2>
      <P>Generate structured freight rate estimates for a shipment across available carriers.</P>
      <CodeBlock language="ts">{`const rates = await progue.carrier.get_carrier_rates({
  originCountry:        'US',
  destinationCountry:   'DE',
  weightKg:             1200,
  requiredServiceLevel: 'STANDARD',
});
// → { quotes: [{ carrierId, carrierName, serviceLevel, totalCostUsd,
//       transitDays, currency, … }],
//     currency, quotedAt, cheapestCarrierId?, fastestCarrierId? }`}</CodeBlock>

      <H2>
        <Code>compare_carrier_options</Code>
      </H2>
      <P>Score and rank a set of carrier quotes on cost and speed, with pros and cons for each.</P>
      <CodeBlock language="ts">{`const { comparison, summary } = await progue.carrier.compare_carrier_options({
  quotes: rates.quotes,
  shipmentContext: {
    weightKg:           1200,
    destinationCountry: 'DE',
  },
});
// → comparison: [{ carrierId, carrierName, costScore, speedScore,
//     overallScore, pros: [...], cons: [...] }]`}</CodeBlock>

      <H2>
        <Code>recommend_carrier</Code>
      </H2>
      <P>
        Produce a weighted carrier recommendation given cost/speed priorities and business constraints — with a
        rationale and up to two alternatives.
      </P>
      <CodeBlock language="ts">{`const rec = await progue.carrier.recommend_carrier({
  quotes:      rates.quotes,
  priorities:  { costWeight: 0.6, speedWeight: 0.4 },
  constraints: { maxBudgetUsd: 5000 },
});
// → { recommendedCarrierId, recommendedCarrierName, confidence, rationale,
//     alternatives: [{ carrierId, carrierName, reason }], warnings? }`}</CodeBlock>
    </DocsPage>
  );
}
