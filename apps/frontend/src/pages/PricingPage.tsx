import LandingLayout  from './landing/LandingLayout';
import PricingSection from './landing/sections/PricingSection';

const FAQ = [
  {
    q: 'Can I upgrade or downgrade my plan at any time?',
    a: 'Yes. Plan changes take effect at the start of the next billing cycle. Unused capacity does not roll over.',
  },
  {
    q: 'What happens if I exceed my monthly call limit?',
    a: 'Calls over the limit return a 429 with a Retry-After header. Upgrade at any time to unlock higher limits immediately.',
  },
  {
    q: 'Is there a free trial?',
    a: 'Start on Starter and get API key access immediately. Contact us if you need a sandbox environment before committing.',
  },
  {
    q: 'What counts as a "call"?',
    a: 'One tool invocation to any Phase 1 module (BOL, Carrier Rates, HTS Classifier, Approval Workflow, Audit Trail). Reads from the audit log do not count.',
  },
  {
    q: 'Do Enterprise plans include custom modules?',
    a: 'Yes. Enterprise customers can work with us to build new MCP server modules for their specific use case.',
  },
] as const;

export default function PricingPage() {
  return (
    <LandingLayout>
      <div className="px-6 pt-20 pb-4">
        <div className="max-w-5xl mx-auto">
          <p className="font-mono text-2xs tracking-[0.2em] uppercase mb-4" style={{ color: 'var(--text-3)' }}>
            PRICING
          </p>
          <h1 className="text-[28px] md:text-[44px] font-medium leading-tight mb-3" style={{ color: 'var(--text)' }}>
            Simple, transparent pricing.
          </h1>
          <p className="text-lg mb-0" style={{ color: 'var(--text-2)' }}>
            Self-serve on Starter or Growth. Talk to us for Enterprise.
          </p>
        </div>
      </div>

      <PricingSection />

      {/* FAQ */}
      <section className="px-6 py-20 border-t" style={{ borderColor: 'var(--border)' }}>
        <div className="max-w-3xl mx-auto">
          <h2 className="text-[22px] font-medium mb-10" style={{ color: 'var(--text)' }}>
            Frequently asked questions
          </h2>
          <div className="space-y-0">
            {FAQ.map((item, i) => (
              <div
                key={i}
                className="py-6 border-b"
                style={{ borderColor: 'var(--border)' }}
              >
                <p className="text-sm font-medium mb-2" style={{ color: 'var(--text)' }}>{item.q}</p>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-2)' }}>{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </LandingLayout>
  );
}
