import { useTranslations } from 'next-intl'
import React from 'react'

import AnimatedSection from '@/components/shared/components/AnimatedSection'

/**
 * The opening beat of the about page: the page title.
 */
export const HeroSection = () => {
  // Translations for section
  const t = useTranslations('about.hero')

  return (
    <AnimatedSection eager>
      <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black leading-[1.1] text-balance text-foreground hyphens-none">
        {t('title')}
      </h1>
    </AnimatedSection>
  )
}
