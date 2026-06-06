import { useEffect, useState } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { OrganizationSwitcher, UserButton, useAuth, useOrganizationList } from '@clerk/clerk-react';
import {
  IconChartBar,
  IconKey,
  IconListDetails,
  IconCreditCard,
  IconBook2,
  IconBell,
} from '@tabler/icons-react';

const NAV = [
  { to: '/dashboard',         label: 'Overview', icon: IconChartBar    },
  { to: '/dashboard/keys',    label: 'API Keys', icon: IconKey         },
  { to: '/dashboard/logs',    label: 'Logs',     icon: IconListDetails },
  { to: '/dashboard/billing', label: 'Billing',  icon: IconCreditCard  },
] as const;

export default function DashboardLayout() {
  const { pathname } = useLocation();
  const { orgId, getToken } = useAuth();
  const { userMemberships, setActive, isLoaded } = useOrganizationList({
    userMemberships: { infinite: true },
  });

  // orgReady: true only after we have confirmed that getToken() returns a JWT
  // that actually contains org_id. Clerk caches JWTs for up to 60 s, so after
  // setActive we must force a refresh (skipCache: true) before rendering
  // child routes — otherwise API calls fire with a stale token that has no
  // org_id and the backend returns tenant_required.
  const [orgReady, setOrgReady] = useState(false);

  useEffect(() => {
    if (orgReady) return;
    if (!isLoaded) return;

    const firstOrg = userMemberships?.data?.[0]?.organization;
    if (!firstOrg || !setActive) return;

    // 1. Activate the org in the Clerk session.
    // 2. Force-refresh the JWT so org_id is present before children render.
    setActive({ organization: firstOrg.id })
      .then(() => getToken({ skipCache: true }))
      .then(() => setOrgReady(true))
      .catch((_err: unknown) => {
        // Keep orgReady false — user stays on loading screen.
      });
  }, [orgReady, isLoaded, userMemberships, setActive, getToken]);

  // Block child routes until the org session is confirmed.
  // Prevents API calls firing before org_id is in the JWT.
  if (!orgReady) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text-2)', fontFamily: 'var(--sans)', fontSize: '13px' }}>
        Loading workspace…
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>

      {/* ── Topbar ── */}
      <header
        style={{
          display:      'flex',
          alignItems:   'center',
          height:       '56px',
          padding:      '0 24px',
          borderBottom: '1px solid var(--border)',
          background:   'var(--surface)',
          position:     'sticky',
          top:          0,
          zIndex:       20,
          flexShrink:   0,
        }}
      >
        {/* Wordmark */}
        <span style={{ fontSize: '16px', fontWeight: 500, letterSpacing: '-0.02em', fontFamily: 'var(--sans)' }}>
          progue<span style={{ color: 'var(--brand)' }}>.</span>
        </span>

        {/* Org Switcher pill */}
        <div style={{ marginLeft: '30px' }}>
          <OrganizationSwitcher
            appearance={{
              elements: {
                rootBox: { fontFamily: 'var(--mono)', fontSize: '12px' },
                organizationSwitcherTrigger: {
                  background:   'var(--bg)',
                  border:       '1px solid var(--border-strong)',
                  borderRadius: '8px',
                  padding:      '6px 12px',
                  color:        'var(--text-2)',
                },
              },
            }}
          />
        </div>

        {/* Right side */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '18px' }}>
          <IconBell size={18} style={{ color: 'var(--text-2)', cursor: 'pointer' }} />
          <UserButton
            appearance={{ elements: { avatarBox: { width: '30px', height: '30px' } } }}
            userProfileMode="modal"
          />
        </div>
      </header>

      {/* ── Body ── */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>

        {/* ── Sidebar ── */}
        <nav
          style={{
            width:          '220px',
            flexShrink:     0,
            borderRight:    '1px solid var(--border)',
            padding:        '16px 0',
            display:        'flex',
            flexDirection:  'column',
          }}
        >
          {NAV.map(({ to, label, icon: Icon }) => {
            const active =
              to === '/dashboard'
                ? pathname === '/dashboard'
                : pathname.startsWith(to);

            return (
              <Link
                key={to}
                to={to}
                style={{
                  display:        'flex',
                  alignItems:     'center',
                  height:         '38px',
                  padding:        active ? '0 16px' : '0 16px 0 19px',
                  gap:            '11px',
                  fontSize:       '13px',
                  color:          active ? 'var(--text)' : 'var(--text-2)',
                  textDecoration: 'none',
                  position:       'relative',
                  transition:     'color 0.15s',
                  fontFamily:     'var(--sans)',
                }}
              >
                {/* Brand left bar — active only */}
                {active && (
                  <span
                    style={{
                      position:     'absolute',
                      left:         0,
                      width:        '3px',
                      height:       '18px',
                      background:   'var(--brand)',
                      borderRadius: '0 2px 2px 0',
                    }}
                  />
                )}
                <Icon size={17} />
                {label}
              </Link>
            );
          })}

          {/* Divider */}
          <div style={{ height: '1px', background: 'var(--border)', margin: '12px 16px' }} />

          {/* Help & Docs link — internal docs site */}
          <Link
            to="/docs"
            style={{
              display:        'flex',
              alignItems:     'center',
              height:         '38px',
              padding:        '0 16px 0 19px',
              gap:            '11px',
              fontSize:       '13px',
              color:          'var(--text-2)',
              textDecoration: 'none',
              fontFamily:     'var(--sans)',
            }}
          >
            <IconBook2 size={17} />
            Help &amp; Docs
          </Link>

          {/* Footer version */}
          <div style={{ marginTop: 'auto', padding: '0 19px' }}>
            <span style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--text-3)' }}>
              v0.1.0
            </span>
          </div>
        </nav>

        {/* ── Main content ── */}
        <main
          style={{
            flex:      1,
            padding:   '28px 40px',
            minWidth:  0,
            maxWidth:  '1400px',
            overflowY: 'auto',
          }}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
