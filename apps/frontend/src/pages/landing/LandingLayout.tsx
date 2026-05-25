import Nav    from './sections/Nav';
import Footer from './sections/Footer';

interface LandingLayoutProps {
  children: React.ReactNode;
}

export default function LandingLayout({ children }: LandingLayoutProps) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Nav />
      <main style={{ flex: 1 }}>{children}</main>
      <Footer />
    </div>
  );
}
