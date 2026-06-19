// Single source of truth for all landing page marketing content.
// Changing copy, pricing, modules, or adding testimonials only requires editing this file.
// Components are layout-only — no hardcoded strings live there.

// ─── Hero ──────────────────────────────────────────────────────────────────

export const hero = {
  eyebrow: 'SUPPLY CHAIN CONTEXT ENGINEERING',
  headline: 'Pre-built AI context for supply chain software.',
  subhead:
    'MCP servers, schemas, guardrails, memory, and audit trails for the logistics execution layer. Embed Progue\'s API and ship domain-specific agents in a week, not six.',
  ctas: {
    primary:   { label: 'Get API key →',  href: 'https://app.progue.ai/sign-up' },
    secondary: { label: 'Read the docs',  href: '/docs' },
  },
} as const;

// Code block and trace lines shown in the hero animation.
export const heroAnimation = {
  codeLines: [
    "import Progue from '@progue/sdk';",
    "",
    "const progue = new Progue({",
    "  apiKey: process.env.PROGUE_API_KEY,",
    "});",
    "",
    "const res = await progue.hts.classify({",
    "  description: 'Servo motor, 7.5kW',",
    "  origin:      'DE',",
    "  destination: 'US',",
    "});",
    "// { hsCode: '8501.52',",
    "//   confidence: 0.94 }",
  ],
  traceLines: [
    { event: 'call_received',    detail: 'hts.classify',       status: 'success' as const },
    { event: 'schema_validated', detail: 'input check passed', status: 'success' as const },
    { event: 'llm:claude-opus',  detail: 'classifying…',       status: 'success' as const },
    { event: 'confidence: 0.94', detail: 'threshold passed',   status: 'success' as const },
    { event: 'audit_logged',     detail: 'decision recorded',  status: 'success' as const },
  ],
} as const;

// ─── Problem ───────────────────────────────────────────────────────────────

export const problem = {
  label:    '01 / WHY BUILD CONTEXT FROM SCRATCH',
  headline: 'Six to ten weeks of work before you ship a single decision.',
  body:
    'Most teams budget for the model. The cost lives in everything around it — schemas, MCP tool wrappers, guardrail rules, audit logs, vector memory. All custom, all brittle, none of it your differentiator. One workflow typically burns ~$36,000 in engineering time before the first production decision.',
  cards: [
    { title: 'Schema design & validation' },
    { title: 'Guardrail rule engineering' },
    { title: 'Vector memory + audit trail' },
  ],
} as const;

// ─── What it is ────────────────────────────────────────────────────────────

export const definition = {
  label:    '02 / CONTEXT ENGINEERING, NOT PROMPT ENGINEERING',
  headline: 'The infrastructure layer your model depends on.',
  body:
    'Context engineering is the discipline of building what surrounds the model: structured schemas, retrieval memory, guardrail rules, tool wrappers, and audit infrastructure. Progue ships this layer as a managed API.',
  items: [
    { term: 'System prompts', desc: 'Domain-calibrated instructions per tool' },
    { term: 'Schemas',        desc: 'Typed input/output contracts per decision' },
    { term: 'MCP servers',    desc: 'Tool wrappers your agent calls by name' },
    { term: 'Guardrails',     desc: 'Pre/post-call rule enforcement' },
    { term: 'Memory',         desc: 'pgvector-backed semantic retrieval' },
    { term: 'Audit trail',    desc: 'Immutable log of every decision' },
  ],
} as const;

// ─── Modules ───────────────────────────────────────────────────────────────

export interface Module {
  name:  string;
  tag:   string;
  tools: readonly string[];
  phase: 1 | 2;
}

