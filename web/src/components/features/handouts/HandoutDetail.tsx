import { MessageSquare, Users } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { CommentSection } from '@/components/features/comments/components/CommentSection'
import type {
  Document,
  HandoutData,
  HandoutImage,
  RawContentBlock,
} from '@/components/features/handouts/handout-content-types'
import type { SectionMetadata } from '@/components/features/handouts/handout-utils'
import {
  renderBlocks,
  renderInlineContent,
  renderRawContentBlock,
} from '@/components/math/ContentRenderer'
import { MathRendererClient } from '@/components/math/MathRendererClient'
import { ArticleSection } from '@/components/shared/components/ArticleSection'
import { ACCENT_COLOR_MAP } from '@/components/shared/utils/accent-colors'
import { cn } from '@/components/shared/utils/css-utils'
import { ANCHORS, getLocalizedAnchor, type Locale } from '@/i18n/i18n'

import { CollapsibleCard, type DisclosurePanelProps } from './Cards'
import {
  ENVIRONMENT_BADGE,
  ENVIRONMENT_TEXT_COLOR,
  type HandoutEnvironmentType,
  HINT_BADGE,
  HINT_TEXT_COLOR,
} from './handout-colors'
import { HandoutActions } from './HandoutActions'

/**
 * Translation function for the 'handouts' namespace
 */
type HandoutsTranslator = ReturnType<typeof useTranslations<'handouts'>>

/**
 * Props for the HandoutDetail component.
 */
type HandoutDetailProps = {
  /** The handout data */
  handout: HandoutData
  /** The authors of the handout */
  authors: string[]
  /** The slug for the handout */
  slug: string
  /** Permanent content ID (nanoid) */
  contentId: string
  /** PDF filename stem for R2 downloads, e.g. "fun-algebra.sk" */
  pdfFilenameStem: string
  /** Metadata for each section in the handout */
  sectionMetadata: SectionMetadata[]
  /** The current locale */
  locale: Locale
}

/**
 * All images are of type 'handouts', obviously. This is passed to the
 * render functions to ensure fetching images from a correct endpoint.
 */
const imageType = 'handouts'

// Render a title that can be either a string or RawContentBlock
function renderTitle(
  title: RawContentBlock | null | undefined,
  imagesById: Record<string, HandoutImage>,
  imageMissingText: string
): React.ReactNode {
  if (!title) return null

  if (title.type === 'text') {
    return title.text
  }

  // For complex titles, render as React elements to preserve formatting.
  // Crucially, use renderInlineContent to avoid block-level wrappers like <p>.
  if (title.type === 'paragraph' || title.type === 'bold' || title.type === 'italic') {
    return renderInlineContent(title.content, imagesById, imageType, imageMissingText)
  }

  // Fallback for unexpected types, though paragraph should cover most cases.
  return renderRawContentBlock(title, imagesById, imageType, imageMissingText)
}

function renderDifficultyStars(difficulty: number): React.ReactNode {
  if (difficulty === 0) return null
  return <sup className={ENVIRONMENT_TEXT_COLOR.problem}>{'*'.repeat(difficulty)}</sup>
}

