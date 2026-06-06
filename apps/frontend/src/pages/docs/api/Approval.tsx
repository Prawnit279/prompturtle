import DocsPage from '../../../components/docs/DocsPage';
import { H2, P, Code, CodeBlock, Callout } from '../../../components/docs/DocsPrimitives';

export default function ApiApproval() {
  return (
    <DocsPage
      section="Modules"
      title="Approval Workflow"
      plainEnglish={
        <>
          <p>
            Some decisions shouldn&rsquo;t happen automatically — a $50,000 shipment, a carrier change on an active
            purchase order, a customs filing with a confidence score of 60%. This module handles those cases. When a
            guardrail halts a decision, Approval Workflow routes it to the right person, notifies them by email, and
            waits. When they approve or reject, that outcome is logged alongside the original decision.
          </p>
          <p>
            If you want AI to handle routine decisions automatically but always escalate the high-stakes ones to a
            human, this is the module for that.
          </p>
        </>
      }
    >
      <H2>Overview</H2>
      <Callout>
        Namespace: <Code>progue.approval</Code> · Module: <Code>APPROVAL_WORKFLOW</Code> · External APIs: Resend (email
        notifications) · <strong>[LIVE]</strong>
      </Callout>

      <H2>
        <Code>requestApproval</Code> → <Code>request_approval</Code>
      </H2>
      <P>Open an approval request for a halted decision.</P>
      <CodeBlock language="ts">{`const approval = await progue.approval.requestApproval({
  auditId:      'aud_01k…',
  requiredRole: 'finance_manager',
  context:      { shipment, cost },
});
// { approvalId, status: 'pending', notifiedVia: 'email' }`}</CodeBlock>

      <H2>
        <Code>checkApprovalStatus</Code> → <Code>check_approval_status</Code>
      </H2>
      <P>Poll the status of an open approval.</P>
      <CodeBlock language="ts">{`const { status } = await progue.approval.checkApprovalStatus({ approvalId });
// status: 'pending' | 'approved' | 'rejected' | 'expired'`}</CodeBlock>

      <H2>
        <Code>autoApproveIfSafe</Code> → <Code>auto_approve_if_safe</Code>
      </H2>
      <P>Auto-approve when a decision falls within pre-configured safe bounds; otherwise return <Code>requires_approval</Code>.</P>
      <CodeBlock language="ts">{`const r = await progue.approval.autoApproveIfSafe({ auditId });
// { outcome: 'auto_approved' | 'requires_approval', reason }`}</CodeBlock>

      <H2>
        <Code>escalate</Code> → <Code>escalate</Code>
      </H2>
      <P>Route to a different or higher-authority role when normal approval can&rsquo;t resolve it.</P>
      <CodeBlock language="ts">{`await progue.approval.escalate({
  approvalId,
  toRole: 'compliance_officer',
  reason: 'broker unverified',
});`}</CodeBlock>
      <P>Approvers are notified by email automatically.</P>
    </DocsPage>
  );
}
