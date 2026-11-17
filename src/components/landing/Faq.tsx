import type { LandingDict } from '@/lib/i18n';
import { SectionHeading } from './SectionHeading';
import { Reveal } from './Reveal';

// Native <details> instead of the Radix accordion: the accordion measured every
// item's size on page load, which froze slow phones for seconds.
export function Faq({ t }: { t: LandingDict }) {
  return (
    <section className="py-24 px-4">
      <div className="max-w-3xl mx-auto">
        <SectionHeading eyebrow="FAQ" title={t.faq.title} />
        <Reveal className="glass-card rounded-3xl px-2 sm:px-4">
          {t.faq.items.map((item, i) => (
            <details key={i} name="faq" className="group border-b border-border/40 last:border-0">
              <summary className="flex items-center justify-between gap-4 cursor-pointer list-none text-left font-bold text-foreground px-2 py-5 [&::-webkit-details-marker]:hidden">
                {item.q}
                <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </summary>
              <p className="text-muted-foreground px-2 pb-5 leading-relaxed">{item.a}</p>
            </details>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
