import { BookOpen, Link2, type LucideIcon, MessageSquare, Wrench, Youtube } from 'lucide-react'
import { useTranslations } from 'next-intl'
import React from 'react'

import { AppLink } from '@/components/shared/components/AppLink'
import { cn } from '@/components/shared/utils/css-utils'
import { getSiteUrl } from '@/components/shared/utils/url-utils'
import type { SectionNumberer } from '@/components/table-of-contents/SectionNumberer'
import { ROUTES } from '@/i18n/i18n'

import { ExternalLinkButton } from './layout/ExternalLinkButton'
import { GUIDE_TITLES } from './layout/guide-structure'
import { GUIDE_STYLES } from './layout/guide-styles'
import { GuideSection } from './layout/GuideSection'
import { InfoCard } from './layout/InfoCard'
import TipBox from './layout/TipBox'

type Resource = {
  title: string
  fullName?: string
  description: string | React.ReactNode
  link?: string
}

type ResourceCategoryType = {
  title: string
  icon: LucideIcon
  iconColor: string
  iconBg: string
  description?: string | React.ReactNode
  resources: Resource[]
  renderFooter?: () => React.ReactNode
}

/**
 * Render a single resource card with name, optional acronym, description, and link.
 * Follows the same pattern as competition cards in OtherCompetitionsSection.
 */
function renderResourceCard(resource: Resource, resourceIndex: number) {
  return (
    <InfoCard key={resourceIndex}>
      {/* Header with name and optional acronym */}
      <div className="mb-2 sm:mb-3">
        <h4 className={cn(GUIDE_STYLES.cardTitle, 'mb-0')}>{resource.title}</h4>
        {resource.fullName && (
          <p className={cn(GUIDE_STYLES.textAcronym, 'mt-0.5')}>({resource.fullName})</p>
        )}
      </div>

      {/* Link */}
      {resource.link && (
        <div className="mb-3">
          <ExternalLinkButton href={resource.link} />
        </div>
      )}

      {/* Description */}
      <p className={cn(GUIDE_STYLES.textNormal, 'leading-relaxed')}>{resource.description}</p>
    </InfoCard>
  )
}

function ResourceCategory({
  category,
  sectionNumberer,
}: {
  category: ResourceCategoryType
  sectionNumberer: SectionNumberer
}) {
  // Get translations
  const t = useTranslations('guide')

  return (
    <GuideSection
      title={category.title}
      description={category.description}
      icon={{ type: 'lucide', icon: category.icon }}
      iconColor={category.iconColor}
      iconBackground={category.iconBg}
      sectionNumberer={sectionNumberer}
    >
      <div className="space-y-3 sm:space-y-4">
        {category.resources.map(renderResourceCard)}
        {category.title === t(`titles.${GUIDE_TITLES.PROGRAMS}`) && (
          <TipBox>{t('sections.resources.tips.ai')}</TipBox>
        )}
        {category.renderFooter && category.renderFooter()}
      </div>
    </GuideSection>
  )
}