// Adding a Phase 2 module = append one object here. The section renders it automatically.
export const modules: Module[] = [
  {
    name:  'BOL Processor',
    tag:   'bol',
    tools: ['parse', 'validate', 'extract_line_items', 'flag_compliance'],
    phase: 1,
  },
  {
    name:  'Carrier Rates',
    tag:   'carrier',
    tools: ['compare_rates', 'score_carrier', 'estimate_transit', 'recommend'],
    phase: 1,
  },
  {
    name:  'HTS Classifier',
    tag:   'hts',
    tools: ['classify_hs_code', 'lookup_tariff', 'check_cbam', 'flag_audit_risk'],
    phase: 1,
  },
  {
    name:  'Approval Workflow',
    tag:   'approval',
    tools: ['request_approval', 'auto_approve_safe', 'escalate', 'record'],
    phase: 1,
  },
  {
    name:  'Audit Trail',
    tag:   'audit',
    tools: ['log_decision', 'list_history', 'export_report', 'verify_chain'],
    phase: 1,
  },
];

// ─── Integration ───────────────────────────────────────────────────────────

export const integration = {
  label:    '04 / ONE API SURFACE',
  headline: 'One endpoint. Five modules. Zero infrastructure.',
  flowSteps: ['Your product', 'Progue API', 'Context Engine', 'Claude', 'Audit log'],
  codeBlock: `import Progue from '@progue/sdk';

const progue = new Progue({
  apiKey: process.env.PROGUE_API_KEY,
});

const res = await progue.hts.classify({
  description: 'Industrial servo motor, 7.5kW',
  origin:      'DE',
  destination: 'US',
});

// res.hsCode       → '8501.52'
// res.dutyRate     → 0.025
// res.confidence   → 0.94
// res.auditId      → 'aud_01jx...'`,
} as const;

// ─── Built on ──────────────────────────────────────────────────────────────

export const builtOn = {
  label:    '05 / BUILT ON',
  tagline:  'Every choice serves auditability or multi-tenancy.',
  technologies: [
    'Anthropic Claude',
    'Anthropic MCP SDK',
    'Supabase + pgvector',
    'Clerk',
    'Stripe',
    'Resend',
    'Vercel',
    'Railway',
  ],
  // Fill this array and a customer logo row appears above the tech strip automatically.
  customers: [] as { name: string; logoUrl: string }[],
} as const;

// ─── Guardrails ────────────────────────────────────────────────────────────

export type GuardrailActionType = 'success' | 'warning' | 'error';

export interface GuardrailRow {
  rule:        string;
  condition:   string;
  action:      string;
  actionType:  GuardrailActionType;
  approver:    string;
}

export const guardrails = {
  label:    '06 / GUARDRAILS, NOT GUESSWORK',
  headline: 'Every decision passes two gates and writes to an audit log.',
  rows: [
    {
      rule:       'high_cost_approval',
      condition:  'shipmentCost > $10,000',
      action:     'Request approval',
      actionType: 'warning' as GuardrailActionType,
      approver:   'finance_manager',
    },
    {
      rule:       'new_carrier_check',
      condition:  'carrier not in approved list',
      action:     'Warn + flag',
      actionType: 'warning' as GuardrailActionType,
      approver:   'ops_manager',
    },
    {
      rule:       'customs_flag',
      condition:  'customs + unverified broker',
      action:     'Halt + escalate',
      actionType: 'error' as GuardrailActionType,
      approver:   'compliance_officer',
    },
    {
      rule:       'schema_violation',
      condition:  'invalid tool input',
      action:     'Reject',
      actionType: 'error' as GuardrailActionType,
      approver:   '—',
    },
  ] satisfies GuardrailRow[],
} as const;

// ─── Pricing ───────────────────────────────────────────────────────────────
// High-churn: pricing details live exclusively here. Editing price/calls = one line.

export interface PricingTier {
  name:        string;
  price:       number;
  period:      'mo';
  calls:       string;
  rateLimit:   string;
  features:    string[];
  highlighted: boolean;
  cta:         string;
  ctaHref:     string;
}

