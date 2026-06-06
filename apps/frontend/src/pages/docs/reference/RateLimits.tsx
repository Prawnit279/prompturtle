import DocsPage from '../../../components/docs/DocsPage';
import { H2, Code, UL, DocsTable } from '../../../components/docs/DocsPrimitives';

export default function ReferenceRateLimits() {
  return (
    <DocsPage
      section="Reference"
      title="Rate Limits and Quotas"
      plainEnglish="There are two separate limits on your API usage: a monthly call quota (how many decisions you can make per month, set by your plan), and a per-minute rate limit (how fast you can make them). Schema-rejected calls don't count against your monthly quota. You'll be notified before your quota runs out — nothing is cut off without warning."
    >
      <H2>Limits by tier</H2>
      <DocsTable
        head={['Tier', 'Monthly calls', 'Max request rate']}
        rows={[
          ['Starter', '10,000', 'Standard'],
          ['Growth', '100,000', 'Standard (500 req/min sustained)'],
          ['Enterprise', 'Unlimited', '2,000 req/min'],
        ]}
      />

      <H2>Rules</H2>
      <UL
        items={[
          <>
            <strong>Schema rejections (<Code>422</Code>) don&rsquo;t count.</strong> If the model never ran, the call
            doesn&rsquo;t bill.
          </>,
          <>
            <strong>Rate-limit responses (<Code>429</Code>) include <Code>Retry-After</Code>.</strong> Honor the
            header.
          </>,
          <>
            <strong>Overage billing begins month six.</strong> Until then you&rsquo;re notified as you approach your
            limit; nothing is cut off. From month six, calls above your tier limit bill per 1,000 at rates set from real
            usage data.
          </>,
          <>
            <strong>Rate limiting is platform-level.</strong> There is no custom middleware or configuration needed.
          </>,
        ]}
      />
    </DocsPage>
  );
}
