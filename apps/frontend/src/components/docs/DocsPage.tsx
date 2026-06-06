import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

/**
 * Per-page wrapper: breadcrumb → title → "Plain English" callout → content.
 * The Plain English block renders for ALL readers, in a distinct callout,
 * above the technical content (per DOCS_CONTENT.md).
 */

interface DocsPageProps {
  /** Sidebar section this page belongs to, shown in the breadcrumb. */
  section?: string;
  /** Page title (h1). */
  title: string;
  /** Plain-English intro — string or rich nodes. */
  plainEnglish: ReactNode;
  children: ReactNode;
}

export default function DocsPage({ section, title, plainEnglish, children }: DocsPageProps) {
  return (
    <article>
      {/* Breadcrumb */}
      <nav className="mb-3 flex items-center gap-1.5 font-[family-name:var(--mono)] text-[11px] text-[var(--text-3)]">
        <Link to="/docs" className="no-underline text-[var(--text-3)] hover:text-[var(--text-2)] transition-colors">
          Docs
        </Link>
        {section && (
          <>
            <span aria-hidden>/</span>
            <span className="text-[var(--text-2)]">{section}</span>
          </>
        )}
      </nav>

      {/* Title */}
      <h1 className="text-[28px] font-medium tracking-[-0.02em] text-[var(--text)] mb-5">{title}</h1>

      {/* Plain English callout */}
      <div className="mb-8 rounded-r-lg border-l-4 border-[var(--info)] bg-[var(--surface-raised)] p-4">
        <p className="mb-2 font-[family-name:var(--mono)] text-[10px] uppercase tracking-[0.1em] text-[var(--info)]">
          Plain English
        </p>
        <div className="text-[14px] leading-7 text-[var(--text-2)] [&>p]:mb-3 [&>p:last-child]:mb-0">
          {typeof plainEnglish === 'string' ? <p>{plainEnglish}</p> : plainEnglish}
        </div>
      </div>

      {/* Technical content */}
      <div>{children}</div>
    </article>
  );
}
