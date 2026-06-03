import { SignIn, SignedIn, SignedOut, RedirectToSignIn, ClerkLoading } from '@clerk/clerk-react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import ClerkProtectedLayout from './components/ClerkProtectedLayout';
import DashboardLayout      from './components/DashboardLayout';
import Overview             from './pages/Overview';
import ApiKeys              from './pages/ApiKeys';
import CallLogs             from './pages/CallLogs';
import Billing              from './pages/Billing';
import Landing              from './pages/Landing';
import PricingPage          from './pages/PricingPage';
import DocsPage             from './pages/DocsPage';
import Solutions            from './pages/Solutions';
import About                from './pages/About';

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
        <Route path="/docs"      element={<DocsPage />}      />
        <Route path="/solutions" element={<Solutions />}     />
        <Route path="/about"     element={<About />}         />

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
          <Route index          element={<Overview />} />
          <Route path="keys"    element={<ApiKeys />}  />
          <Route path="logs"    element={<CallLogs />} />
          <Route path="billing" element={<Billing />}  />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
