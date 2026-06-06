import DocsPage from '../../../components/docs/DocsPage';
import { H2, P, Code, UL } from '../../../components/docs/DocsPrimitives';

export default function ConceptsMultiTenancy() {
  return (
    <DocsPage
      section="Core concepts"
      title="Multi-tenancy and Isolation"
      plainEnglish="If your product serves multiple customers, each of your customers is a separate “tenant” inside your Progue account. Progue keeps each tenant's data completely separate — their decision history, audit logs, and AI memory never mix with another tenant's. This happens automatically at the database level. You don't write any isolation code; you just create a tenant per customer and Progue handles the rest."
    >
      <H2>How isolation works</H2>
      <P>
        Row-level security is enforced at the database with a <Code>tenant_id</Code> on every row — not in application
        code. That means a bug in Progue&rsquo;s code cannot leak one tenant&rsquo;s data to another; the database
        rejects the query before any code runs.
      </P>
      <P>Key guarantees:</P>
      <UL
        items={[
          'A key resolves to exactly one tenant; every read and write is scoped to it automatically.',
          'Memory, call logs, and audit records are never shared across tenants.',
          'Cross-tenant isolation is verified with integration tests that run as a row-level database user (not a superuser, which would bypass the check silently).',
        ]}
      />

      <H2>What you need to do</H2>
      <P>
        Nothing. Create a tenant, issue a key, and call the API. You don&rsquo;t provision a schema per customer or
        write isolation logic.
      </P>
    </DocsPage>
  );
}
