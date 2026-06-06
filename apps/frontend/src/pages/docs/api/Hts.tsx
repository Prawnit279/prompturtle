import DocsPage from '../../../components/docs/DocsPage';
import { H2, P, Code, CodeBlock, Callout } from '../../../components/docs/DocsPrimitives';

export default function ApiHts() {
  return (
    <DocsPage
      section="Modules"
      title="HTS Classifier"
      plainEnglish={
        <>
          <p>
            Every product traded internationally has a Harmonized Tariff System (HTS) code — a standardized number that
            determines the duty rate at the border. Getting the wrong code can delay a shipment, trigger an audit, or
            result in incorrect duty payments.
          </p>
          <p>
            HTS Classifier takes a plain-language product description and returns the correct HS code, the confidence
            level in that classification, and the applicable duty rate. For EU-bound goods, it also checks whether the
            Carbon Border Adjustment Mechanism (CBAM) applies.
          </p>
          <p>
            If your customers ship goods internationally and need automatic customs classification, this is the module
            for that.
          </p>
        </>
      }
    >
      <H2>Overview</H2>
      <Callout>
        Namespace: <Code>progue.hts</Code> · Module: <Code>HTS_CLASSIFICATION</Code> · External APIs: WCO HS database,
        CBP · <strong>[LIVE]</strong>
      </Callout>

      <H2>
        <Code>classify</Code> → <Code>classify_hs_code</Code>
      </H2>
      <P>Classify a goods description to an HS code with a confidence score.</P>
      <CodeBlock language="ts">{`const res = await progue.hts.classify({
  description: 'Industrial servo motor, 7.5kW',
  origin:      'DE',
  destination: 'US',
});
// { hsCode: '8501.52', confidence: 0.94, dutyRate: 0.025, auditId }`}</CodeBlock>
      <P>
        A confidence score below your configured threshold (Growth/Enterprise) can trigger a guardrail that routes the
        classification to a human approver rather than proceeding automatically.
      </P>

      <H2>
        <Code>getTariffRate</Code> → <Code>get_tariff_rate</Code>
      </H2>
      <P>Look up the duty/tariff rate for an HS code and destination.</P>
      <CodeBlock language="ts">{`const { dutyRate, basis } = await progue.hts.getTariffRate({
  hsCode:      '8501.52',
  destination: 'US',
});`}</CodeBlock>

      <H2>
        <Code>checkCbam</Code> → <Code>check_cbam_applicability</Code>
      </H2>
      <P>Check whether the EU Carbon Border Adjustment Mechanism applies for EU-bound goods.</P>
      <CodeBlock language="ts">{`const { cbamApplicable, notes } = await progue.hts.checkCbam({
  hsCode:      '7208.10',
  destination: 'DE',
});`}</CodeBlock>
    </DocsPage>
  );
}
