import React from 'react'

import AnimatedSection from '@/components/shared/components/AnimatedSection'
import GradientText from '@/components/shared/components/GradientText'

export const HeroSection = () => {
  return (
    <AnimatedSection className="text-center">
      <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white leading-tight text-balance">
        Vytvorené z&nbsp;nadšenia pre
        <GradientText className="block">matematiku</GradientText>
      </h1>
    </AnimatedSection>
  )
}