export default function ResourcesSection({
  sectionNumberer,
}: {
  sectionNumberer: SectionNumberer
}) {
  // Common guide translations
  const tGuide = useTranslations('guide')

  // Scoped translators for each resource category
  const tWebsites = useTranslations('guide.sections.resources.websites')
  const tPrograms = useTranslations('guide.sections.resources.programs')
  const tYoutube = useTranslations('guide.sections.resources.youtube')
  const tStudyTexts = useTranslations('guide.sections.resources.studyTexts')
  const tTips = useTranslations('guide.sections.resources.tips')

  const resourceCategories: ResourceCategoryType[] = [
    {
      title: tGuide(`titles.${GUIDE_TITLES.WEBSITES}`),
      icon: MessageSquare,
      iconColor: 'text-indigo-400',
      iconBg: 'bg-indigo-500/10',
      resources: [
        {
          title: 'AoPS',
          fullName: 'Art of Problem Solving',
          description: tWebsites('aops'),
          link: 'https://artofproblemsolving.com/',
        },
        {
          title: 'MODS',
          fullName: 'Math Olympiad Discord Server',
          description: tWebsites('mods'),
          link: 'https://discord.gg/mods',
        },
        {
          title: 'Evan Chen',
          description: tWebsites('evanchen'),
          link: 'https://web.evanchen.cc/',
        },
      ],
    },
    {
      title: tGuide(`titles.${GUIDE_TITLES.PROGRAMS}`),
      icon: Wrench,
      iconColor: 'text-violet-400',
      iconBg: 'bg-violet-500/10',
      resources: [
        {
          title: 'GeoGebra',
          description: tGuide.rich('sections.resources.programs.geogebra', {
            app: (chunks) => <span className="text-no-break">{chunks}</span>,
          }),
          link: 'https://www.geogebra.org/',
        },
        {
          title: 'WolframAlpha',
          description: tPrograms('wolframalpha'),
          link: 'https://www.wolframalpha.com/',
        },
        {
          title: 'Overleaf',
          description: tPrograms('overleaf'),
          link: 'https://www.overleaf.com/',
        },
      ],
    },
    {
      title: tGuide(`titles.${GUIDE_TITLES.YOUTUBE}`),
      icon: Youtube,
      iconColor: 'text-pink-400',
      iconBg: 'bg-pink-500/10',
      resources: [
        {
          title: 'MindYourDecisions',
          description: tYoutube('mindyourdecisions'),
          link: 'https://www.youtube.com/@MindYourDecisions',
        },
        {
          title: 'Michael Penn',
          description: tYoutube('michaelpenn'),
          link: 'https://www.youtube.com/c/MichaelPennMath',
        },
        {
          title: '3Blue1Brown',
          description: tYoutube('3blue1brown'),
          link: 'https://www.youtube.com/c/3blue1brown',
        },
      ],
    },
    {
      title: tGuide(`titles.${GUIDE_TITLES.STUDY_TEXTS}`),
      icon: BookOpen,
      iconColor: 'text-emerald-400',
      iconBg: 'bg-emerald-500/10',
      description: tStudyTexts('intro'),
      resources: [
        {
          title: tStudyTexts('titles.ourMaterials'),
          description: tStudyTexts('ourMaterials'),
          link: `${getSiteUrl()}${ROUTES.HANDOUTS}`,
        },
        {
          title: tStudyTexts('titles.kmsCollection'),
          description: tStudyTexts('kmsCollection'),
          link: 'https://kms.sk/zbierka/',
        },
        {
          title: tStudyTexts('titles.sampleSolutions'),
          description: tGuide.rich('sections.resources.studyTexts.sampleSolutions', {
            link: (chunks) => (
              <AppLink href="#seminars" className={GUIDE_STYLES.link}>
                {chunks}
              </AppLink>
            ),
          }),
        },
        {
          title: tStudyTexts('titles.guidedProblems'),
          description: tStudyTexts('guidedProblems'),
        },
        {
          title: tStudyTexts('titles.praseLibrary'),
          description: tStudyTexts('praseLibrary'),
          link: 'https://prase.cz/knihovna/',
        },
      ],
      renderFooter: () => <TipBox variant="info">{tTips('footer')}</TipBox>,
    },
  ]

  return (
    <GuideSection
      title={tGuide(`titles.${GUIDE_TITLES.RESOURCES}`)}
      description={tGuide('sections.resources.description')}
      icon={{ type: 'lucide', icon: Link2 }}
      iconColor="text-blue-400"
      iconBackground="bg-blue-500/10"
      sectionNumberer={sectionNumberer}
    >
      <div className={GUIDE_STYLES.sectionSpacing}>
        {resourceCategories.map((category, index) => (
          <ResourceCategory key={index} category={category} sectionNumberer={sectionNumberer} />
        ))}
      </div>
    </GuideSection>
  )
}
