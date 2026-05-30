import { useEffect, useRef } from 'react';

/**
 * Avgstar reveal-on-scroll hook.
 * Attach the returned ref to a container element.
 * Any child with className="reveal" will gain className="reveal in" when it
 * enters the viewport, triggering the .reveal CSS transition.
 * Immediately marks all children as .in when prefers-reduced-motion is set.
 */
export function useReveal() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = ref.current;
    if (!container) return;

    const els = Array.from(container.querySelectorAll<HTMLElement>('.reveal'));

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      els.forEach(el => el.classList.add('in'));
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in');
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 },
    );

    els.forEach(el => io.observe(el));
    return () => io.disconnect();
  }, []);

  return ref;
}
