import type { ReactNode } from 'react';

/**
 * Shared presentational primitives for docs pages.
 * Tailwind utilities only (dark design tokens via arbitrary `var(--token)`
 * values) — keeps the 25 page components DRY and visually consistent.
 */

interface ChildrenProps {
  children: ReactNode;
}

/** Section sub-heading (h2). */
export function H2({ children }: ChildrenProps) {
  return (
    <h2 className="text-[var(--text)] text-[17px] font-medium tracking-[-0.01em] mt-10 mb-3">
      {children}
    </h2>
  );
}

/** Body paragraph. */
export function P({ children }: ChildrenProps) {
  return <p className="text-[var(--text-2)] text-[15px] leading-7 mb-4">{children}</p>;
}

/** Inline code. */
export function Code({ children }: ChildrenProps) {
  return (
    <code className="bg-[var(--surface-raised)] text-[var(--text)] px-1.5 py-0.5 rounded text-[0.85em] font-[family-name:var(--mono)]">
      {children}
    </code>
  );
}

/** Fenced code block. `language` is shown as a small label only. */
export function CodeBlock({ children, language }: { children: ReactNode; language?: string }) {
  return (
    <div className="mb-5">
      {language && (
        <div className="font-[family-name:var(--mono)] text-[10px] uppercase tracking-[0.08em] text-[var(--text-3)] mb-1.5">
          {language}
        </div>
      )}
      <pre className="bg-[var(--bg)] border border-[var(--border)] rounded-lg p-4 overflow-x-auto text-[12.5px] leading-relaxed font-[family-name:var(--mono)] text-[var(--text)]">
        <code>{children}</code>
      </pre>
    </div>
  );
}

/** Unordered list. */
export function UL({ items }: { items: ReactNode[] }) {
  return (
    <ul className="mb-5 space-y-2">
      {items.map((item, i) => (
        <li key={i} className="text-[var(--text-2)] text-[15px] leading-7 pl-4 relative">
          <span className="absolute left-0 top-0 text-[var(--brand)]">·</span>
          {item}
        </li>
      ))}
    </ul>
  );
}

/** Ordered list. */
export function OL({ items }: { items: ReactNode[] }) {
  return (
    <ol className="mb-5 space-y-2 list-decimal list-inside marker:text-[var(--text-3)] marker:font-[family-name:var(--mono)]">
      {items.map((item, i) => (
        <li key={i} className="text-[var(--text-2)] text-[15px] leading-7">
          {item}
        </li>
      ))}
    </ol>
  );
}

/** Data table. */
export function DocsTable({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="mb-6 overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-[var(--surface-raised)]">
            {head.map((h, i) => (
              <th
                key={i}
                className="border border-[var(--border)] text-left px-3 py-2 font-medium text-[var(--text)] text-[12.5px]"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  className="border border-[var(--border)] px-3 py-2 align-top text-[var(--text-2)] text-[13px] leading-6"
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Status / aside callout (e.g. "planned", sandbox note). */
export function Callout({ children, tone = 'note' }: { children: ReactNode; tone?: 'note' | 'warn' }) {
  const border = tone === 'warn' ? 'border-[var(--warning)]' : 'border-[var(--info)]';
  return (
    <div
      className={`mb-6 rounded-r-lg p-3.5 border-l-4 ${border} bg-[var(--surface-raised)] text-[14px] leading-6 text-[var(--text-2)]`}
    >
      {children}
    </div>
  );
}

/** "What's next" style link list. */
export function NextLinks({ links }: { links: Array<{ label: string; href: string; desc?: string }> }) {
  return (
    <div className="mt-8 grid gap-2 sm:grid-cols-2">
      {links.map((l) => (
        <a
          key={l.href}
          href={l.href}
          className="block rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3.5 no-underline transition-colors hover:border-[var(--border-strong)]"
        >
          <span className="block text-[14px] font-medium text-[var(--text)]">{l.label}</span>
          {l.desc && <span className="mt-1 block text-[12.5px] leading-5 text-[var(--text-3)]">{l.desc}</span>}
        </a>
      ))}
    </div>
  );
}
