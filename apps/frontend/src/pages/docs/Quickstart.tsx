import DocsPage from '../../components/docs/DocsPage';
import { H2, P, Code, CodeBlock, Callout, NextLinks } from '../../components/docs/DocsPrimitives';

export default function Quickstart() {
  return (
    <DocsPage
      section="Getting started"
      title="Quickstart"
      plainEnglish={
        <>
          <p>
            This page gets you from nothing to a working API call in under five minutes. You&rsquo;ll install a small
            software package, set an API key, and ask Progue to classify a product&rsquo;s customs code. You&rsquo;ll
            get a real answer back — with a record of the decision attached. That record is the part that matters for
            compliance; it&rsquo;s why Progue exists.
          </p>
          <p>
            If you don&rsquo;t write code yourself, pass this page to your integration developer. The five-step flow
            here is what they need to get started.
          </p>
        </>
      }
    >
      <H2>Goal</H2>
      <P>From nothing to a classified HS code with an audit ID in under five minutes.</P>

      <H2>Step 1 — Get an API key</H2>
      <P>
        Sign in to the dashboard and create a key under <Code>API Keys → New key</Code>. Copy it immediately — the full
        value is shown only once and is stored hashed after that. Keys are scoped to your tenant; each key belongs to
        exactly one account.
      </P>
      <Callout>
        <strong>Sandbox vs live keys.</strong> Keys prefixed <Code>pgk_test_</Code> run against the sandbox — real
        responses, no billing. Keys prefixed <Code>pgk_live_</Code> bill against your plan. Start with a test key.
      </Callout>

      <H2>Step 2 — Install the SDK</H2>
      <CodeBlock language="bash">{`npm install @progue/sdk
# or: pnpm add @progue/sdk  ·  yarn add @progue/sdk`}</CodeBlock>

      <H2>Step 3 — Set your key</H2>
      <CodeBlock language="bash">{`export PROGUE_API_KEY="pgk_test_…"`}</CodeBlock>
      <P>Never put the key directly in your code or commit it to a repository. Use environment variables.</P>

      <H2>Step 4 — Make your first call</H2>
      <CodeBlock language="ts">{`import Progue from '@progue/sdk';

const progue = new Progue({ apiKey: process.env.PROGUE_API_KEY });

const res = await progue.hts.classify({
  description: 'Industrial servo motor, 7.5kW',
  origin:      'DE',
  destination: 'US',
});

console.log(res.hsCode);     // '8501.52'
console.log(res.dutyRate);   // 0.025
console.log(res.confidence); // 0.94
console.log(res.auditId);    // 'aud_01jx…'`}</CodeBlock>

      <H2>Step 5 — Confirm the decision was logged</H2>
      <P>Every call writes a permanent audit record. Pull it back immediately:</P>
      <CodeBlock language="ts">{`const record = await progue.audit.getDecisionHistory({
  auditId: res.auditId,
});`}</CodeBlock>
      <P>
        If you got an <Code>hsCode</Code> and an <Code>auditId</Code>, you&rsquo;ve made a real, guardrailed, logged
        decision. That is the full loop — schema validated, model ran, guardrails checked, audit written.
      </P>

      <H2>What&rsquo;s next</H2>
      <NextLinks
        links={[
          { label: 'Authentication', href: '/docs/authentication', desc: 'Key types, rotation, security rules' },
          { label: 'How Progue works', href: '/docs/concepts/overview', desc: 'The five-minute conceptual overview' },
          { label: 'HTS Classifier reference', href: '/docs/api/hts', desc: 'Full parameter and response reference' },
          { label: 'End-to-end BOL flow', href: '/docs/guides/bol-flow', desc: 'The flagship production workflow' },
        ]}
      />
    </DocsPage>
  );
}
