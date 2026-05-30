// Single source of truth for all Avgstar landing page copy and data.
// Future edits: change values here — components contain zero hardcoded strings.

export type BtnKind = 'btn1' | 'btn2';
export type CtaKind = 'solid' | 'ghost';
export type GlyphType = 'doc' | 'tree' | 'hex' | 'branch' | 'chain';

export interface NavContent {
  links: Array<{ label: string; to: string }>;
  cta: string;
  ctaHref: string;
}

export interface HeroContent {
  eyebrow: string;
  h1: string;
  h1mute: string;
  sub: string;
  ctas: Array<{ label: string; kind: BtnKind; href: string }>;
  stats: [string, string][];
}

export interface ProbCard {
  n: string;
  t: string;
  d: string;
  c: string; // CSS color value for left accent bar
}

export interface ProblemContent {
  num: string;
  label: string;
  h2: string;
  body: string[];
  note: string;
  cards: ProbCard[];
}

export interface DefinitionContent {
  num: string;
  label: string;
  h2: string;
  body: string;
  note: string;
  row: [string, string][];
}

export interface ModuleCard {
  n: string;
  t: string;
  d: string;
  tools: string[];
  glyph: GlyphType;
}

export interface ModulesContent {
  num: string;
  label: string;
  h2: string;
  cards: ModuleCard[];
}

export interface IntegrationContent {
  num: string;
  label: string;
  h2: string;
  engine: [string, string][];
}

export interface BuiltOnContent {
  num: string;
  label: string;
  note: string;
  chips: string[];
}

export interface GuardCard {
  k: string;
  t: string;
  d: string;
}

export interface GuardrailsContent {
  num: string;
  label: string;
  h2: string;
  cards: GuardCard[];
}

export interface PricingTierEntry {
  name: string;
  tag: string;
  amt: string;
  per: string;
  meta: string[];
  feats: string[];
  cta: string;
  ctaKind: CtaKind;
  reco: boolean;
  flag?: string;
  ctaHref: string;
}

export interface PricingContent {
  num: string;
  label: string;
  h2: string;
  sub: string;
  tiers: PricingTierEntry[];
}

export interface FinalContent {
  h2: string;
  ctas: Array<{ label: string; kind: BtnKind; href: string }>;
}

export interface FooterContent {
  tag: string;
  cols: Array<{ h: string; links: Array<{ label: string; to: string }> }>;
  base: string;
}

// ─── Content values ───────────────────────────────────────────────────────────

export const navContent: NavContent = {
  links: [
    { label: 'Solutions', to: '/solutions' },
    { label: 'Docs',      to: '/docs' },
    { label: 'Pricing',   to: '/pricing' },
    { label: 'About',     to: '/about' },
  ],
  cta:     'Get API key →',
  ctaHref: 'https://app.progue.ai/sign-up',
};

export const heroContent: HeroContent = {
  eyebrow: 'Supply chain context engineering',
  h1:      'Pre-built AI context for ',
  h1mute:  'supply chain software.',
  sub:     "MCP servers, schemas, guardrails, memory, and audit trails for the logistics execution layer. Embed Progue's API and ship domain-specific agents in a week, not six.",
  ctas: [
    { label: 'Get API key →', kind: 'btn1', href: 'https://app.progue.ai/sign-up' },
    { label: 'Read the docs', kind: 'btn2', href: '/docs' },
  ],
  stats: [
    ['5',     'modules'],
    ['90%+',  'HTS accuracy'],
    ['1 wk',  'to first agent'],
    ['99.9%', 'uptime'],
  ],
};

export const problemContent: ProblemContent = {
  num:   '01',
  label: 'Why build context from scratch',
  h2:    'Six to ten weeks of work before you ship a single decision.',
  body: [
    'Most teams budget for the model. The cost lives in everything around it — schemas, MCP tool wrappers, guardrail rules, audit logs, vector memory. All custom, all brittle, none of it your differentiator. One workflow typically burns ~$36,000 in engineering time before the first production decision.',
  ],
  note:  '// industry baseline: 6–10 engineering weeks · 1.5 FTE · $150/hr loaded',
  cards: [
    { n: '01', t: 'Schema design & validation',   d: 'BOL, carrier rate cards, HTS tables, customs flags — every input shape is a contract with the LLM.',                   c: 'var(--brand)' },
    { n: '02', t: 'Guardrail rule engineering',   d: 'Cost gates, approval triggers, compliance halts — written in code, audited per tenant.',                               c: 'var(--info)' },
    { n: '03', t: 'Vector memory + audit trail',  d: 'pgvector schemas, shipper history facts, append-only decision logs that compliance will accept.',                      c: 'var(--brand-lift)' },
  ],
};

