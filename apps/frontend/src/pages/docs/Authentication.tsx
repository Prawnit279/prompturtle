import DocsPage from '../../components/docs/DocsPage';
import { H2, P, Code, CodeBlock, UL } from '../../components/docs/DocsPrimitives';

export default function Authentication() {
  return (
    <DocsPage
      section="Getting started"
      title="Authentication"
      plainEnglish="Progue uses API keys to identify who is making a request. Think of an API key like a password for your integration — it tells Progue which account the request belongs to, so the right data, rules, and limits apply. Keep it secret. If it leaks, rotate it immediately from the dashboard; you can't recover a lost key, only replace it."
    >
      <H2>How authentication works</H2>
      <P>
        Every request to the API must include your key as a bearer token. The SDK handles this automatically; raw HTTP
        callers set the header directly.
      </P>
      <P>
        <strong>SDK:</strong>
      </P>
      <CodeBlock language="ts">{`const progue = new Progue({ apiKey: process.env.PROGUE_API_KEY });`}</CodeBlock>
      <P>
        <strong>Raw HTTP:</strong>
      </P>
      <CodeBlock language="bash">{`curl https://api.progue.ai/v1/hts/classify \\
  -H "Authorization: Bearer $PROGUE_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"description":"Servo motor, 7.5kW","origin":"DE","destination":"US"}'`}</CodeBlock>

      <H2>Key facts</H2>
      <UL
        items={[
          <>
            <strong>Two environments.</strong> <Code>pgk_test_…</Code> keys run against the sandbox — real responses,
            not billed. <Code>pgk_live_…</Code> keys are production and count against your plan.
          </>,
          <>
            <strong>Hashed at rest.</strong> The full key value is shown once at creation. After that, Progue stores
            only a hash — we can&rsquo;t read it back and neither can anyone who reaches our database.
          </>,
          <>
            <strong>One tenant per key.</strong> A key resolves to exactly one account. There is no cross-tenant key.
          </>,
          <>
            <strong>Revocation is immediate.</strong> Rotate or revoke from the dashboard under <Code>API Keys</Code>.
            A revoked key is rejected on the next request.
          </>,
          <>
            <strong>Staleness tracking.</strong> <Code>lastUsedAt</Code> is updated per key — check it to spot unused
            or potentially leaked keys.
          </>,
        ]}
      />

      <H2>Security rules</H2>
      <P>
        Never embed a key in client-side code (anything that runs in a browser), a public repository, a log file, or a
        request body. Keys belong in server-side environment configuration only.
      </P>
    </DocsPage>
  );
}
