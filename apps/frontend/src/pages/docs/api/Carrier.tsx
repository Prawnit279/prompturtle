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
            This module compares shipping rates across FedEx, UPS, and XPO for a given shipment, estimates transit
            times, checks whether a carrier serves the lane, and scores each carrier against your account&rsquo;s rules.
            The score comes with a rationale and an audit ID — so when your agent recommends a carrier, the reasoning is
            on record.
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
        Namespace: <Code>progue.carrier</Code> · Module: <Code>CARRIER_RATES</Code> · External APIs: FedEx, UPS, XPO ·{' '}
        <strong>[LIVE]</strong>
      </Callout>

      <H2>
        <Code>compareRates</Code> → <Code>compare_rates</Code>
      </H2>
      <P>Compare rates across configured carriers for a shipment.</P>
      <CodeBlock language="ts">{`const { quotes } = await progue.carrier.compareRates({
  origin:       'Chicago, IL',
  destination:  'Dallas, TX',
  weightKg:     1200,
  serviceLevel: 'standard',
});
// quotes: [{ carrier, service, amount, currency, transitDays }]`}</CodeBlock>

      <H2>
        <Code>getTransitTimes</Code> → <Code>get_transit_times</Code>
      </H2>
      <P>Estimated transit times per carrier for a lane.</P>
      <CodeBlock language="ts">{`const { transit } = await progue.carrier.getTransitTimes({
  origin: 'Chicago, IL',
  destination: 'Dallas, TX',
});`}</CodeBlock>

      <H2>
        <Code>checkCarrierAvailability</Code> → <Code>check_carrier_availability</Code>
      </H2>
      <P>Whether a carrier services a lane and shipment profile.</P>
      <CodeBlock language="ts">{`const { available } = await progue.carrier.checkCarrierAvailability({
  carrier:     'XPO',
  origin:      'Chicago, IL',
  destination: 'Dallas, TX',
  weightKg:    1200,
});`}</CodeBlock>

      <H2>
        <Code>scoreCarrier</Code> → <Code>score_carrier</Code>
      </H2>
      <P>
        Score a carrier against the tenant&rsquo;s rules — cost, transit, reliability, approval status. Triggers{' '}
        <Code>new_carrier_check</Code> if the carrier isn&rsquo;t on the approved list.
      </P>
      <CodeBlock language="ts">{`const score = await progue.carrier.scoreCarrier({ carrier: 'XPO', quote });
// { score, rationale, decision, guardrailsFired, auditId }`}</CodeBlock>
    </DocsPage>
  );
}