export const definitionContent: DefinitionContent = {
  num:   '02',
  label: 'Context engineering, not prompt engineering',
  h2:    'Context engineering, not prompt engineering.',
  body:  'A context package is the complete informational environment an AI agent needs to operate: the system prompt, the data schemas it expects, the tools it can call via MCP, the memory patterns it uses, and the guardrails enforcing safe decisions. A context package for BOL processing includes all of these — not just a prompt.',
  note:  '// displaced prompt engineering as the dominant discipline',
  row: [
    ['system_prompts', 'Role + constraints'],
    ['data_schemas',   'JSON-validated inputs'],
    ['mcp_server',     'Tool interfaces'],
    ['guardrails',     'Cost + compliance gates'],
    ['memory',         'pgvector patterns'],
  ],
};

export const modulesContent: ModulesContent = {
  num:   '03',
  label: 'Phase 1 modules',
  h2:    'Built for the logistics execution layer.',
  cards: [
    { n: '01', t: 'BOL Processing',            d: 'Parse, validate, extract line items and flag compliance issues on bills of lading.',                          tools: ['parse_bol', 'validate_bol', 'extract_line_items', 'flag_compliance'],    glyph: 'doc' },
    { n: '02', t: 'Carrier Rate Comparison',   d: 'FedEx, UPS, XPO rate cards, transit times, and carrier scoring against shipper history.',                     tools: ['compare_rates', 'score_carrier', 'estimate_transit', 'apply_contract_rules'], glyph: 'tree' },
    { n: '03', t: 'HTS / Customs Classification', d: 'HS-code classification, tariff lookup, CBAM applicability, and audit-risk flagging.',                     tools: ['classify_hs_code', 'lookup_tariff', 'check_cbam', 'flag_audit_risk'],    glyph: 'hex' },
    { n: '04', t: 'Approval Workflow',          d: 'Request approval, auto-approve safe decisions, escalate the rest to the right role.',                       tools: ['request_approval', 'auto_approve_safe', 'escalate_to_role', 'record_decision'], glyph: 'branch' },
    { n: '05', t: 'Audit Trail',               d: 'Append-only decision logs, history facts, and exportable reports compliance will accept.',                   tools: ['log_decision', 'list_history', 'export_report', 'verify_chain'],         glyph: 'chain' },
  ],
};

export const integrationContent: IntegrationContent = {
  num:   '04',
  label: 'How it integrates',
  h2:    'One endpoint. Five modules. Zero infrastructure.',
  engine: [
    ['system_prompts', '/ role'],
    ['schemas',        '/ JSON'],
    ['mcp_server',     '/ tools'],
    ['guardrails',     '/ gates'],
    ['memory',         '/ pgvector'],
  ],
};

export const builtOnContent: BuiltOnContent = {
  num:   '05',
  label: 'Built on',
  note:  'Every choice serves auditability or multi-tenancy.',
  chips: ['Anthropic Claude', 'Anthropic MCP SDK', 'Supabase + pgvector', 'Clerk', 'Stripe', 'Resend', 'Vercel', 'Railway'],
};

export const guardrailsContent: GuardrailsContent = {
  num:   '06',
  label: 'Guardrails',
  h2:    'Safe decisions, enforced in code.',
  cards: [
    { k: 'cost_gate',         t: 'Cost gate',         d: 'Halt any decision above a configurable spend threshold.' },
    { k: 'approval_trigger',  t: 'Approval trigger',  d: 'Route high-risk actions to a human in the right role.' },
    { k: 'compliance_halt',   t: 'Compliance halt',   d: 'Block actions that violate tenant compliance rules.' },
    { k: 'rate_limit',        t: 'Rate limit',        d: 'Per-tenant request ceilings with burst allowance.' },
  ],
};

export const pricingContent: PricingContent = {
  num:   '07',
  label: 'Pricing',
  h2:    'Simple, transparent pricing.',
  sub:   'Self-serve for Starter and Growth. Enterprise involves a 30-minute scoping call — no procurement theater.',
  tiers: [
    {
      name: 'Starter', tag: 'eval', amt: '$149', per: '/ mo',
      meta: ['10,000 calls / mo', '10 req / min'],
      feats: ['All 5 Phase 1 modules', 'Full audit trail', 'Email support', 'Clerk-based auth'],
      cta: 'Get API key', ctaKind: 'ghost', reco: false,
      ctaHref: 'https://app.progue.ai/sign-up',
    },
    {
      name: 'Growth', tag: 'recommended', amt: '$599', per: '/ mo',
      meta: ['100,000 calls / mo', '60 req / min'],
      feats: ['All 5 Phase 1 modules', 'Full audit trail', 'Priority email support', 'Usage analytics dashboard', 'Clerk-based auth'],
      cta: 'Get API key', ctaKind: 'solid', reco: true, flag: 'most teams start here',
      ctaHref: 'https://app.progue.ai/sign-up',
    },
    {
      name: 'Enterprise', tag: 'established', amt: '$1999', per: '/ mo',
      meta: ['Unlimited', '300 req / min (2,000 burst)'],
      feats: ['All 5 Phase 1 modules', 'Full audit trail', 'Dedicated support', 'Custom guardrail rules', 'SLA guarantee', 'Custom contract'],
      cta: 'Contact us', ctaKind: 'ghost', reco: false,
      ctaHref: 'mailto:hello@progue.ai',
    },
  ],
};

