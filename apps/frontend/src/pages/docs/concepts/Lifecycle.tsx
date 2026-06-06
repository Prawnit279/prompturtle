import DocsPage from '../../../components/docs/DocsPage';
import { H2, P, Code } from '../../../components/docs/DocsPrimitives';

export default function ConceptsLifecycle() {
  return (
    <DocsPage
      section="Core concepts"
      title="The Context Call Lifecycle"
      plainEnglish="Every request to Progue follows the same eight steps, in the same order, every time. Understanding this helps you read error messages and trace output — if a call fails at step 2, the model never ran and you're not billed. If it halts at step 4, a guardrail stopped it and a human needs to act."
    >
      <H2>The eight steps</H2>

      <P>
        <strong>1 · Authenticate</strong>
        <br />
        The bearer key resolves to a <Code>tenant_id</Code>. An invalid or revoked key fails here with <Code>401</Code>.
        The request goes no further.
      </P>
      <P>
        <strong>2 · Validate schema</strong>
        <br />
        The request is checked against the tool&rsquo;s JSON schema. A bad input shape fails here with <Code>422</Code>{' '}
        and fires the <Code>schema_violation</Code> guardrail. The model never runs; the call doesn&rsquo;t count toward
        billing.
      </P>
      <P>
        <strong>3 · Inject tenant</strong>
        <br />
        The resolved <Code>tenant_id</Code> is bound to the call. All memory lookups, guardrail rules, and the audit
        write will be scoped to your account from this point.
      </P>
      <P>
        <strong>4 · Pre-call guardrails</strong>
        <br />
        Rules that can halt before anything acts — <Code>high_cost_approval</Code>, <Code>customs_flag</Code> —
        evaluate here. A halt returns <Code>decision: 'halted'</Code> with the reason and the required approver role.
        The model does not run.
      </P>
      <P>
        <strong>5 · Model call</strong>
        <br />
        The relevant MCP server runs and calls the model through the cost tracker, which attributes token usage to your
        tenant. Claude Opus for complex decisions, Sonnet for lighter ones.
      </P>
      <P>
        <strong>6 · Post-call guardrails</strong>
        <br />
        Rules that evaluate the model&rsquo;s output — <Code>new_carrier_check</Code> — fire here.
      </P>
      <P>
        <strong>7 · Audit write</strong>
        <br />
        The decision, inputs, outputs, tokens, latency, and which guardrails fired are written to the audit trail. This
        happens before the response returns to you. Nothing your agent does is fire-and-forget.
      </P>
      <P>
        <strong>8 · Return</strong>
        <br />A typed result with <Code>auditId</Code>, <Code>decision</Code>, and <Code>guardrailsFired</Code>.
      </P>
    </DocsPage>
  );
}
