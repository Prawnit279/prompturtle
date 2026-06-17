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

// 1. Extract structured fields from the raw BOL text
const bol = await progue.bol.extract_bol_fields({ rawText: rawBolText });
// → { bolNumber, shipperName, consigneeName, originPort, destinationPort,
//     carrierName, grossWeightKg, packageCount, freightTerms, … }

// 2. Validate the extracted fields
const validation = await progue.bol.validate_bol_data({ bolFields: bol });
if (!validation.isValid) throw new Error(\`Invalid BOL: \${validation.errors[0].message}\`);

// 3. Compare against the purchase order and raise discrepancy flags
const discrepancies = await progue.bol.flag_bol_discrepancies({
  bolFields:     bol,
  referenceDoc:  purchaseOrder,
  referenceType: 'PURCHASE_ORDER',
});

// 4. Classify the shipment's commodity for customs
const classification = await progue.hts.classify_product({
  productDescription: bol.commodityCode,
});

// 5. Get carrier rates and recommend the best option
const rates = await progue.carrier.get_carrier_rates({
  originCountry:      bol.originPort,
  destinationCountry: bol.destinationPort,
  weightKg:           bol.grossWeightKg,
});
const recommendation = await progue.carrier.recommend_carrier({
  quotes:     rates.quotes,
  priorities: { costWeight: 0.6, speedWeight: 0.4 },
});

// 6. If a guardrail halted the decision, route it for human approval
if (recommendation.decision === 'halted') {
  await progue.approval.requestApproval({
    auditId:      recommendation.auditId,
    requiredRole: 'finance_manager',
    context:      { bol, classification, recommendation },
  });
}

// Every step wrote an audit record. Retrieve the full trail:
const history = await progue.audit.getDecisionHistory({
  module: 'BOL_PROCESSING',
  from:   today,
  to:     today,
});`}</CodeBlock>
    </DocsPage>
  );
}
