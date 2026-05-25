import { ClerkProvider } from '@clerk/clerk-react';

const clerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined;

interface ClerkProtectedLayoutProps {
  children: React.ReactNode;
}

/**
 * Wraps auth-dependent routes in ClerkProvider.
 * Landing page routes never use this — they render without Clerk in any env.
 * Dashboard/sign-in routes show a fallback message when VITE_CLERK_PUBLISHABLE_KEY is unset.
 */
export default function ClerkProtectedLayout({ children }: ClerkProtectedLayoutProps) {
  if (!clerkKey) {
    return (
      <div
        style={{
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          height:         '100vh',
          fontFamily:     'var(--sans)',
          color:          'var(--text-2)',
          fontSize:       '13px',
        }}
      >
        Set <code style={{ margin: '0 6px', color: 'var(--brand)' }}>VITE_CLERK_PUBLISHABLE_KEY</code> in
        apps/frontend/.env.local to use the dashboard.
      </div>
    );
  }

  return <ClerkProvider publishableKey={clerkKey}>{children}</ClerkProvider>;
}
