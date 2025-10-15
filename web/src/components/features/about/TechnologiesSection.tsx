import Image from 'next/image'
import React from 'react'

import AnimatedSection from '@/components/shared/components/AnimatedSection'
import GlassCard from '@/components/shared/components/GlassCard'
import { cn } from '@/components/shared/utils/css-utils'
import { HOME_ABOUT_STYLES } from '@/constants/common-section-styles'

export default function TechnologiesSection() {
  const technologies = [
    {
      name: 'Next.js',
      icon: (
        <Image
          src="/logo-nextjs.svg"
          alt="Next.js Logo"
          width={48}
          height={48}
          style={{ filter: 'invert(1)' }}
        />
      ),
      gradient: 'from-slate-900 to-black',
      glowColor: 'rgba(255, 255, 255, 0.35)',
    },
    {
      name: 'C#',
      icon: <Image src="/logo-csharp.svg" alt="C# Logo" width={48} height={48} />,
      gradient: 'from-purple-600 to-purple-800',
      glowColor: 'rgba(168, 85, 247, 0.4)',
    },
    {
      name: 'PostgreSQL',
      icon: <Image src="/logo-postgres.svg" alt="PostgreSQL Logo" width={48} height={48} />,
      gradient: 'from-blue-600 to-blue-800',
      glowColor: 'rgba(90, 148, 195, 0.45)',
    },
  ]

  return (
    <AnimatedSection
      className={cn(HOME_ABOUT_STYLES.sectionWrapper, 'px-4')}
      anchorId="technologies-section"
    >
      <div className={HOME_ABOUT_STYLES.headerContainer}>
        <h2 className={HOME_ABOUT_STYLES.sectionTitle}>Technológie</h2>
        <p className={HOME_ABOUT_STYLES.sectionDescription}>
          Prehľad kľúčových technológií, ktoré poháňajú MathComps.
        </p>
      </div>
      <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 justify-items-center">
        {technologies.map((tech, index) => (
          <div key={index} className="w-full max-w-64 h-full">
            <GlassCard
              iconProps={{
                icon: tech.icon,
                iconGradient: tech.gradient,
                glowColor: tech.glowColor,
              }}
              title={tech.name}
              titleElement="h4"
            />
          </div>
        ))}
      </div>
    </AnimatedSection>
  )
}
