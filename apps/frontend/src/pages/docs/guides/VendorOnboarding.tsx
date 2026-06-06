import DocsPage from '../../../components/docs/DocsPage';
import { H2, P, Code } from '../../../components/docs/DocsPrimitives';

export default function GuidesVendorOnboarding() {
  return (
    <DocsPage
      section="Guides"
      title="Vendor Onboarding Guide"
      plainEnglish="This guide is for the team at a software company integrating Progue into their product. It covers the six steps from getting access to shipping a live integration. The goal is a working integration in under a week — typically one developer, one sprint."
    >
      <H2>The six steps</H2>

      <P>
        <strong>1 · Create your account and first key</strong>
        <br />
        Start with a <Code>pgk_test_</Code> (sandbox) key. Sandbox calls return real responses, don&rsquo;t count
        toward billing, and don&rsquo;t affect production data.
      </P>
      <P>
        <strong>2 · Model your customers as tenants</strong>
        <br />
        Each customer your product serves is a Progue tenant. Create one tenant per customer account. Isolation is
        automatic — their call logs, memory, and audit records stay completely separate.
      </P>
      <P>
        <strong>3 · Wire the modules you need</strong>
        <br />
        Most vendors start with BOL Processor + HTS Classifier + Audit Trail, then add Carrier Rates and Approval
        Workflow. You don&rsquo;t need all five on day one.
      </P>
      <P>
        <strong>4 · Map approver roles</strong>
        <br />
        Progue routes halted decisions to role names: <Code>finance_manager</Code>, <Code>manager</Code>,{' '}
        <Code>compliance_officer</Code>. Decide which of your users hold each role per tenant and wire your
        notification logic to the <Code>approval.requiredRole</Code> field.
      </P>
      <P>
        <strong>5 · Set guardrail thresholds</strong> <em>(Growth and Enterprise only)</em>
        <br />
        Configure cost thresholds to match your customers&rsquo; risk tolerance. Starter uses the platform defaults.
      </P>
      <P>
        <strong>6 · Switch to a live key and ship</strong>
        <br />
        Move from <Code>pgk_test_</Code> to <Code>pgk_live_</Code> and watch call logs and usage in the dashboard.
      </P>

      <P>
        <strong>Target:</strong> Every new developer on your team should make their first successful API call in under
        five minutes.
      </P>
    </DocsPage>
  );
}
