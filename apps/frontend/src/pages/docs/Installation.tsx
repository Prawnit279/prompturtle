import DocsPage from '../../components/docs/DocsPage';
import { H2, P, CodeBlock } from '../../components/docs/DocsPrimitives';

export default function Installation() {
  return (
    <DocsPage
      section="Getting started"
      title="Installation"
      plainEnglish={
        <>
          <p>
            Installing Progue&rsquo;s SDK is a single command. It works with any Node.js project — the package includes
            both modern (ESM) and legacy (CommonJS) builds and full TypeScript type definitions, so it slots into
            whatever setup your team already has.
          </p>
          <p>
            If your team doesn&rsquo;t use JavaScript or TypeScript, every module is also available as a plain JSON over
            HTTPS endpoint — no SDK required. See the per-module reference for the raw request shape.
          </p>
        </>
      }
    >
      <H2>Requirements</H2>
      <P>Node.js 18 or later. The SDK ships ESM and CommonJS builds and full TypeScript types.</P>
      <CodeBlock language="bash">{`npm install @progue/sdk`}</CodeBlock>

      <H2>Importing</H2>
      <CodeBlock language="ts">{`// ESM / TypeScript
import Progue from '@progue/sdk';

// CommonJS
const Progue = require('@progue/sdk').default;`}</CodeBlock>

      <H2>Configuration</H2>
      <CodeBlock language="ts">{`const progue = new Progue({
  apiKey:     process.env.PROGUE_API_KEY, // required
  baseUrl:    'https://api.progue.ai',    // optional — override for proxies
  timeoutMs:  30_000,                    // optional — default 30 seconds
  maxRetries: 2,                         // optional — retries idempotent calls on 5xx/429
});`}</CodeBlock>
    </DocsPage>
  );
}
