import DocsPage from '../../../components/docs/DocsPage';
import { H2, Code, UL } from '../../../components/docs/DocsPrimitives';

export default function ReferenceVersioning() {
  return (
    <DocsPage
      section="Reference"
      title="Versioning and Changelog"
      plainEnglish={
        <>
          <p>
            The API version is part of every URL (<code>/v1/…</code>). If Progue ever makes a breaking change —
            something that would require you to update your code — it ships under a new version number and the old one
            stays working. New features and new optional fields are additive and won&rsquo;t require any changes from
            you.
          </p>
          <p>Breaking changes are announced in the Changelog with migration steps, in bold, before the cutover date.</p>
        </>
      }
    >
      <H2>Rules</H2>
      <UL
        items={[
          <>
            <Code>/v1</Code> is stable. Breaking changes ship under a new version.
          </>,
          'New tools and optional response fields are additive — existing calls won’t break.',
          'Roadmap modules (Carbon, Supplier Risk, Reverse Logistics) are reserved in the schema but not callable until marked [LIVE].',
          <>
            Breaking changes appear in the{' '}
            <a className="text-[var(--brand)] no-underline hover:underline" href="/changelog">
              Changelog
            </a>{' '}
            with migration steps in <strong>bold</strong> ahead of the cutover.
          </>,
        ]}
      />
    </DocsPage>
  );
}
