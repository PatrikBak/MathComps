import { BookOpen, Link2, type LucideIcon, MessageSquare, Wrench } from 'lucide-react'
import { useTranslations } from 'next-intl'
import React from 'react'

import { AppLink } from '@/components/shared/components/AppLink'
import { YoutubeIcon } from '@/components/shared/components/brand-icons'
import type { AccentColor } from '@/components/shared/utils/accent-colors'
import { getSiteUrl } from '@/components/shared/utils/url-utils'
import type { SectionNumberer } from '@/components/table-of-contents/SectionNumberer'
import { ROUTES } from '@/i18n/i18n'

import { ExternalLinkButton } from './layout/ExternalLinkButton'
import { GUIDE_TITLES } from './layout/guide-structure'
import { GuideCard } from './layout/GuideCard'
import { GuideHeading } from './layout/GuideHeading'
import { GuideSection } from './layout/GuideSection'
import { GuideText } from './layout/GuideText'
import TipBox from './layout/TipBox'

/**
 * A single resource entry (website, tool, video channel, etc.).
 */
type Resource = {
  /** Display title (e.g., "AoPS", "GeoGebra"). */
  title: string
  /** Optional expanded name shown below the title. */
  fullName?: string
  /** Descriptive text or rich content for the resource. */
  description: string | React.ReactNode
  /** External URL to the resource. */
  link?: string
}

/**
 * Configuration for a group of related resources.
 */
type ResourceCategoryType = {
  /** Category heading (e.g., "Websites", "YouTube"). */
  title: string
  /** Lucide icon displayed in the section header. */
  icon: LucideIcon
  /** Decorative accent color from the approved palette. */
  accent: AccentColor
  /** Optional introductory text for the category. */
  description?: string | React.ReactNode
  /** Individual resources within this category. */
  resources: Resource[]
  /** Optional footer renderer for tips or notes. */
  renderFooter?: () => React.ReactNode
}

/**
 * Render a single resource card with name, optional acronym, description, and link.
 */
function renderResourceCard(resource: Resource, resourceIndex: number) {
  return (
    <GuideCard key={resourceIndex}>
      {/* Header with name and optional acronym */}
      <div className="mb-2 sm:mb-3">
        <GuideHeading level="h3" className="mb-0">
          {resource.title}
        </GuideHeading>
        {resource.fullName && (
          <GuideText variant="acronym" className="mt-0.5">
            ({resource.fullName})
          </GuideText>
        )}
      </div>

      {/* Link */}
      {resource.link && (
        <div className="mb-3">
          <ExternalLinkButton href={resource.link} />
        </div>
      )}

      {/* Description */}
      <GuideText as="div">{resource.description}</GuideText>
    </GuideCard>
  )
}

/**
 * Props for the {@link ResourceCategory} component.
 */
type ResourceCategoryProps = {
  /** Category configuration containing title, icon, accent, and resources. */
  category: ResourceCategoryType
  /** Section numberer for hierarchical section numbering. */
  sectionNumberer: SectionNumberer
}

/**
 * Renders a single resource category as a subsection with individual resource cards.
 */
function ResourceCategory({ category, sectionNumberer }: ResourceCategoryProps) {
  // Get translations
  const t = useTranslations('guide')

  return (
    <GuideSection
      title={category.title}
      description={category.description}
      icon={{ type: 'lucide', icon: category.icon }}
      accent={category.accent}
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

/**
 * Props for the {@link ResourcesSection} component.
 */
type ResourcesSectionProps = {
  /** Section numberer for hierarchical section numbering. */
  sectionNumberer: SectionNumberer
}

/**
 * Guide section listing useful resources grouped by category.
 */
export default function ResourcesSection({ sectionNumberer }: ResourcesSectionProps) {
  // Common guide translations
  const tGuide = useTranslations('guide')

  // Scoped translators for each resource category
  const tWebsites = useTranslations('guide.sections.resources.websites')
  const tPrograms = useTranslations('guide.sections.resources.programs')
  const tYoutube = useTranslations('guide.sections.resources.youtube')
  const tStudyTexts = useTranslations('guide.sections.resources.studyTexts')
  const tTips = useTranslations('guide.sections.resources.tips')

  // List of all categories resources to be rendered
  const resourceCategories: ResourceCategoryType[] = [
    {
      title: tGuide(`titles.${GUIDE_TITLES.WEBSITES}`),
      icon: MessageSquare,
      accent: 'blue',
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
      accent: 'purple',
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
      icon: YoutubeIcon,
      accent: 'red',
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
      accent: 'emerald',
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
              <AppLink
                href="#seminars"
                className="text-link underline transition-colors hover:text-link-hover"
              >
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
      renderFooter: () => <TipBox variant="note">{tTips('footer')}</TipBox>,
    },
  ]

  return (
    <GuideSection
      title={tGuide(`titles.${GUIDE_TITLES.RESOURCES}`)}
      description={tGuide('sections.resources.description')}
      icon={{ type: 'lucide', icon: Link2 }}
      accent="sky"
      sectionNumberer={sectionNumberer}
    >
      <div className="space-y-4 sm:space-y-5 md:space-y-6">
        {resourceCategories.map((category, index) => (
          <ResourceCategory key={index} category={category} sectionNumberer={sectionNumberer} />
        ))}
      </div>
    </GuideSection>
  )
}
