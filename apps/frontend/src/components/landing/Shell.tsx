import BackdropCanvas from './BackdropCanvas';
import Nav            from './Nav';
import Footer         from './Footer';

interface ShellProps {
  children: React.ReactNode;
}

/**
 * Shared layout for all landing/marketing pages.
 * Renders the fixed backdrop canvas, sticky nav, page content, and footer.
 */
export default function Shell({ children }: ShellProps): React.ReactElement {
  return (
    <div className="lp-root">
      <BackdropCanvas />
      <div className="lp-page">
        <Nav />
        <main>{children}</main>
        <Footer />
      </div>
    </div>
  );
}
