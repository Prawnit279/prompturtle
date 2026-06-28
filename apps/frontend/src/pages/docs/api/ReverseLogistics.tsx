import DocsPage from '../../../components/docs/DocsPage';
import { H2, P, Code, CodeBlock, Callout, DocsTable } from '../../../components/docs/DocsPrimitives';

export default function ApiReverseLogistics() {
  return (
    <DocsPage
      section="Modules"
      title="Reverse Logistics"
      plainEnglish={
        <>
          <p>
            Returns happen. Progue&rsquo;s reverse logistics module makes them structured. Generate an RMA number,
            validate return eligibility, pick the right carrier, generate a return BOL, and trigger approval for
            high-value returns &mdash; all through the same API.
          </p>
          <p>Every return is audited. Nothing falls into a spreadsheet.</p>
        </>
      }
    >
      <H2>Overview</H2>
      <Callout>
        Namespace: <Code>progue.reverseLogistics</Code> · Module: <Code>REVERSE_LOGISTICS</Code> · External APIs: none ·{' '}
        <strong>[LIVE]</strong>
      </Callout>
      <P>
        Fully deterministic. RMA numbers, return BOL numbers, and carrier options are all generated in-house &mdash; no
        external carrier APIs are called. High-value returns reuse the same approval workflow as outbound shipments.
      </P>

      <H2>
        <Code>create_return</Code>
      </H2>
      <P>
        One call validates eligibility, generates the RMA and return BOL, presents carrier options, triggers approval if
        the value exceeds your guardrail threshold, persists the request, and writes an audit event.
      </P>
      <CodeBlock language="ts">{`const result = await progue.reverseLogistics.create_return({
  originalBolNumber: 'BOL-88231',
  returnReason: 'DAMAGED_IN_TRANSIT',
  declaredValue: 4500,
  currency: 'USD',
  urgency: 'standard',
  items: [
    { sku: 'PMP-200', description: 'Hydraulic pump',  quantity: 1, unitValue: 3200, weight: 42, condition: 'damaged' },
    { sku: 'SEAL-12', description: 'Seal kit (12pc)', quantity: 2, unitValue: 650,  weight: 1.5 },
  ],
  originAddress:      { name: 'Vendor Depot', street: '14 Industrial Way', city: 'Akron',  region: 'OH', postalCode: '44301', country: 'US' },
  destinationAddress: { name: 'Central RMA Warehouse', street: '900 Dock Rd', city: 'Memphis', region: 'TN', postalCode: '38118', country: 'US' },
});

// → {
//   rmaNumber: 'RMA-ACMELOG-20260701-0042',
//   status: 'INITIATED',
//   returnBolNumber: 'RBOL-TRK-20260701-9F3A21C7',
//   requiresApproval: false,
//   carrierOptions: [
//     { carrier: 'UPS',   serviceLevel: 'Ground',       estimatedDays: 5, estimatedCost: 27.25, currency: 'USD', recommended: false },
//     { carrier: 'FedEx', serviceLevel: 'Ground',       estimatedDays: 5, estimatedCost: 26.25, currency: 'USD', recommended: true  },
//     { carrier: 'XPO',   serviceLevel: 'LTL Standard', estimatedDays: 7, estimatedCost: 47.25, currency: 'USD', recommended: false },
//   ],
//   auditId: 'aud_01k…',
//   createdAt: '2026-07-01T14:22:09.114Z',
// }`}</CodeBlock>

      <H2>High-value return</H2>
      <P>
        When <Code>declaredValue</Code> exceeds your tenant&rsquo;s guardrail <Code>costThreshold</Code> (default
        $10,000), the return is still created with status <Code>INITIATED</Code>, but an approval request is opened and
        its id returned as <Code>approvalId</Code>. The return waits on a <Code>finance_manager</Code> decision.
      </P>
      <CodeBlock language="ts">{`const result = await progue.reverseLogistics.create_return({
  returnReason: 'QUALITY_ISSUE',
  declaredValue: 15000,
  items: [{ sku: 'CNC-9', description: 'CNC spindle', quantity: 1, unitValue: 15000, weight: 65 }],
  originAddress:      { /* … */ },
  destinationAddress: { /* … */ },
});

// → {
//   rmaNumber: 'RMA-ACMELOG-20260701-0043',
//   status: 'INITIATED',
//   returnBolNumber: 'RBOL-TRK-20260701-2B7E10D4',
//   requiresApproval: true,
//   approvalId: 'apr_01k…',          // ties to the approval workflow
//   carrierOptions: [ /* … */ ],
//   auditId: 'aud_01k…',
//   createdAt: '2026-07-01T14:40:55.882Z',
// }`}</CodeBlock>

      <H2>
        <Code>validate_return_eligibility</Code>
      </H2>
      <P>Check eligibility without persisting anything. Rules are evaluated in order and return on the first failure.</P>
      <CodeBlock language="ts">{`// Eligible — an order cancellation under the $50,000 cap
await progue.reverseLogistics.validate_return_eligibility({
  returnReason: 'ORDER_CANCELLED',
  declaredValue: 45000,
  items: [{ sku: 'X', description: 'Bulk order', quantity: 100, unitValue: 450 }],
});
// → { eligible: true, requiresApproval: true,
//     approvalNote: 'Return value exceeds $10,000 threshold — finance_manager approval required' }

// Ineligible — ORDER_CANCELLED over the $50,000 cap
await progue.reverseLogistics.validate_return_eligibility({
  returnReason: 'ORDER_CANCELLED',
  declaredValue: 60000,
  items: [{ sku: 'X', description: 'Bulk order', quantity: 100, unitValue: 600 }],
});
// → { eligible: false, requiresApproval: false,
//     reason: 'ORDER_CANCELLED returns are limited to declared values under $50,000; route large cancellations through your account manager' }`}</CodeBlock>
      <Callout>
        <Code>requiresApproval</Code> is independent of the cancellation cap: any eligible return whose value exceeds your
        guardrail <Code>costThreshold</Code> is flagged for approval.
      </Callout>

      <H2>
        <Code>route_return</Code>
      </H2>
      <P>
        Returns 2&ndash;3 carrier options for the given urgency, priced by base rate plus weight (
        <Code>$0.05/lb</Code>) plus a 15% insurance surcharge above $10,000. The lowest-cost option is marked{' '}
        <Code>recommended</Code>.
      </P>
      <CodeBlock language="ts">{`await progue.reverseLogistics.route_return({
  declaredValue: 1200,
  urgency: 'critical',
  items: [{ sku: 'X', description: 'Part', quantity: 1, unitValue: 1200, weight: 10 }],
});
// → { carrierOptions: [
//     { carrier: 'FedEx', serviceLevel: 'Priority Overnight', estimatedDays: 1, estimatedCost: 195.5, currency: 'USD', recommended: false },
//     { carrier: 'UPS',   serviceLevel: 'Next Day Air',       estimatedDays: 1, estimatedCost: 185.5, currency: 'USD', recommended: true  },
//   ] }`}</CodeBlock>

      <H2>
        <Code>get_return_status</Code>
      </H2>
      <P>Fetch a return by its RMA number. Tenant-scoped &mdash; another tenant&rsquo;s RMA returns a 404.</P>
      <CodeBlock language="ts">{`await progue.reverseLogistics.get_return_status({ rmaNumber: 'RMA-ACMELOG-20260701-0042' });
// → {
//   rmaNumber: 'RMA-ACMELOG-20260701-0042',
//   status: 'INITIATED',
//   returnReason: 'DAMAGED_IN_TRANSIT',
//   originalBolNumber: 'BOL-88231',
//   items: [ /* … */ ],
//   declaredValue: 4500,
//   currency: 'USD',
//   urgency: 'standard',
//   returnBolNumber: 'RBOL-TRK-20260701-9F3A21C7',
//   createdAt: '2026-07-01T14:22:09.114Z',
//   updatedAt: '2026-07-01T14:22:09.114Z',
// }`}</CodeBlock>

      <H2>
        <Code>cancel_return</Code>
      </H2>
      <P>
        Cancellation is allowed only from <Code>INITIATED</Code> or <Code>APPROVED</Code>. Any later (terminal-ish)
        status is rejected.
      </P>
      <CodeBlock language="ts">{`// Success: INITIATED → CANCELLED
await progue.reverseLogistics.cancel_return({ rmaNumber: 'RMA-ACMELOG-20260701-0042' });
// → { rmaNumber: '…', status: 'CANCELLED', … }

// Error: the return is already IN_TRANSIT
await progue.reverseLogistics.cancel_return({ rmaNumber: 'RMA-ACMELOG-20260701-0040' });
// → throws: Return 'RMA-…-0040' cannot be cancelled from status IN_TRANSIT`}</CodeBlock>

      <H2>RMA number format</H2>
      <Callout>
        <Code>RMA-{'{TENANTSLUG}'}-{'{YYYYMMDD}'}-{'{NNNN}'}</Code> &mdash; e.g.{' '}
        <Code>RMA-ACMELOG-20260701-0042</Code>
      </Callout>
      <P>
        Unique, tenant-scoped, and sortable by date. The sequence is the count of that tenant&rsquo;s returns created the
        same day, plus one, zero-padded to four digits.
      </P>

      <H2>Return reasons</H2>
      <DocsTable
        head={['Reason', 'Condition']}
        rows={[
          [<Code>DAMAGED_IN_TRANSIT</Code>, 'No value limit'],
          [<Code>WRONG_ITEM_SHIPPED</Code>, 'No value limit'],
          [<Code>QUALITY_ISSUE</Code>, 'No value limit'],
          [<Code>ORDER_CANCELLED</Code>, 'Eligible only if declaredValue is under $50,000'],
          [<Code>EXCESS_INVENTORY</Code>, 'No value limit'],
          [<Code>SPECIFICATION_MISMATCH</Code>, 'No value limit'],
        ]}
      />

      <H2>Status lifecycle</H2>
      <DocsTable
        head={['Stage', 'Status']}
        rows={[
          ['Created', <Code>INITIATED</Code>],
          ['Approved (high-value)', <Code>APPROVED</Code>],
          ['Carrier selected', <Code>CARRIER_ASSIGNED</Code>],
          ['Shipping back', <Code>IN_TRANSIT</Code>],
          ['Arrived at warehouse', <Code>RECEIVED</Code>],
          ['Closed out', <Code>PROCESSED</Code>],
        ]}
      />
      <P>
        <Code>CANCELLED</Code> is reachable only from <Code>INITIATED</Code> or <Code>APPROVED</Code>.
      </P>
    </DocsPage>
  );
}
