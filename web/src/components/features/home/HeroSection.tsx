import { useTranslations } from 'next-intl'

import FloatingMath from '@/components/animations/FloatingMath'
import ParticleSystem from '@/components/animations/ParticleSystem'

import { HeroConstruction } from './hero-geometry/HeroConstruction'

/**
 * The landing hero: headline and subtitle beside a self-drawing geometric construction.
 */
export default function HeroSection() {
  // Copy for the hero
  const t = useTranslations('home.hero')

  return (
    <section className="relative overflow-hidden">
      <ParticleSystem />
      <FloatingMath />

      <div className="relative z-10 mx-auto grid max-w-4xl items-center gap-8 px-4 pb-10 md:grid-cols-[1.35fr_1fr] md:gap-12 md:pb-16">
        {/* Statement */}
        <div className="text-center md:text-left">
          <h1 className="text-balance text-[clamp(1.875rem,4.2vw,2.5rem)] font-bold leading-[1.05] tracking-tight text-foreground hyphens-none">
            {t('title')}
          </h1>
          <p className="mx-auto mt-5 max-w-md text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg md:mx-0">
            {t('subtitle')}
          </p>
        </div>

        {/* The construction, drawn in on load */}
        <div className="flex justify-center text-brand-light">
          <HeroConstruction className="h-64 w-64 md:h-80 md:w-80" />
        </div>
      </div>
    </section>
  )
}