export const finalContent: FinalContent = {
  h2:   'Ship your first agent this week.',
  ctas: [
    { label: 'Get API key →', kind: 'btn1', href: 'https://app.progue.ai/sign-up' },
    { label: 'Read the docs', kind: 'btn2', href: '/docs' },
  ],
};

export const footerContent: FooterContent = {
  tag:  'Context infrastructure for supply chain AI.',
  cols: [
    { h: 'Platform',   links: [{ label: 'Modules', to: '/#modules' }, { label: 'Architecture', to: '/#integration' }, { label: 'Guardrails', to: '/#guardrails' }, { label: 'Pricing', to: '/pricing' }] },
    { h: 'Developers', links: [{ label: 'Docs', to: '/docs' }, { label: 'API reference', to: '/docs#api-reference' }, { label: 'Changelog', to: '/docs#changelog' }] },
    { h: 'Company',    links: [{ label: 'About', to: '/about' }, { label: 'Contact', to: 'mailto:hello@progue.ai' }] },
    { h: 'Legal',      links: [{ label: 'Privacy', to: '/privacy' }, { label: 'Terms', to: '/terms' }, { label: 'Security', to: '/security' }] },
  ],
  base: '© 2026 Progue, Inc.',
};

// ─── Solutions & About page content ──────────────────────────────────────────

export interface SolutionSegment {
  n: string;
  t: string;
  d: string;
  c: string;
}

export interface SolutionsPageContent {
  eyebrow: string;
  h1: string;
  sub: string;
  segments: SolutionSegment[];
  faqLabel: string;
  faq: Array<{ q: string; a: string }>;
}

export const solutionsPageContent: SolutionsPageContent = {
  eyebrow: 'Solutions',
  h1:      'Built for the teams building on supply chain data.',
  sub:     'Pick the workflow that matches your product and embed it today.',
  segments: [
    { n: '01', t: 'TMS Vendors',         d: 'Add AI-powered BOL parsing, carrier scoring, and customs flagging to your TMS without building the context layer from scratch.',                        c: 'var(--brand)' },
    { n: '02', t: 'Freight Visibility',  d: 'Embed structured decision logs and audit trails that satisfy the compliance requirements your enterprise customers are starting to ask for.',          c: 'var(--info)' },
    { n: '03', t: '3PL Software',        d: 'Ship guardrailed AI workflows for high-cost shipment approval, carrier substitution, and HTS classification in days — not sprints.',                  c: 'var(--brand-lift)' },
    { n: '04', t: 'Procurement SaaS',    d: 'Give purchasing agents HTS lookup, duty rate retrieval, and customs audit chains. Enterprises demand this; Progue makes it a one-week integration.', c: 'var(--teal)' },
    { n: '05', t: 'Carrier Management',  d: 'Give operations teams AI recommendations backed by real rate comparison, configurable approval workflows, and immutable decision records.',            c: 'var(--violet)' },
  ],
  faqLabel: 'Common questions',
  faq: [
    { q: 'How long does integration take?',   a: 'Most teams ship their first tool call in under a week. The SDK wraps REST so your existing codebase does not need restructuring.' },
    { q: 'Can I use only one module?',         a: 'Yes. Modules are independent. Start with HTS classification; add Approval Workflow when you need it.' },
    { q: 'What data leaves my system?',       a: 'Only the payload you explicitly send to the API. Progue does not pull data from your warehouse or ERP.' },
    { q: 'Is there a sandbox environment?',   a: 'Every account gets a sandbox key with a separate quota. No production data required to evaluate.' },
  ],
};

export interface AboutPageContent {
  eyebrow: string;
  h1: string;
  body: string[];
  principlesLabel: string;
  principles: Array<{ n: string; t: string; d: string; c: string }>;
  contact: string;
}

export const aboutPageContent: AboutPageContent = {
  eyebrow: 'About',
  h1:      'Building the context layer for supply chain AI.',
  body: [
    'Progue started from a simple observation: every supply chain software team building AI features was reinventing the same infrastructure — schemas, guardrails, memory, audit logs. All custom, all brittle, none of it their differentiator.',
    'We built it once, made it multi-tenant, and put it behind an API. The goal is to make domain-specific AI agents in logistics faster to ship and safer to run.',
  ],
  principlesLabel: 'How we build',
  principles: [
    { n: '01', t: 'Auditability first',   d: 'Every decision Progue touches writes to an append-only log. Compliance is a first-class requirement, not an afterthought.',     c: 'var(--brand)' },
    { n: '02', t: 'Multi-tenancy native', d: 'Tenant isolation is baked into every layer — schema, guardrail, memory, and billing. There is no single-tenant version.',      c: 'var(--info)' },
    { n: '03', t: 'No LLM lock-in',      d: 'The MCP layer is model-agnostic. Claude is the default; the architecture lets you swap when it matters.',                       c: 'var(--brand-lift)' },
    { n: '04', t: 'Ship, then expand',   d: 'Phase 1 ships five modules. Phase 2 adds carbon tracking, supplier risk, and demand forecasting — when the demand is proven.',  c: 'var(--teal)' },
  ],
  contact: 'hello@progue.ai',
};
