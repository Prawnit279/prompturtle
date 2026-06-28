import DocsPage from '../../../components/docs/DocsPage';
import { H2, P, Code, CodeBlock, Callout, DocsTable } from '../../../components/docs/DocsPrimitives';

export default function ApiCarbon() {
  return (
    <DocsPage
      section="Modules"
      title="Carbon Footprint Tracking"
      plainEnglish={
        <>
          <p>
            As of 2026, EU importers of steel, aluminum, cement, fertilizers, and hydrogen face mandatory carbon
            reporting under CBAM (the EU Carbon Border Adjustment Mechanism). Progue calculates shipment carbon
            footprints using GLEC Framework 3.0 emission factors — the same methodology EU regulators recognize — and
            flags your HS codes for CBAM scope automatically.
          </p>
          <p>You get a kg CO₂e figure you can put in a report without doing the math yourself.</p>
        </>
      }
    >
      <H2>Overview</H2>
      <Callout>
        Namespace: <Code>progue.carbon</Code> · Module: <Code>CARBON_TRACKING</Code> · External APIs: none ·
        Methodology: GLEC Framework 3.0 · <strong>[LIVE]</strong>
      </Callout>
      <P>
        Fully deterministic: <Code>co2eKg = (weightKg / 1000) × distanceKm × emissionFactor</Code>. No external carbon
        API is called — the factors are hardcoded GLEC 3.0 constants.
      </P>

      <H2>
        <Code>calculate_footprint</Code>
      </H2>
      <P>
        When <Code>distanceKm</Code> is omitted but both country codes are supplied, distance is estimated from country
        centroids via the Haversine formula and <Code>distanceEstimated</Code> is <Code>true</Code>.
      </P>
      <CodeBlock language="ts">{`const result = await progue.carbon.calculate_footprint({
  mode: 'OCEAN',
  weightKg: 50000,
  originCountryCode: 'US',
  destinationCountryCode: 'DE',
  hsCodes: ['720810'],          // hot-rolled steel
});

// → {
//   co2eKg: 6400.0,             // 50t × ~8000km × 0.016
//   co2eTonnes: 6.4,
//   emissionFactor: 0.016,
//   transportMode: 'OCEAN',
//   weightTonnes: 50,
//   distanceKm: 8000,           // estimated from US/DE centroids
//   distanceEstimated: true,
//   cbam: {
//     inScope: true,
//     matchedCodes: ['720810'],
//     reportingNote: 'CBAM reporting required for EU imports of these goods. EU Regulation 2023/956 in force January 2026.',
//   },
//   methodology: 'GLEC Framework 3.0 — IMO GHG Study 4th edition',
//   auditId: 'aud_01k…',
// }`}</CodeBlock>

      <H2>
        <Code>compare_routes</Code>
      </H2>
      <P>Same weight and distance across modes — the lowest-emission option is flagged, with the % reduction vs the highest.</P>
      <CodeBlock language="ts">{`await progue.carbon.compare_routes({
  weightKg: 10000,
  distanceKm: 1000,
  routes: [
    { label: 'Truck', mode: 'TRUCK' },
    { label: 'Ocean', mode: 'OCEAN' },
    { label: 'Air',   mode: 'AIR' },
  ],
});

// → {
//   routes: [
//     { label: 'Truck', mode: 'TRUCK', co2eKg: 960,  isLowest: false, reductionVsHighest: 84 },
//     { label: 'Ocean', mode: 'OCEAN', co2eKg: 160,  isLowest: true,  reductionVsHighest: 97 },
//     { label: 'Air',   mode: 'AIR',   co2eKg: 6020, isLowest: false },   // highest — no reduction
//   ],
//   lowestEmissionRoute: 'Ocean',
//   highestEmissionRoute: 'Air',
//   cbam: { inScope: false, matchedCodes: [] },
//   auditId: 'aud_01k…',
// }`}</CodeBlock>

      <H2>
        <Code>get_emission_factors</Code>
      </H2>
      <P>
        Reference query — public, no auth required (<Code>GET /api/carbon/factors</Code>). Returns all five GLEC 3.0
        factors with their sources.
      </P>

      <H2>
        <Code>generate_report</Code>
      </H2>
      <P>Aggregates every <Code>calculate_footprint</Code> call in the audit trail over a date range.</P>
      <CodeBlock language="ts">{`await progue.carbon.generate_report({ from: '2026-06-01', to: '2026-06-30' });

// → {
//   tenantId: 'org_…',
//   reportPeriod: { from: '2026-06-01', to: '2026-06-30' },
//   totalShipments: 142,
//   totalCo2eKg: 318400,
//   totalCo2eTonnes: 318.4,
//   byMode: {
//     TRUCK: { shipments: 80, co2eKg: 120000 },
//     OCEAN: { shipments: 50, co2eKg: 80000 },
//     AIR:   { shipments: 12, co2eKg: 118400 },
//     RAIL:  { shipments: 0,  co2eKg: 0 },
//     BARGE: { shipments: 0,  co2eKg: 0 },
//   },
//   cbamRelevantShipments: 37,
//   methodology: 'GLEC Framework 3.0',
//   generatedAt: '2026-07-01T09:00:00.000Z',
//   auditId: 'aud_01k…',
// }`}</CodeBlock>

      <H2>Emission factors</H2>
      <DocsTable
        head={['Mode', 'Factor (kg CO₂e/tonne-km)', 'Source']}
        rows={[
          [<Code>TRUCK</Code>, '0.096', 'GLEC — EU articulated truck average'],
          [<Code>AIR</Code>, '0.602', 'ICAO Carbon Calculator'],
          [<Code>OCEAN</Code>, '0.016', 'IMO GHG Study 4th edition'],
          [<Code>RAIL</Code>, '0.028', 'GLEC — EU freight train average'],
          [<Code>BARGE</Code>, '0.031', 'GLEC — EU inland waterway average'],
        ]}
      />
      <P>
        Factors are GLEC Framework 3.0 and are hardcoded. For regulatory submissions, verify against the current GLEC
        publication.
      </P>

      <H2>CBAM scope</H2>
      <DocsTable
        head={['HS chapter / prefix', 'Commodity', 'In force since']}
        rows={[
          [<Code>72</Code>, 'Iron and steel', 'Jan 2026'],
          [<Code>73</Code>, 'Articles of iron/steel', 'Jan 2026'],
          [<Code>76</Code>, 'Aluminum and articles', 'Jan 2026'],
          [<Code>2523</Code>, 'Cement', 'Jan 2026'],
          [<Code>2716</Code>, 'Electricity', 'Jan 2026'],
          [<Code>2804</Code>, 'Hydrogen', 'Jan 2026'],
          [<Code>3102–3105</Code>, 'Fertilizers', 'Jan 2026'],
        ]}
      />
      <Callout tone="warn">
        CBAM detection is a heuristic on the HS codes you supply — it does not replace a customs determination. Source:
        EU Regulation 2023/956, Annex I.
      </Callout>

      <H2>Calculation methodology</H2>
      <P>
        <Code>co2eKg = (weightKg / 1000) × distanceKm × emissionFactor</Code>. When an exact distance is not provided,
        Progue estimates it from country centroids using the Haversine great-circle formula; unknown country pairs fall
        back to 5,000 km.
      </P>
    </DocsPage>
  );
}
