import { useEffect } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { OrganizationSwitcher, UserButton, useAuth, useOrganizationList } from '@clerk/clerk-react';
import {
  IconChartBar,
  IconKey,
  IconListDetails,
  IconCreditCard,
  IconBook2,
  IconExternalLink,
  IconBell,
} from '@tabler/icons-react';

const NAV = [
  { to: '/dashboard',         label: 'Overview', icon: IconChartBar    },
  { to: '/dashboard/keys',    label: 'API Keys', icon: IconKey         },
  { to: '/dashboard/logs',    label: 'Logs',     icon: IconListDetails },
  { to: '/dashboard/billing', label: 'Billing',  icon: IconCreditCard  },
] as const;

/**
 * Automatically activates the user's first organization if no org is currently
 * active in the Clerk session. Without an active org, getToken() returns a
 * user-level JWT with no org_id, and every API call returns tenant_required.
 */
function OrgAutoActivator() {
  const { orgId } = useAuth();
  const { userMemberships, setActive } = useOrganizationList({ userMemberships: { infinite: true } });

  useEffect(() => {
    if (orgId) return; // already active — nothing to do
    const firstOrg = userMemberships?.data?.[0]?.organization;
    if (firstOrg && setActive) {
      void setActive({ organization: firstOrg.id });
    }
  }, [orgId, userMemberships, setActive]);

  return null;
}

export default function DashboardLayout() {
  const { pathname } = useLocation();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <OrgAutoActivator />

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

          {/* Docs link */}
          <a
            href="https://docs.progue.ai"
            target="_blank"
            rel="noreferrer"
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
            Docs
            <IconExternalLink size={12} style={{ marginLeft: 'auto' }} />
          </a>

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
