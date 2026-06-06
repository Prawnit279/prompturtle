import DocsPage from '../../components/docs/DocsPage';
import { H2, P, Code, Callout, DocsTable } from '../../components/docs/DocsPrimitives';

export default function DocsRoadmap() {
  return (
    <DocsPage
      section="Roadmap"
      title="Roadmap Modules (Preview)"
      plainEnglish="This page previews modules Progue plans to ship after v1. They are reserved in the schema but not yet callable — nothing here is live. It's published so integration teams can see where Progue is headed and plan ahead, not so they can build against it today."
    >
      <Callout tone="warn">
        <strong>Preview — not live.</strong> The modules below are reserved in the API schema but are not callable.
        They will only respond once their reference page is marked <Code>[LIVE]</Code>. Do not build against them yet.
      </Callout>

      <H2>Reserved modules</H2>
      <DocsTable
        head={['Module', 'Namespace', 'What it will do', 'Status']}
        rows={[
          ['Carbon', <Code>progue.carbon</Code>, 'Emissions accounting for shipments and CBAM reporting support.', 'Reserved'],
          ['Supplier Risk', <Code>progue.supplier</Code>, 'Score and monitor supplier risk signals across a tenant’s network.', 'Reserved'],
          ['Reverse Logistics', <Code>progue.reverse</Code>, 'Returns routing, disposition decisions, and recovery tracking.', 'Reserved'],
        ]}
      />

      <H2>Beyond modules</H2>
      <P>
        Agent-to-agent orchestration is on the roadmap beyond v1. The architecture is designed not to block it, but it
        is not available today. As with the reserved modules, it will be documented here with a <Code>[LIVE]</Code>{' '}
        marker when it ships.
      </P>
    </DocsPage>
  );
}
