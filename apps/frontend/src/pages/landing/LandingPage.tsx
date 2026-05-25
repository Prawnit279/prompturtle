import LandingLayout    from './LandingLayout';
import Hero             from './sections/Hero';
import Problem          from './sections/Problem';
import WhatItIs         from './sections/WhatItIs';
import Modules          from './sections/Modules';
import Integration      from './sections/Integration';
import BuiltOn          from './sections/BuiltOn';
import Guardrails       from './sections/Guardrails';
import PricingSection   from './sections/PricingSection';
import FinalCTA         from './sections/FinalCTA';

// Reordering sections = editing this array.
const SECTIONS = [
  Hero,
  Problem,
  WhatItIs,
  Modules,
  Integration,
  BuiltOn,
  Guardrails,
  PricingSection,
  FinalCTA,
] as const;

export default function LandingPage() {
  return (
    <LandingLayout>
      {SECTIONS.map((Section) => (
        <Section key={Section.name} />
      ))}
    </LandingLayout>
  );
}
