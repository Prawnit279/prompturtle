import DocsPage from '../../../components/docs/DocsPage';
import { H2, P, Code, UL, Callout } from '../../../components/docs/DocsPrimitives';

export default function ReferenceWebhooks() {
  return (
    <DocsPage
      section="Reference"
      title="Webhooks"
      plainEnglish="Webhooks let Progue notify your system when something happens — for example, when an approval is resolved or when you're approaching your call quota. Rather than your code polling Progue repeatedly to check status, Progue sends a request to your server the moment a relevant event occurs."
    >
      <Callout tone="warn">
        <strong>Status: planned.</strong> The webhook system is not yet live. This page documents the intended design so
        integration teams can plan. Do not build against it yet.
      </Callout>

      <H2>Planned events</H2>
      <UL
        items={[
          <>
            <Code>approval.approved</Code> / <Code>approval.rejected</Code> / <Code>approval.expired</Code>
          </>,
          <>
            <Code>decision.halted</Code> / <Code>decision.escalated</Code>
          </>,
          <>
            <Code>usage.threshold_reached</Code>
          </>,
        ]}
      />
      <P>
        Each webhook will be signed. You&rsquo;ll verify the signature before processing the payload. Full payload
        shapes, signing instructions, and retry policy will be documented here when the system ships.
      </P>
    </DocsPage>
  );
}
