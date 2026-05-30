import '../styles/landing.css';

import Shell       from '../components/landing/Shell';
import Hero        from '../components/landing/Hero';
import Problem     from '../components/landing/Problem';
import Definition  from '../components/landing/Definition';
import Modules     from '../components/landing/Modules';
import Integration from '../components/landing/Integration';
import BuiltOn     from '../components/landing/BuiltOn';
import Guardrails  from '../components/landing/Guardrails';
import Pricing     from '../components/landing/Pricing';
import Final       from '../components/landing/Final';

export default function Landing(): React.ReactElement {
  return (
    <Shell>
      <Hero />
      <Problem />
      <Definition />
      <Modules />
      <Integration />
      <BuiltOn />
      <Guardrails />
      <Pricing />
      <Final />
    </Shell>
  );
}
