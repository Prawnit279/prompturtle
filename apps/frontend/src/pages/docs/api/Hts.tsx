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
            HTS Classifier takes a plain-language product description, searches a database of HTS codes by semantic
            similarity, and uses AI to pick the best match — returning the code, a confidence score, the reasoning
            behind it, and up to three alternative candidates. It can also validate an existing classification against
            a product description, or look up the duty rate for a known code with a pure database lookup.
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
        Namespace: <Code>progue.hts</Code> · Module: <Code>HTS_CLASSIFICATION</Code> · External APIs: none ·{' '}
        <strong>[LIVE]</strong>
      </Callout>

      <H2>
        <Code>classify_product</Code>
      </H2>
      <P>Classify a product description to an HTS code with a confidence score and reasoning.</P>
      <CodeBlock language="ts">{`const result = await progue.hts.classify_product({
  productDescription: 'Industrial servo motor, 7.5kW, water-cooled',
  context:            'Used in CNC machining equipment',
});
// → { htsCode, description, chapter, dutyRate, confidence, reasoning,
//     alternativeCodes: [{ htsCode, description, confidence, reason }],
//     warnings? }`}</CodeBlock>
      <P>
        A confidence score below your configured threshold (Growth/Enterprise) can trigger a guardrail that routes the
        classification to a human approver rather than proceeding automatically.
      </P>

      <H2>
        <Code>validate_classification</Code>
      </H2>
      <P>Check whether an existing HTS code matches a product description and surface compliance issues.</P>
      <CodeBlock language="ts">{`const result = await progue.hts.validate_classification({
  htsCode:            '8501.52',
  productDescription: 'Industrial servo motor, 7.5kW, water-cooled',
});
// → { isValid, confidence, issues: [{ severity, message }],
//     suggestedCode?, explanation }`}</CodeBlock>

      <H2>
        <Code>get_duty_rates</Code>
      </H2>
      <P>Look up the duty rate for a known HTS code — a pure database lookup, no model involved.</P>
      <CodeBlock language="ts">{`const { dutyRate, chapter, found } = await progue.hts.get_duty_rates({
  htsCode: '8501.52',
});
// → { htsCode, description, dutyRate, unit?, chapter, found }`}</CodeBlock>
    </DocsPage>
  );
}
