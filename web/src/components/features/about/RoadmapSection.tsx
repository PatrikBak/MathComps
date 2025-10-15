import React from 'react'

import AnimatedSection from '@/components/shared/components/AnimatedSection'
import { cn } from '@/components/shared/utils/css-utils'
import { HOME_ABOUT_STYLES } from '@/constants/common-section-styles'

type FeatureItem = {
  title: string
}

type FeatureCategory = {
  title: string
  icon: string
  color: string
  features: FeatureItem[]
}

const FeatureBadge = ({ title }: FeatureItem) => {
  return (
    <span className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-slate-700/50 text-slate-300 border border-slate-600/50 hover:bg-slate-600/50 transition-all duration-200 hover:scale-105">
      {title}
    </span>
  )
}

const FeatureCategory = ({ category }: { category: FeatureCategory }) => {
  return (
    <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6 hover:bg-slate-800/40 transition-all duration-300">
      <div className="flex items-center gap-3 mb-4">
        <div
          className={cn(
            'w-8 h-8 rounded-lg flex items-center justify-center text-lg',
            category.color
          )}
        >
          {category.icon}
        </div>
        <h3 className="text-xl font-bold text-white">{category.title}</h3>
      </div>
      <div className="flex flex-wrap gap-2">
        {category.features.map((feature, index) => (
          <FeatureBadge key={index} title={feature.title} />
        ))}
      </div>
    </div>
  )
}

export const RoadmapSection = () => {
  const featureCategories: FeatureCategory[] = [
    {
      title: 'Obsah',
      icon: '📚',
      color: 'bg-blue-500/20 text-blue-400',
      features: [
        { title: 'Dopĺňať archív úloh' },
        { title: 'Dopĺňať študijné materiály' },
        { title: 'Dopĺňať ďalšie užitočné články' },
        { title: 'Rozšírenie obsahu do angličtiny' },
      ],
    },
    {
      title: 'Komunita',
      icon: '👥',
      color: 'bg-green-500/20 text-green-400',
      features: [
        { title: 'Sekcia s novinkami' },
        { title: 'Použivateľské profily' },
        { title: 'Možnosť diskutovať pod článkami a úlohami' },
        { title: 'Možnosť reportovať chyby' },
        { title: 'Vlastné zoznamy úloh' },
        { title: 'Platforma pre prispievateľov ' },
      ],
    },
    {
      title: 'Súťaže',
      icon: '🏆',
      color: 'bg-yellow-500/20 text-yellow-400',
      features: [
        { title: 'Platforma na tréningové súťaže' },
        { title: 'Možnosť súkromných súťaží' },
        { title: 'Oficiálne tréningové súťaže' },
        { title: 'AI predhodnotenie' },
      ],
    },
    {
      title: 'Nástroje',
      icon: '🛠️',
      color: 'bg-purple-500/20 text-purple-400',
      features: [
        { title: 'Odporúčania podobných úloh' },
        { title: 'AI hinty k úlohám' },
        { title: 'Sledovanie progresu v riešení' },
        { title: 'Odporúčanie úloh na mieru' },
      ],
    },
  ]

  return (
    <AnimatedSection className={HOME_ABOUT_STYLES.sectionWrapper} anchorId="roadmap-section">
      <div className={cn(HOME_ABOUT_STYLES.headerContainer, 'px-4')}>
        <h2 className={HOME_ABOUT_STYLES.sectionTitle}>Plánované funkcie</h2>
        <p className={cn(HOME_ABOUT_STYLES.sectionDescription, 'text-balance')}>
          Toto je len začiatok projektu a v pláne je veľa nových funkcií. Pozrite si, čo všetko
          plánujeme pridať:
        </p>
      </div>

      <div className="max-w-4xl mx-auto w-full px-4">
        <div className="space-y-6">
          {featureCategories.map((category) => (
            <div key={category.title}>
              <FeatureCategory category={category} />
            </div>
          ))}
        </div>

        <div className="mt-8 text-center">
          <p className="text-slate-400 text-sm">
            Tento zoznam sa bude v čase meniť. Pokojne doň môžete{' '}
            <a
              href="mailto:contacts@mathcomps.com"
              className="text-indigo-400 hover:text-indigo-300 underline"
            >
              prispieť svojimi nápadmi
            </a>
            .
          </p>
        </div>
      </div>
    </AnimatedSection>
  )
}
