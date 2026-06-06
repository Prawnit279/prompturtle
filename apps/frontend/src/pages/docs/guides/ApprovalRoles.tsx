import DocsPage from '../../../components/docs/DocsPage';
import { H2, P, Code, CodeBlock, OL } from '../../../components/docs/DocsPrimitives';

export default function GuidesApprovalRoles() {
  return (
    <DocsPage
      section="Guides"
      title="Wiring Approval Roles"
      plainEnglish="When Progue halts a decision and routes it to a “finance manager” or “compliance officer,” it's using role names — not actual email addresses. Your system maps those role names to the real people in your customers' organizations. This guide explains how to do that."
    >
      <H2>How role mapping works</H2>
      <P>
        Progue routes halted decisions to these role names: <Code>finance_manager</Code>, <Code>manager</Code>,{' '}
        <Code>compliance_officer</Code>.
      </P>
      <P>For each tenant, you decide which of your users holds each role. When a decision halts:</P>
      <OL
        items={[
          <>
            The response carries <Code>approval.requiredRole</Code> — e.g. <Code>"finance_manager"</Code>.
          </>,
          'Look up which user holds that role for the calling tenant.',
          'Notify them or block the relevant action in your UI until the approval resolves.',
          'Approvers are also emailed automatically via Resend.',
        ]}
      />

      <H2>Escalation</H2>
      <P>
        Use <Code>escalate</Code> when first-line approval can&rsquo;t resolve a decision — for example, an unverified
        customs broker escalates from <Code>manager</Code> to <Code>compliance_officer</Code>:
      </P>
      <CodeBlock language="ts">{`await progue.approval.escalate({
  approvalId,
  toRole: 'compliance_officer',
  reason: 'broker unverified',
});`}</CodeBlock>
    </DocsPage>
  );
}
