import DocsPage from '../../../components/docs/DocsPage';
import { H2, P, Code, CodeBlock, Callout, DocsTable, UL } from '../../../components/docs/DocsPrimitives';

export default function ReferenceGuardrails() {
  return (
    <DocsPage
      section="Reference"
      title="Guardrail Configuration"
      plainEnglish={
        <>
          <p>
            Every shipment that flows through Progue gets checked against a set of guardrails — rules that decide when
            to flag something for human review, when to halt a decision, and when to let it through automatically. Out
            of the box, these rules use platform defaults: any shipment over $10,000 gets flagged, any new carrier
            triggers a check, and any unverified customs broker halts the shipment.
          </p>
          <p>
            Guardrail Configuration lets you change those defaults to match your business. If your platform handles
            heavy industrial equipment where $10,000 is a routine transaction, raise the threshold to $250,000. If your
            customers only work with three approved carriers, whitelist just those three. Changes take effect
            immediately — no code deploy needed.
          </p>
        </>
      }
    >
      <H2>Overview</H2>
      <Callout>
        Base path: <Code>/api/guardrails</Code> · Auth: Clerk JWT required (all routes) · Scope: per-tenant ·{' '}
        <strong>[LIVE]</strong>
      </Callout>
      <P>
        Your configuration applies only to your own tenants and never affects other organizations. Config is read fresh
        on every guardrail evaluation, so a change is in effect on the very next decision.
      </P>

      <H2>Configurable fields</H2>
      <DocsTable
        head={['Field', 'Type', 'Default', 'What it controls']}
        rows={[
          [<Code>costThreshold</Code>, 'number (USD)', '10000', <><Code>high_cost_approval</Code> fires when <Code>shipment.cost.total</Code> exceeds this value</>],
          [<Code>approvedCarriers</Code>, 'string[]', '[]', <><Code>new_carrier_check</Code> fires when the carrier is NOT in this list. Empty = check all carriers</>],
          [<Code>requireBrokerVerify</Code>, 'boolean', 'true', <>When <Code>false</Code>, <Code>customs_flag</Code> does not fire for unverified customs brokers</>],
          [<Code>autoApproveBelow</Code>, 'number (USD)', '0 (disabled)', <>Shipments below this cost are auto-approved without entering the human approval queue. Must be less than <Code>costThreshold</Code>. Set to 0 to disable.</>],
        ]}
      />
      <Callout>
        The <Code>audit_trail</Code> and <Code>schema_violation</Code> rules are not configurable and always fire
        regardless of your settings.
      </Callout>

      <H2>Get config &rarr; GET /api/guardrails/config</H2>
      <P>
        Returns your current configuration. If you have not set a config, it returns platform defaults with{' '}
        <Code>isDefault: true</Code>.
      </P>
      <CodeBlock language="ts">{`// GET /api/guardrails/config
// Authorization: Bearer <token>

// Response — custom config
{
  "id": "clxyz123",
  "tenantId": "ten_abc",
  "costThreshold": 50000,
  "approvedCarriers": ["FedEx", "UPS", "DHL"],
  "requireBrokerVerify": true,
  "autoApproveBelow": 0,
  "updatedAt": "2026-06-18T10:00:00.000Z",
  "isDefault": false
}

// Response — no config set yet
{
  "id": "",
  "tenantId": "ten_abc",
  "costThreshold": 10000,
  "approvedCarriers": [],
  "requireBrokerVerify": true,
  "autoApproveBelow": 0,
  "updatedAt": "",
  "isDefault": true
}`}</CodeBlock>

      <H2>Update config &rarr; PATCH /api/guardrails/config</H2>
      <P>
        Partial update — only the fields you include are changed; omitted fields keep their current values. Creates the
        config record if none exists.
      </P>
      <CodeBlock language="ts">{`// PATCH /api/guardrails/config
// Raise the cost threshold and whitelist two carriers
{
  "costThreshold": 50000,
  "approvedCarriers": ["FedEx", "UPS"]
}

// Response
{
  "id": "clxyz123",
  "tenantId": "ten_abc",
  "costThreshold": 50000,
  "approvedCarriers": ["FedEx", "UPS"],
  "requireBrokerVerify": true,
  "autoApproveBelow": 0,
  "updatedAt": "2026-06-18T10:05:00.000Z",
  "isDefault": false
}

// Validation error → 422
{
  "error": "autoApproveBelow must be less than costThreshold"
}`}</CodeBlock>

      <H2>Reset to defaults &rarr; DELETE /api/guardrails/config</H2>
      <P>
        Deletes your config record. Subsequent API calls use platform defaults. Returns <Code>204 No Content</Code>.
      </P>
      <CodeBlock language="ts">{`// DELETE /api/guardrails/config
// Authorization: Bearer <token>
// → 204 No Content`}</CodeBlock>

      <H2>
        <Code>autoApproveBelow</Code> — how it works
      </H2>
      <P>
        When <Code>autoApproveBelow</Code> is greater than 0, shipments with <Code>cost.total</Code> below that value
        skip the human approval queue entirely and are approved automatically. The decision is still logged to the audit
        trail with a note that it was auto-approved by threshold config.
      </P>
      <P>
        Example: <Code>costThreshold: 100000</Code>, <Code>autoApproveBelow: 5000</Code>
      </P>
      <UL
        items={[
          <>Shipment at $3,000 &rarr; auto-approved, no human review</>,
          <>Shipment at $60,000 &rarr; enters the normal approval workflow</>,
          <>Shipment at $120,000 &rarr; <Code>high_cost_approval</Code> fires, requires finance_manager sign-off</>,
        ]}
      />
      <P>
        <Code>autoApproveBelow</Code> must always be less than <Code>costThreshold</Code>. Setting them equal or higher
        returns a <Code>422</Code>.
      </P>

      <H2>Managing config from the dashboard</H2>
      <Callout>
        The Guardrail Configuration page at <Code>/dashboard/guardrails</Code> provides a form for all four fields.
        Changes there call the same PATCH and DELETE routes documented above — no code access required to manage
        guardrail thresholds.
      </Callout>
    </DocsPage>
  );
}
