import { useTranslations } from 'next-intl'

import ContactButton from '@/components/features/contact/ContactButton'
import Section from '@/components/shared/components/Section'
import { cn } from '@/components/shared/utils/css-utils'

/**
 * A specific feature, either implemented or not.
 */
type FeatureItem = {
  /* The name/description of the feature */
  title: string
  /* Whether the feature is implemented or not */
  isImplemented?: boolean
}

/**
 * Categories list of {@link FeatureItem}s.
 */
type FeatureCategory = {
  /* The name of the category */
  title: string
  /* The icon of the category */
  icon: string
  /* The color of the category */
  color: string
  /* The features of the category */
  features: FeatureItem[]
}

/**
 * A badge representing a {@link FeatureItem}.
 */
const FeatureBadge = ({ title, isImplemented }: FeatureItem) => (
  <span
    className={cn(
      'inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium border my-0.5',
      isImplemented
        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.1)]'
        : 'bg-slate-700/50 text-slate-300 border-slate-600/50'
    )}
  >
    {isImplemented && '✓ '}
    {title}
  </span>
)

/**
 * A container with features of a single {@link FeatureCategory}.
 */
const FeatureCategoryCard = (category: FeatureCategory) => {
  return (
    <div className="bg-slate-900/30 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6 hover:bg-slate-900/40 transition-all duration-300">
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
          <FeatureBadge key={index} title={feature.title} isImplemented={feature.isImplemented} />
        ))}
      </div>
    </div>
  )
}

/**
 * Displays the roadmap/features section on the about page.
 */
export const RoadmapSection = () => {
  // Translations for section
  const t = useTranslations('about.roadmap')

  // Categorized features
  const featureCategories: FeatureCategory[] = [
    {
      title: t('categories.content'),
      icon: '📚',
      color: 'bg-blue-500/20 text-blue-400',
      features: [
        { title: t('features.archiveSKCZ'), isImplemented: true },
        { title: t('features.introTexts'), isImplemented: true },
        { title: t('features.fullLocalization'), isImplemented: true },
        { title: t('features.foreignTasks') },
        { title: t('features.moreTexts') },
      ],
    },
    {
      title: t('categories.community'),
      icon: '👥',
      color: 'bg-green-500/20 text-green-400',
      features: [
        { title: t('features.newsSection'), isImplemented: true },
        { title: t('features.userProfiles'), isImplemented: true },
        { title: t('features.likeTasks'), isImplemented: true },
        { title: t('features.discussions'), isImplemented: true },
        { title: t('features.customLists'), isImplemented: true },
        { title: t('features.reportBugs') },
        { title: t('features.contributorPlatform') },
      ],
    },
    {
      title: t('categories.tools'),
      icon: '🛠️',
      color: 'bg-purple-500/20 text-purple-400',
      features: [
        { title: t('features.filterFavorites'), isImplemented: true },
        { title: t('features.exportPdfTex') },
        { title: t('features.recommendSimilar') },
        { title: t('features.aiHints') },
        { title: t('features.trackProgress') },
        { title: t('features.personalizedRecs') },
      ],
    },
    {
      title: t('categories.competitions'),
      icon: '🏆',
      color: 'bg-yellow-500/20 text-yellow-400',
      features: [
        { title: t('features.trainingPlatform') },
        { title: t('features.privateComps') },
        { title: t('features.officialTraining') },
        { title: t('features.leaderboards') },
        { title: t('features.aiPregrading') },
      ],
    },
  ]

  return (
    <Section
      id="roadmap-section"
      title={t('title')}
      description={
        <>
          {t('description')}{' '}
          <span className="block w-fit mx-auto mt-6 items-center px-2 py-0.5 rounded-full text-sm font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            ✓ {t('implementedLabel')}
          </span>
        </>
      }
      descriptionClassName="text-balance"
    >
      <div className="max-w-4xl mx-auto w-full px-4">
        <div className="space-y-6">
          {featureCategories.map((category) => (
            <div key={category.title}>
              <FeatureCategoryCard {...category} />
            </div>
          ))}
        </div>

        <div className="mt-8 text-center">
          <p className="text-slate-400 text-sm">
            {t.rich('footer', {
              link: (chunks) => (
                <ContactButton
                  reason="featureIdeas"
                  className="text-indigo-400 hover:text-indigo-300 underline"
                >
                  {chunks}
                </ContactButton>
              ),
            })}
          </p>
        </div>
      </div>
    </Section>
  )
}
