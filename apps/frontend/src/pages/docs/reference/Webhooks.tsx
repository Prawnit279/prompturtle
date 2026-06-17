import DocsPage from '../../../components/docs/DocsPage';
import { H2, P, Code, CodeBlock, Callout, DocsTable } from '../../../components/docs/DocsPrimitives';

export default function ReferenceWebhooks() {
  return (
    <DocsPage
      section="Reference"
      title="Webhooks"
      plainEnglish={
        <>
          <p>
            Webhooks let Progue notify your system the moment something happens — an approval is resolved, a guardrail
            halts a decision, or you cross a usage threshold. Instead of your code polling Progue on a timer to ask
            &ldquo;has anything changed?&rdquo;, Progue makes an HTTP request to a URL you register the instant the event
            occurs.
          </p>
          <p>
            Use webhooks when you need your own product&rsquo;s UI to reflect an approval outcome or a halt in real time,
            rather than minutes later on the next poll.
          </p>
        </>
      }
    >
      <H2>Overview</H2>
      <Callout>
        Namespace: <Code>progue.webhooks</Code> · External APIs: none · <strong>[LIVE]</strong>
      </Callout>
      <P>
        Register an endpoint, subscribe it to one or more event types, and Progue POSTs a signed JSON payload to it
        whenever a matching event fires. Deliveries are signed with HMAC-SHA256, retried with exponential backoff, and
        recorded in an immutable per-endpoint delivery log.
      </P>
      <DocsTable
        head={['Event', 'Fires when']}
        rows={[
          [<Code>approval.approved</Code>, 'A pending approval request is resolved as approved'],
          [<Code>approval.rejected</Code>, 'A pending approval request is resolved as rejected'],
          [<Code>approval.expired</Code>, 'A pending approval is auto-expired after 72 hours with no decision'],
          [<Code>decision.halted</Code>, 'A guardrail rule halts a tool call (cost, customs, schema, etc.)'],
          [<Code>decision.escalated</Code>, 'An approval request is escalated to a higher approver role'],
          [<Code>usage.threshold_reached</Code>, 'Monthly call usage crosses 80% or 100% of the tier limit'],
        ]}
      />

      <H2>Registering an endpoint</H2>
      <P>
        In the dashboard, go to <Code>Webhooks &rarr; Add endpoint</Code>. Enter an <Code>https://</Code> URL,
        optionally a description, and check the events you want. On save, the signing <strong>secret is shown exactly
        once</strong> in a copy-once dialog — copy it immediately; it is never displayed again.
      </P>
      <CodeBlock language="ts">{`// POST /api/webhooks
const res = await fetch('https://api.progue.ai/api/webhooks', {
  method: 'POST',
  headers: { Authorization: \`Bearer \${jwt}\`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    url: 'https://your-app.com/webhooks/progue',
    events: ['approval.approved', 'decision.halted', 'usage.threshold_reached'],
    description: 'Production order service',
  }),
});

// 201 Created — secret is returned ONLY here, never again:
// {
//   webhook: {
//     id: 'wh_…',
//     url: 'https://your-app.com/webhooks/progue',
//     events: ['approval.approved', 'decision.halted', 'usage.threshold_reached'],
//     description: 'Production order service',
//     isActive: true,
//     createdAt: '2026-06-13T…Z',
//     secret: 'a1b2…'   // 64 hex chars — store it now
//   }
// }`}</CodeBlock>
      <P>
        <Code>GET /api/webhooks</Code>, <Code>PATCH /api/webhooks/:id</Code>, and the delivery log never return the
        secret. <Code>DELETE /api/webhooks/:id</Code> is a soft delete — it sets <Code>isActive: false</Code> and
        preserves delivery history.
      </P>

      <H2>Verifying signatures</H2>
      <P>
        Every delivery carries an <Code>X-Progue-Signature</Code> header in the form{' '}
        <Code>t=&#123;timestamp&#125;,v1=&#123;signature&#125;</Code>, where <Code>signature</Code> is{' '}
        <Code>HMAC-SHA256(secret, `$&#123;timestamp&#125;.$&#123;rawBody&#125;`)</Code>, hex-encoded. Compute the same
        HMAC over the raw request body and compare:
      </P>
      <CodeBlock language="ts">{`import { createHmac, timingSafeEqual } from 'crypto';

function verifyProgueSignature(rawBody: string, header: string, secret: string): boolean {
  const parts = Object.fromEntries(header.split(',').map((kv) => kv.split('=') as [string, string]));
  const expected = createHmac('sha256', secret)
    .update(\`\${parts.t}.\${rawBody}\`)
    .digest('hex');

  const a = Buffer.from(expected);
  const b = Buffer.from(parts.v1 ?? '');
  return a.length === b.length && timingSafeEqual(a, b);
}`}</CodeBlock>
      <Callout tone="warn">
        Use the <strong>raw</strong> request body (before JSON parsing) when computing the HMAC — re-serializing parsed
        JSON can change the bytes and break verification.
      </Callout>

      <H2>Retry policy</H2>
      <P>
        Delivery is attempted immediately; each failure (a non-2xx response or a 10-second timeout) schedules the next
        attempt with exponential backoff.
      </P>
      <DocsTable
        head={['Attempt', 'Delay before attempt', 'Total elapsed']}
        rows={[
          ['1', 'immediate', '0s'],
          ['2', '5s', '5s'],
          ['3', '60s', '1m 5s'],
          ['4', '300s', '6m 5s'],
        ]}
      />
      <P>
        After the 4th failed attempt the delivery is marked <strong>permanently failed</strong> — no further retries. A
        2xx response at any attempt marks the delivery succeeded and stops the schedule. Every attempt is recorded in
        the delivery log with its status code, attempt count, and outcome.
      </P>

      <H2>Events reference</H2>
      <DocsTable
        head={['Event type', 'When it fires', 'Data fields in payload.data']}
        rows={[
          [<Code>approval.approved</Code>, 'Approval resolved approved', <Code>approvalId, status, decidedBy, note</Code>],
          [<Code>approval.rejected</Code>, 'Approval resolved rejected', <Code>approvalId, status, decidedBy, note</Code>],
          [<Code>approval.expired</Code>, 'Pending >72h, auto-expired', <Code>approvalId, trigger, expiredAfterHours</Code>],
          [<Code>decision.halted</Code>, 'Guardrail halts a tool call', <Code>rule, message, mcpServer, toolName</Code>],
          [<Code>decision.escalated</Code>, 'Approval escalated', <Code>approvalId, status, decidedBy, note</Code>],
          [<Code>usage.threshold_reached</Code>, '80% or 100% of monthly limit', <Code>threshold, callsUsed, callLimit, percentUsed, tier</Code>],
          [<Code>test.ping</Code>, 'Manual verification only', <Code>message</Code>],
        ]}
      />
      <P>Every payload shares the same envelope:</P>
      <CodeBlock language="ts">{`{
  id: 'd1f2…',           // unique delivery id
  event: 'approval.approved',
  createdAt: '2026-06-13T…Z',
  tenantId: 'org_…',
  data: { /* event-specific fields from the table above */ }
}`}</CodeBlock>

      <H2>Testing</H2>
      <P>
        Before subscribing to real events, verify your endpoint with a test ping. In the delivery drawer click{' '}
        <strong>Send test ping</strong>, or call the API:
      </P>
      <CodeBlock language="ts">{`// POST /api/webhooks/:id/test
// → { success: true, statusCode: 200 }`}</CodeBlock>
      <P>
        This sends a synthetic payload with <Code>event: 'test.ping'</Code>, signed with your endpoint&rsquo;s real
        secret, so you can confirm your server receives the request and validates the signature before any live event
        depends on it. <Code>test.ping</Code> is a manual ping only — it is not a subscribable event.
      </P>
    </DocsPage>
  );
}
