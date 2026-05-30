import { useReveal } from '../../hooks/useReveal';
import { builtOnContent } from '../../content/avgstar';

function BrandMark({ name }: { name: string }): React.ReactElement {
  const marks: Record<string, React.ReactElement> = {
    'Anthropic Claude': <svg viewBox="0 0 20 20" width="18" height="18"><path d="M4 15 L8 5 L9.6 5 L13.6 15 L11.8 15 L11 12.8 L6.6 12.8 L5.8 15 Z M7.2 11.2 L10.4 11.2 L8.8 6.8 Z" fill="#D97757"/></svg>,
    'Anthropic MCP SDK': <svg viewBox="0 0 20 20" width="18" height="18"><path d="M3 14 L10 4 L17 14" stroke="#D97757" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round"/><circle cx="10" cy="14" r="1.4" fill="#D97757"/></svg>,
    'Supabase + pgvector': <svg viewBox="0 0 20 20" width="18" height="18"><path d="M11 2 L5 11 L10 11 L9 18 L15 9 L10 9 Z" fill="#3ECF8E"/></svg>,
    'Clerk': <svg viewBox="0 0 20 20" width="18" height="18"><circle cx="10" cy="10" r="3.4" fill="#6C47FF"/><path d="M14.5 5.5 A6 6 0 0 0 5.5 14.5 L7.4 12.6 A3.4 3.4 0 0 1 12.6 7.4 Z" fill="#6C47FF"/><path d="M5.5 14.5 A6 6 0 0 0 14.5 14.5 L12.6 12.6 A3.4 3.4 0 0 1 7.4 12.6 Z" fill="#6C47FF" opacity="0.6"/></svg>,
    'Stripe': <svg viewBox="0 0 20 20" width="18" height="18"><path d="M10.5 8.2 c-1.4-.5-2-.8-2-1.4 0-.5.4-.8 1.2-.8 1.1 0 2.2.4 3 .8 l.4-2.4 C12.3 4 11.2 3.8 10 3.8 c-2.4 0-4 1.3-4 3.2 0 2 1.7 2.6 3.1 3.1 1.3.4 1.8.8 1.8 1.4 0 .6-.5.9-1.4.9-1.1 0-2.6-.5-3.5-1.1 l-.4 2.5 c.9.5 2.4.9 3.9.9 2.6 0 4.2-1.2 4.2-3.3 0-2.1-1.7-2.7-3.2-3.2Z" fill="#635BFF"/></svg>,
    'Resend': <svg viewBox="0 0 20 20" width="18" height="18"><path d="M6 4 H11 a3.2 3.2 0 0 1 0 6.4 H8.5 L12.5 16 H10 L6.2 10.4 H8 V8.8 H6 Z" fill="#EAE8F0"/></svg>,
    'Vercel': <svg viewBox="0 0 20 20" width="18" height="18"><path d="M10 4 L17 16 L3 16 Z" fill="#EAE8F0"/></svg>,
    'Railway': <svg viewBox="0 0 20 20" width="18" height="18"><circle cx="10" cy="10" r="6.5" stroke="#EAE8F0" strokeWidth="1.5" fill="none"/><line x1="4" y1="10" x2="16" y2="10" stroke="#EAE8F0" strokeWidth="1.5"/><circle cx="13.5" cy="10" r="1.3" fill="#EAE8F0"/></svg>,
  };
  return marks[name] ?? <svg viewBox="0 0 20 20" width="18" height="18"><circle cx="10" cy="10" r="7" fill="var(--brand-lift)"/></svg>;
}

export default function BuiltOn(): React.ReactElement {
  const ref = useReveal();
  const c = builtOnContent;

  return (
    <section className="section veiled" ref={ref}>
      <div className="rail">
        <div className="mlabel reveal">
          <span className="sq" /><span className="num">{c.num}</span> · {c.label}
        </div>
        <div className="builton reveal">
          {c.chips.map(name => (
            <div key={name} className="brand-chip">
              <BrandMark name={name} />
              <span className="bname">{name}</span>
            </div>
          ))}
        </div>
        <p className="builton-note reveal">{c.note}</p>
      </div>
    </section>
  );
}
