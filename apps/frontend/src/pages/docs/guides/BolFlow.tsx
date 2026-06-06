import DocsPage from '../../../components/docs/DocsPage';
import { H2, CodeBlock } from '../../../components/docs/DocsPrimitives';

export default function GuidesBolFlow() {
  return (
    <DocsPage
      section="Guides"
      title="End-to-End BOL Flow"
      plainEnglish={
        <>
          <p>
            This is the flagship workflow: take a raw bill of lading document, process it through Progue&rsquo;s
            modules, and get a fully validated, customs-classified, carrier-scored, guardrailed, logged decision — in
            under two minutes. This is what a production integration looks like.
          </p>
          <p>If you&rsquo;re evaluating whether Progue is the right fit, this is the flow to read.</p>
        </>
      }
    >
      <H2>The full code</H2>
      <CodeBlock language="ts">{`import Progue from '@progue/sdk';
const progue = new Progue({ apiKey: process.env.PROGUE_API_KEY });

// 1. Parse the raw BOL
const { bol } = await progue.bol.parse({ raw: rawBolText });

// 2. Validate it
const v = await progue.bol.validate({ bol });
if (!v.valid) throw new Error(\`Invalid BOL: \${v.errors[0].message}\`);

// 3. Raise compliance flags
const { flags } = await progue.bol.flagCompliance({ bol });

// 4. Classify each line item for customs
const classified = await Promise.all(
  bol.lineItems.map(li =>
    progue.hts.classify({
      description: li.description,
      origin:      bol.origin,
      destination: bol.destination,
    })
  )
);

// 5. Compare carriers and score the best option
const { quotes } = await progue.carrier.compareRates({
  origin:      bol.origin,
  destination: bol.destination,
  weightKg:    bol.totals.weightKg,
});
const scored = await progue.carrier.scoreCarrier({
  carrier: quotes[0].carrier,
  quote:   quotes[0],
});

// 6. If a guardrail halted, route for human approval
if (scored.decision === 'halted') {
  await progue.approval.requestApproval({
    auditId:      scored.auditId,
    requiredRole: 'finance_manager',
    context:      { bol, quote: quotes[0] },
  });
}

// Every step wrote an audit record. Retrieve the full trail:
const history = await progue.audit.getDecisionHistory({
  from: today, to: today,
});`}</CodeBlock>
    </DocsPage>
  );
}