function renderDocumentSections(
  documentContent: Document,
  sectionMetadata: Array<{
    id: string
    label: string
    title: string
    level: number
    sectionIndex: number
  }>,
  imagesById: Record<string, HandoutImage>,
  t: HandoutsTranslator,
  imageMissingText: string
) {
  const localizedEnvironmentLabelByType: Record<HandoutEnvironmentType, string> = {
    theorem: t('environments.theorem'),
    exercise: t('environments.exercise'),
    example: t('environments.example'),
    problem: t('environments.problem'),
  }

  const environmentCounters: Record<HandoutEnvironmentType, number> = {
    theorem: 0,
    exercise: 0,
    example: 0,
    problem: 0,
  }

  // Localized slugs for environment type names used in anchor IDs
  const environmentTypeSlugMap: Record<HandoutEnvironmentType, string> = {
    theorem: t('environments.slugs.theorem'),
    exercise: t('environments.slugs.exercise'),
    example: t('environments.slugs.example'),
    problem: t('environments.slugs.problem'),
  }

  const getNextEnvironmentNumber = (environmentType: keyof typeof environmentCounters) => {
    environmentCounters[environmentType] += 1
    return `${environmentCounters[environmentType]}`
  }

  /**
   * Generate a hierarchical ID for an environment (theorem/problem/example/exercise).
   * Format: {section-slug}-{type-slug}-{number}
   * Example: "zakladne-vety-uloha-2"
   */
  const generateEnvironmentId = (
    sectionSlug: string,
    environmentType: keyof typeof environmentCounters,
    environmentNumber: string
  ): string => {
    const typeSlug = environmentTypeSlugMap[environmentType]
    return `${sectionSlug}-${typeSlug}-${environmentNumber}`
  }
  const renderedSections: React.ReactNode[] = []

  documentContent.sections.forEach((section, index) => {
    // Get pre-computed metadata for this section (guaranteed to exist at same index)
    const metadata = sectionMetadata[index]

    renderedSections.push(
      <ArticleSection
        key={`${metadata.label}-${section.title}`}
        id={metadata.id}
        number={metadata.label}
        title={section.title}
        titleContent={section.title}
      >
        {section.text.content.map((contentBlock, contentBlockIndex) => {
          if (
            contentBlock.type === 'theorem' ||
            contentBlock.type === 'exercise' ||
            contentBlock.type === 'example' ||
            contentBlock.type === 'problem'
          ) {
            const environmentNumber = getNextEnvironmentNumber(contentBlock.type)
            const environmentId = generateEnvironmentId(
              metadata.id,
              contentBlock.type,
              environmentNumber
            )
            const environmentBaseTitle = localizedEnvironmentLabelByType[contentBlock.type]
            const userProvidedTitle = renderTitle(contentBlock.title, imagesById, imageMissingText)
            const difficultyStars =
              contentBlock.type === 'problem'
                ? renderDifficultyStars(contentBlock.difficulty)
                : null
            const mainTitle = (
              <>
                {environmentBaseTitle} {environmentNumber}
                {difficultyStars}
              </>
            )

            const subtitleBadge = userProvidedTitle ? userProvidedTitle : undefined

            const disclosures: DisclosurePanelProps[] = []
            switch (contentBlock.type) {
              case 'theorem':
                if (contentBlock.proof.length > 0) {
                  disclosures.push({
                    label: t('labels.proof'),
                    textColorClass: ENVIRONMENT_TEXT_COLOR.theorem,
                    badge: ENVIRONMENT_BADGE.theorem,
                    badgeContent: (
                      <span className="w-[8px] h-[8px] bg-current rounded-[2px]"></span>
                    ),
                    children: renderBlocks(
                      contentBlock.proof,
                      imagesById,
                      imageType,
                      imageMissingText
                    ),
                  })
                }
                break
              case 'exercise':
              case 'example':
                if (contentBlock.solution.length > 0) {
                  disclosures.push({
                    label: t('labels.solution'),
                    textColorClass: ENVIRONMENT_TEXT_COLOR[contentBlock.type],
                    badge: ENVIRONMENT_BADGE[contentBlock.type],
                    badgeContent: '✓',
                    children: renderBlocks(
                      contentBlock.solution,
                      imagesById,
                      imageType,
                      imageMissingText
                    ),
                  })
                }
                break
              case 'problem':
                contentBlock.hints.forEach((hint, hintIndex) => {
                  disclosures.push({
                    label: t('labels.hint'),
                    textColorClass: HINT_TEXT_COLOR,
                    badge: HINT_BADGE,
                    badgeContent: hintIndex + 1,
                    children: renderBlocks(hint, imagesById, imageType, imageMissingText),
                  })
                })
                if (contentBlock.solution.length > 0) {
                  disclosures.push({
                    label: t('labels.solution'),
                    textColorClass: ENVIRONMENT_TEXT_COLOR.problem,
                    badge: ENVIRONMENT_BADGE.problem,
                    badgeContent: '✓',
                    children: renderBlocks(
                      contentBlock.solution,
                      imagesById,
                      imageType,
                      imageMissingText
                    ),
                  })
                }
                break
            }

            return (
              <div key={`${metadata.label}-env-${contentBlockIndex}`}>
                <CollapsibleCard
                  type={contentBlock.type}
                  title={mainTitle}
                  subtitle={subtitleBadge}
                  id={environmentId}
                  disclosures={disclosures}
                >
                  {renderBlocks(contentBlock.body, imagesById, imageType, imageMissingText)}
                </CollapsibleCard>
              </div>
            )
          }

          return (
            <div key={`${metadata.label}-blk-${contentBlockIndex}`}>
              {renderRawContentBlock(
                contentBlock as RawContentBlock,
                imagesById,
                imageType,
                imageMissingText
              )}
            </div>
          )
        })}
      </ArticleSection>
    )
  })

  return <div className="article--math">{renderedSections}</div>
}

