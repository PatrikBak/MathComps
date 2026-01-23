'use client'

import Image from 'next/image'
import { useTranslations } from 'next-intl'

import GlassCard from '@/components/shared/components/GlassCard'
import Section from '@/components/shared/components/Section'

/**
 * Displays the technologies section on the about page.
 */
export default function TechnologiesSection() {
  // Translations for section
  const t = useTranslations('about.technologies')

  // The array of used technologies with their data
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
    <Section
      id="technologies-section"
      className="px-4"
      title={t('title')}
      description={t('description')}
    >
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
    </Section>
  )
}
