import { useTranslations } from 'next-intl'
import React from 'react'

import AnimatedSection from '@/components/shared/components/AnimatedSection'
import GradientText from '@/components/shared/components/GradientText'

export const HeroSection = () => {
  // Translations for section
  const t = useTranslations('about.hero')

  return (
    <AnimatedSection eager className="text-center">
      <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-foreground leading-tight text-balance">
        {t('title1')}
        <GradientText className="block">{t('title2')}</GradientText>
      </h1>
    </AnimatedSection>
  )
}
