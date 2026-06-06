import DocsPage from '../../../components/docs/DocsPage';
import { H2, P, OL } from '../../../components/docs/DocsPrimitives';

export default function ConceptsOverview() {
  return (
    <DocsPage
      section="Core concepts"
      title="How Progue Works"
      plainEnglish={
        <>
          <p>
            When your product needs to make a supply chain decision — classifying a product for customs, comparing
            carrier rates, deciding whether a shipment needs human approval — your code sends one request to Progue.
            Progue does everything else: validates the input, consults the AI model, checks the guardrail rules, writes
            an audit record, and returns a structured answer.
          </p>
          <p>
            You never manage an AI model, a vector database, a rules engine, or a compliance log. Those are the parts
            most teams spend four to six weeks building themselves. Progue ships them as a managed API.
          </p>
        </>
      }
    >
      <H2>The two layers</H2>
      <P>
        <strong>Context Engine</strong> — the API your code calls. This is the only surface your integration touches.
        It handles schema validation, MCP server routing, model calls, guardrail evaluation, and the audit write.
      </P>
      <P>
        <strong>Dashboard</strong> — where humans manage API keys, review call logs, track usage, and handle billing.
        No end-user UI. Your customers never see it.
      </P>

      <H2>What you provide, what Progue runs</H2>
      <P>You provide: an API key and a typed request for one decision.</P>
      <P>Progue runs:</P>
      <OL
        items={[
          'Schema validation — reject malformed input before the model runs',
          'Tenant injection — bind the request to your account',
          'Guardrail checks — halt, warn, or escalate if a rule fires',
          'Model call — Claude, through the cost tracker',
          'Audit write — permanent record before the response returns',
          'Return — typed result with auditId',
        ]}
      />
    </DocsPage>
  );
}