export const pricingTiers: PricingTier[] = [
  {
    name:        'Starter',
    price:       149,
    period:      'mo',
    calls:       '10,000 calls / mo',
    rateLimit:   '10 req / min',
    features: [
      'All 5 Phase 1 modules',
      'Full audit trail',
      'Email support',
      'Clerk-based auth',
    ],
    highlighted: false,
    cta:         'Get API key',
    ctaHref:     'https://app.progue.ai/sign-up',
  },
  {
    name:        'Growth',
    price:       599,
    period:      'mo',
    calls:       '100,000 calls / mo',
    rateLimit:   '60 req / min',
    features: [
      'All 5 Phase 1 modules',
      'Full audit trail',
      'Priority email support',
      'Usage analytics dashboard',
      'Clerk-based auth',
    ],
    highlighted: true,
    cta:         'Get API key',
    ctaHref:     'https://app.progue.ai/sign-up',
  },
  {
    name:        'Enterprise',
    price:       1999,
    period:      'mo',
    calls:       'Unlimited',
    rateLimit:   '300 req / min',
    features: [
      'All 5 Phase 1 modules',
      'Full audit trail',
      'Dedicated support',
      'Custom guardrail rules',
      'SLA guarantee',
      'Custom contract',
    ],
    highlighted: false,
    cta:         'Contact us',
    ctaHref:     'mailto:hello@progue.ai',
  },
];

// ─── Final CTA ─────────────────────────────────────────────────────────────

export const finalCta = {
  headline: 'Self-serve. Live now.',
  ctas: {
    primary:   { label: 'Get API key →', href: 'https://app.progue.ai/sign-up' },
    secondary: { label: 'Read the docs', href: '/docs' },
  },
} as const;

// ─── Footer ────────────────────────────────────────────────────────────────

export const footer = {
  tagline: 'Context infrastructure for supply chain AI.',
  columns: [
    {
      heading: 'Platform',
      links: [
        { label: 'Modules',       href: '/#modules' },
        { label: 'Architecture',  href: '/#integration' },
        { label: 'Guardrails',    href: '/#guardrails' },
        { label: 'Pricing',       href: '/pricing' },
      ],
    },
    {
      heading: 'Developers',
      links: [
        { label: 'Docs',           href: '/docs' },
        { label: 'API reference',  href: '/docs#api-reference' },
        { label: 'Changelog',      href: '/docs#changelog' },
      ],
    },
    {
      heading: 'Company',
      links: [
        { label: 'About',    href: '/about' },
        { label: 'Contact',  href: 'mailto:hello@progue.ai' },
      ],
    },
    {
      heading: 'Legal',
      links: [
        { label: 'Privacy',   href: '/privacy' },
        { label: 'Terms',     href: '/terms' },
        { label: 'Security',  href: '/security' },
      ],
    },
  ],
  social: [
    { label: 'X',         href: 'https://x.com/progueai' },
    { label: 'GitHub',    href: 'https://github.com/progue-ai' },
    { label: 'LinkedIn',  href: 'https://linkedin.com/company/progue-ai' },
  ],
} as const;

// ─── Sub-page content ──────────────────────────────────────────────────────

export const solutions = {
  label:    'SOLUTIONS',
  headline: 'Built for the teams building on top of supply chain data.',
  segments: [
    {
      name: 'TMS Vendors',
      desc: 'Add AI-powered BOL parsing, carrier scoring, and customs flagging to your TMS without building the context layer from scratch.',
    },
    {
      name: 'Freight Visibility',
      desc: 'Embed structured decision logs and audit trails that satisfy compliance requirements your customers are starting to ask for.',
    },
    {
      name: '3PL Software',
      desc: 'Ship guardrailed AI workflows for high-cost shipment approval, carrier substitution, and HTS classification in days.',
    },
    {
      name: 'Procurement SaaS',
      desc: 'Provide purchasing agents with HTS lookup, duty rate retrieval, and customs audit chains that enterprises demand.',
    },
    {
      name: 'Carrier Management',
      desc: 'Give operations teams AI recommendations backed by real rate comparison and configurable approval workflows.',
    },
  ],
} as const;

export const about = {
  label:    'ABOUT',
  headline: 'Building the context layer for supply chain AI.',
  body:
    'Progue started from a simple observation: every supply chain software team building AI features was reinventing the same infrastructure — schemas, guardrails, memory, audit logs. We built it once, made it multi-tenant, and put it behind an API. The goal is to make domain-specific AI agents in logistics faster to ship and safer to run.',
  contact: 'hello@progue.ai',
} as const;
