import { useTranslations } from 'next-intl'

import ContactButton from '@/components/features/contact/ContactButton'
import Section from '@/components/shared/components/Section'
import { ACCENT_COLOR_MAP, type AccentColor } from '@/components/shared/utils/accent-colors'
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
  /* The accent color from the global palette */
  accent: AccentColor
  /* The features of the category */
  features: FeatureItem[]
}

/**
 * A badge representing a {@link FeatureItem}.
 */
const FeatureBadge = ({ title, isImplemented }: FeatureItem) => {
  return (
    <span
      className={cn(
        'inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium border my-0.5',
        isImplemented
          ? cn(ACCENT_COLOR_MAP.emerald.bg, ACCENT_COLOR_MAP.emerald.text, 'border-foreground/10')
          : 'bg-foreground/5 text-muted-foreground border-foreground/10'
      )}
    >
      {isImplemented && '✓ '}
      {title}
    </span>
  )
}

/**
 * A container with features of a single {@link FeatureCategory}.
 */
const FeatureCategoryCard = (category: FeatureCategory) => {
  // Resolve the accent palette for this category
  const scheme = ACCENT_COLOR_MAP[category.accent]

  return (
    <div className="bg-surface/10 backdrop-blur-sm border border-foreground/10 rounded-xl p-6 hover:bg-surface/20 transition-all duration-300">
      <div className="flex items-center gap-3 mb-4">
        <div
          className={cn(
            'w-8 h-8 rounded-lg flex items-center justify-center text-lg',
            scheme.bg,
            scheme.text
          )}
        >
          {category.icon}
        </div>
        <h3 className="text-xl font-bold text-foreground">{category.title}</h3>
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

  // Categorized features with accent colors from the global palette
  const featureCategories: FeatureCategory[] = [
    {
      title: t('categories.content'),
      icon: '📚',
      accent: 'sky',
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
      accent: 'emerald',
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
      accent: 'purple',
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
      accent: 'amber',
      features: [
        { title: t('features.trainingPlatform') },
        { title: t('features.privateComps') },
        { title: t('features.officialTraining') },
        { title: t('features.leaderboards') },
        { title: t('features.aiPregrading') },
      ],
    },
  ]

  // Resolved palette for the "implemented" legend badge
  const implementedScheme = ACCENT_COLOR_MAP.emerald

  return (
    <Section
      id="roadmap-section"
      title={t('title')}
      description={
        <>
          {t('description')}{' '}
          <span
            className={cn(
              'block w-fit mx-auto mt-6 items-center px-2 py-0.5 rounded-full text-sm font-medium border border-foreground/10',
              implementedScheme.bg,
              implementedScheme.text
            )}
          >
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
          <p className="text-muted text-sm">
            {t.rich('footer', {
              link: (chunks) => (
                <ContactButton
                  reason="featureIdeas"
                  className="text-link hover:text-link-hover underline"
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
