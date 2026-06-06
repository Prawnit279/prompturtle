import DocsPage from '../../../components/docs/DocsPage';
import { H2, P, Code, CodeBlock, Callout } from '../../../components/docs/DocsPrimitives';

export default function ApiBol() {
  return (
    <DocsPage
      section="Modules"
      title="BOL Processor"
      plainEnglish={
        <>
          <p>
            A bill of lading (BOL) is the document that accompanies a shipment — it lists what&rsquo;s being shipped,
            where it&rsquo;s going, who&rsquo;s carrying it, and at what weight and value. BOL Processor takes that raw
            document and turns it into a clean, structured record. Along the way it checks for compliance issues —
            missing customs data, restricted goods, unverified parties — and raises flags before the shipment moves.
          </p>
          <p>
            If you process shipments and want AI to read, validate, or flag issues in BOLs automatically, this is the
            module you start with.
          </p>
        </>
      }
    >
      <H2>Overview</H2>
      <Callout>
        Namespace: <Code>progue.bol</Code> · Module: <Code>BOL_PROCESSING</Code> · External APIs: none ·{' '}
        <strong>[LIVE]</strong>
      </Callout>
      <P>
        Turn a raw bill of lading into a validated, structured record, and raise compliance flags before the shipment
        moves.
      </P>

      <H2>
        <Code>parse</Code> → <Code>parse_bol</Code>
      </H2>
      <P>Parse raw BOL text into a structured BOL object.</P>
      <CodeBlock language="ts">{`const { bol } = await progue.bol.parse({
  raw: '<raw BOL text>',
});
// bol: { shipper, consignee, carrier, lineItems[], totals, … }`}</CodeBlock>

      <H2>
        <Code>validate</Code> → <Code>validate_bol</Code>
      </H2>
      <P>
        Validate a structured BOL against schema and business rules. Returns errors and warnings without throwing on
        soft issues.
      </P>
      <CodeBlock language="ts">{`const result = await progue.bol.validate({ bol });
// { valid: boolean, errors: [...], warnings: [...], auditId }`}</CodeBlock>

      <H2>
        <Code>extractLineItems</Code> → <Code>extract_line_items</Code>
      </H2>
      <P>Pull normalized line items (description, quantity, weight, value) from a BOL.</P>
      <CodeBlock language="ts">{`const { lineItems } = await progue.bol.extractLineItems({ bol });`}</CodeBlock>

      <H2>
        <Code>flagCompliance</Code> → <Code>flag_compliance</Code>
      </H2>
      <P>Raise compliance flags: missing customs data, restricted commodities, unverified parties.</P>
      <CodeBlock language="ts">{`const { flags } = await progue.bol.flagCompliance({ bol });
// flags: [{ code, severity, message }]`}</CodeBlock>

      <H2>Typical flow</H2>
      <P>
        <Code>parse</Code> → <Code>validate</Code> → <Code>flagCompliance</Code>, then pass clean line items to{' '}
        <Code>hts.classify</Code>.
      </P>
    </DocsPage>
  );
}
