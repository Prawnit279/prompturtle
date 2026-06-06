import DocsPage from '../../../components/docs/DocsPage';
import { H2, P, Code, CodeBlock, DocsTable } from '../../../components/docs/DocsPrimitives';

export default function ReferenceErrors() {
  return (
    <DocsPage
      section="Reference"
      title="Errors and Status Codes"
      plainEnglish={
        <>
          <p>
            When something goes wrong, Progue returns a structured error with a <code>code</code> field you can check
            programmatically — not just a message. This means your code can branch on error type without parsing
            strings: a <code>quota_exceeded</code> means upgrade or wait, an <code>approval_required</code> means route
            to a human, a <code>schema_violation</code> means fix the input.
          </p>
          <p>
            The <code>auditId</code> field on errors, where present, means the decision was still logged even though it
            didn&rsquo;t complete normally.
          </p>
        </>
      }
    >
      <H2>Error shape</H2>
      <CodeBlock language="ts">{`{
  error: {
    code:    'schema_violation',      // stable, machine-readable
    message: 'origin is required',   // human-readable explanation
    field:   'origin',               // present on validation errors
    auditId: 'aud_01k…',             // present when a decision was logged
  }
}`}</CodeBlock>

      <H2>HTTP status and error code reference</H2>
      <DocsTable
        head={['HTTP', 'code', 'Meaning', 'What to do']}
        rows={[
          ['400', <Code>bad_request</Code>, 'Malformed request', 'Check JSON syntax and required fields'],
          ['401', <Code>unauthorized</Code>, 'Missing or invalid key', <>Verify <Code>PROGUE_API_KEY</Code>; rotate if leaked</>],
          ['403', <Code>forbidden</Code>, 'Key valid, action not allowed', 'Check tier and module access'],
          ['422', <Code>schema_violation</Code>, 'Input failed schema validation', <>Fix the flagged <Code>field</Code>; not billed</>],
          ['402', <Code>quota_exceeded</Code>, 'Monthly call limit reached', 'Upgrade tier or wait for next billing cycle'],
          ['409', <Code>approval_required</Code>, 'Decision halted by guardrail', 'Resolve via Approval Workflow'],
          ['429', <Code>rate_limited</Code>, 'Too many requests', <>Back off; honor <Code>Retry-After</Code> header</>],
          ['500', <Code>internal_error</Code>, "Failure on Progue's side", <>Retry idempotent calls; contact support with <Code>auditId</Code></>],
          ['503', <Code>upstream_unavailable</Code>, 'External carrier or customs API is down', 'Retry with backoff'],
        ]}
      />
      <P>
        The SDK throws typed <Code>ProgueError</Code> objects with a <Code>.code</Code> property — catch and branch on{' '}
        <Code>code</Code> rather than parsing <Code>.message</Code>.
      </P>
    </DocsPage>
  );
}