/**
 * Renders the detailed view of a handout.
 */
export default function HandoutDetail({
  handout,
  authors,
  sectionMetadata,
  contentId,
  pdfFilenameStem,
  locale,
}: HandoutDetailProps) {
  // The translations objects
  const t = useTranslations('handouts')
  const tContent = useTranslations('ui.content')
  const imageMissingText = tContent('imageMissing')

  // The handout data
  const { document, images } = handout

  // Create images lookup map by their id
  const imagesById: Record<string, HandoutImage> = {}
  for (const image of images) imagesById[image.contentId] = image

  return (
    <>
      {/* Header */}
      <header className="lg:mb-12">
        <div className="mb-6">
          <h1 className="text-5xl sm:text-6xl lg:text-5xl font-bold text-foreground tracking-tight leading-tight">
            <MathRendererClient content={document.subtitle || document.title || ''} />
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          {document.subtitle && (
            <div
              className={cn(
                'inline-flex items-center gap-2 px-4 py-2 rounded-full border border-foreground/10',
                ACCENT_COLOR_MAP.blue.bg,
                ACCENT_COLOR_MAP.blue.text
              )}
            >
              <div className="w-2 h-2 rounded-full bg-current"></div>
              <span className="font-medium text-sm">
                <MathRendererClient content={document.title || ''} />
              </span>
            </div>
          )}

          {/* Authors */}
          {authors.length > 0 && (
            <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-foreground/5 border border-foreground/10 leading-5">
              <div className="flex items-center gap-2">
                <Users className="size-4 text-muted-foreground" aria-hidden />
                <span className="text-sm uppercase font-semibold text-muted-foreground">
                  {' '}
                  {authors.length > 1 ? t('labels.authors') : t('labels.author')}{' '}
                </span>
              </div>
              <span className="text-foreground/85 font-semi-bold text-sm">
                {' '}
                {authors.join(', ')}{' '}
              </span>
            </div>
          )}

          {/* Three-dot overflow menu with share and PDF downloads */}
          <HandoutActions pdfFilenameStem={pdfFilenameStem} />
        </div>
      </header>

      {/* Math Sections */}
      {renderDocumentSections(document, sectionMetadata, imagesById, t, imageMissingText)}

      {/* Comments Section */}
      <ArticleSection
        icon={<MessageSquare size={28} />}
        title={t('labels.comments')}
        id={getLocalizedAnchor(ANCHORS.COMMENTS, locale)}
        className="mt-8 sm:mt-12 md:mt-16"
      >
        <CommentSection variant="inline" target={{ targetType: 'Handout', targetId: contentId }} />
      </ArticleSection>
    </>
  )
}
