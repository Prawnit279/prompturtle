import { SignIn, SignedIn, SignedOut, RedirectToSignIn, ClerkLoading } from '@clerk/clerk-react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import ClerkProtectedLayout from './components/ClerkProtectedLayout';
import DashboardLayout      from './components/DashboardLayout';
import Overview             from './pages/Overview';
import ApiKeys              from './pages/ApiKeys';
import CallLogs             from './pages/CallLogs';
import Webhooks            from './pages/Webhooks';
import Billing              from './pages/Billing';
import Landing              from './pages/Landing';
import PricingPage          from './pages/PricingPage';
import Solutions            from './pages/Solutions';
import About                from './pages/About';

// Docs site
import DocsLayout              from './components/docs/DocsLayout';
import DocsIndex               from './pages/docs/DocsIndex';
import Quickstart              from './pages/docs/Quickstart';
import Authentication          from './pages/docs/Authentication';
import Installation            from './pages/docs/Installation';
import ConceptsOverview        from './pages/docs/concepts/Overview';
import ConceptsLifecycle       from './pages/docs/concepts/Lifecycle';
import ConceptsEnvelope        from './pages/docs/concepts/Envelope';
import ConceptsMultiTenancy    from './pages/docs/concepts/MultiTenancy';
import ConceptsGuardrails      from './pages/docs/concepts/Guardrails';
import ConceptsMemory          from './pages/docs/concepts/Memory';
import ApiBol                  from './pages/docs/api/Bol';
import ApiCarrier              from './pages/docs/api/Carrier';
import ApiHts                  from './pages/docs/api/Hts';
import ApiApproval             from './pages/docs/api/Approval';
import ApiAudit                from './pages/docs/api/Audit';
import ApiRisk                 from './pages/docs/api/Risk';
import ReferenceErrors         from './pages/docs/reference/Errors';
import ReferenceRateLimits     from './pages/docs/reference/RateLimits';
import ReferenceVersioning     from './pages/docs/reference/Versioning';
import ReferenceWebhooks       from './pages/docs/reference/Webhooks';
import GuidesVendorOnboarding  from './pages/docs/guides/VendorOnboarding';
import GuidesBolFlow           from './pages/docs/guides/BolFlow';
import GuidesApprovalRoles     from './pages/docs/guides/ApprovalRoles';
import GuidesAuditExport       from './pages/docs/guides/AuditExport';
import DocsRoadmap             from './pages/docs/DocsRoadmap';
import DocsFaq                 from './pages/docs/DocsFaq';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public marketing routes — redirect to dashboard on app subdomain */}
        <Route
          path="/"
          element={
            window.location.hostname === 'app.progue.ai'
              ? <Navigate to="/dashboard" replace />
              : <Landing />
          }
        />
        <Route path="/pricing"   element={<PricingPage />}   />
        <Route path="/solutions" element={<Solutions />}     />
        <Route path="/about"     element={<About />}         />

        {/* Public docs site — shared DocsLayout wraps every page */}
        <Route path="/docs" element={<DocsLayout />}>
          <Route index                           element={<DocsIndex />} />
          <Route path="quickstart"               element={<Quickstart />} />
          <Route path="authentication"           element={<Authentication />} />
          <Route path="installation"             element={<Installation />} />
          <Route path="concepts/overview"        element={<ConceptsOverview />} />
          <Route path="concepts/lifecycle"       element={<ConceptsLifecycle />} />
          <Route path="concepts/envelope"        element={<ConceptsEnvelope />} />
          <Route path="concepts/multi-tenancy"   element={<ConceptsMultiTenancy />} />
          <Route path="concepts/guardrails"      element={<ConceptsGuardrails />} />
          <Route path="concepts/memory"          element={<ConceptsMemory />} />
          <Route path="api/bol"                  element={<ApiBol />} />
          <Route path="api/carrier"              element={<ApiCarrier />} />
          <Route path="api/hts"                  element={<ApiHts />} />
          <Route path="api/approval"             element={<ApiApproval />} />
          <Route path="api/audit"                element={<ApiAudit />} />
          <Route path="api/risk"                 element={<ApiRisk />} />
          <Route path="reference/errors"         element={<ReferenceErrors />} />
          <Route path="reference/rate-limits"    element={<ReferenceRateLimits />} />
          <Route path="reference/versioning"     element={<ReferenceVersioning />} />
          <Route path="reference/webhooks"       element={<ReferenceWebhooks />} />
          <Route path="guides/vendor-onboarding" element={<GuidesVendorOnboarding />} />
          <Route path="guides/bol-flow"          element={<GuidesBolFlow />} />
          <Route path="guides/approval-roles"    element={<GuidesApprovalRoles />} />
          <Route path="guides/audit-export"      element={<GuidesAuditExport />} />
          <Route path="roadmap"                  element={<DocsRoadmap />} />
          <Route path="faq"                      element={<DocsFaq />} />
        </Route>

        {/* Auth + dashboard — ClerkProvider only active here */}
        <Route
          path="/sign-in/*"
          element={
            <ClerkProtectedLayout>
              <SignIn routing="path" path="/sign-in" />
            </ClerkProtectedLayout>
          }
        />

        <Route
          path="/dashboard"
          element={
            <ClerkProtectedLayout>
              <ClerkLoading>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text-2)', fontFamily: 'var(--sans)', fontSize: '13px' }}>
                  Loading…
                </div>
              </ClerkLoading>
              <SignedIn><DashboardLayout /></SignedIn>
              <SignedOut><RedirectToSignIn /></SignedOut>
            </ClerkProtectedLayout>
          }
        >
          <Route index           element={<Overview />} />
          <Route path="keys"     element={<ApiKeys />}  />
          <Route path="logs"     element={<CallLogs />} />
          <Route path="webhooks" element={<Webhooks />} />
          <Route path="billing"  element={<Billing />}  />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
