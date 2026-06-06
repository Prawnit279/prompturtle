import DocsPage from '../../../components/docs/DocsPage';
import { H2, P } from '../../../components/docs/DocsPrimitives';

export default function ConceptsMemory() {
  return (
    <DocsPage
      section="Core concepts"
      title="Memory"
      plainEnglish={
        <>
          <p>
            Progue remembers past decisions for each of your customers. When a new decision comes in, Progue can look
            back at similar past decisions and use that history to give a more consistent answer. For example, if a
            product has been classified at the same HS code three times before, Progue factors that in.
          </p>
          <p>This happens automatically. You don&rsquo;t manage it or configure it.</p>
        </>
      }
    >
      <H2>How it works</H2>
      <P>
        Per-tenant semantic memory is stored in pgvector with 1,536-dimension embeddings. As decisions accrue,
        they&rsquo;re indexed. Retrieval is scoped to the tenant — one customer&rsquo;s history never informs
        another&rsquo;s decision.
      </P>
      <P>
        Memory is written automatically as decisions occur; you don&rsquo;t manage embeddings or write memory calls.
      </P>
    </DocsPage>
  );
}
