import { ChevronRight, MessageSquare, Users } from 'lucide-react'
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
import { cn } from '@/components/shared/utils/css-utils'
import { ANCHORS, getLocalizedAnchor, type Locale } from '@/i18n/i18n'

import { CollapsibleCard } from './Cards'

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
  return <sup className="text-purple-400">{'*'.repeat(difficulty)}</sup>
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
  /** Environment types supported in handout content */
  type EnvironmentType = 'theorem' | 'exercise' | 'example' | 'problem'

  const localizedEnvironmentLabelByType: Record<EnvironmentType, string> = {
    theorem: t('environments.theorem'),
    exercise: t('environments.exercise'),
    example: t('environments.example'),
    problem: t('environments.problem'),
  }
  const environmentTextColorClassByType: Record<EnvironmentType, string> = {
    theorem: 'text-green-300',
    exercise: 'text-yellow-300',
    example: 'text-blue-300',
    problem: 'text-purple-300',
  }

  const environmentBadgeClassByType: Record<
    EnvironmentType,
    { text: string; bg: string; border: string }
  > = {
    theorem: {
      text: 'text-green-200',
      bg: 'bg-green-500/15',
      border: 'border-green-400/20',
    },
    exercise: {
      text: 'text-yellow-200',
      bg: 'bg-yellow-500/15',
      border: 'border-yellow-400/20',
    },
    example: {
      text: 'text-blue-200',
      bg: 'bg-blue-500/15',
      border: 'border-blue-400/20',
    },
    problem: {
      text: 'text-purple-200',
      bg: 'bg-purple-500/15',
      border: 'border-purple-400/20',
    },
  }

  const environmentCounters: Record<EnvironmentType, number> = {
    theorem: 0,
    exercise: 0,
    example: 0,
    problem: 0,
  }

  // Localized slugs for environment type names used in anchor IDs
  const environmentTypeSlugMap: Record<EnvironmentType, string> = {
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

            if (contentBlock.type === 'theorem') {
              return (
                <div key={`${metadata.label}-env-${contentBlockIndex}`}>
                  <CollapsibleCard
                    type="theorem"
                    title={mainTitle}
                    subtitle={subtitleBadge}
                    id={environmentId}
                  >
                    {renderBlocks(contentBlock.body, imagesById, imageType, imageMissingText)}
                    <div className="mt-3 rounded-xl border border-white/10 divide-y divide-white/10 overflow-hidden">
                      <details className="group">
                        <summary
                          className={cn(
                            'flex items-center justify-between gap-3 px-4 sm:px-5 py-3 sm:py-3.5  hover:bg-white/5 cursor-pointer [&::-webkit-details-marker]:hidden',
                            environmentTextColorClassByType.theorem
                          )}
                        >
                          <span className="ui-text inline-flex items-center gap-2 font-semibold leading-6">
                            <span
                              className={cn(
                                'inline-flex h-5 min-w-5 items-center justify-center rounded-full text-xs font-semibold border',
                                environmentBadgeClassByType.theorem.bg,
                                environmentBadgeClassByType.theorem.text,
                                environmentBadgeClassByType.theorem.border
                              )}
                            >
                              <span className="w-[8px] h-[8px] bg-green-200 rounded-[2px]"></span>
                            </span>
                            {t('labels.proof')}
                          </span>
                          <ChevronRight
                            size={16}
                            className="opacity-70 transition-transform group-open:rotate-90"
                          />
                        </summary>
                        <div className="px-4 sm:px-5 pb-4 sm:pb-5 pt-3 sm:pt-4 text-gray-300">
                          {renderBlocks(
                            contentBlock.proof,
                            imagesById,
                            imageType,
                            imageMissingText
                          )}
                        </div>
                      </details>
                    </div>
                  </CollapsibleCard>
                </div>
              )
            }

            if (contentBlock.type === 'exercise') {
              return (
                <div key={`${metadata.label}-env-${contentBlockIndex}`}>
                  <CollapsibleCard
                    type="exercise"
                    title={mainTitle}
                    subtitle={subtitleBadge}
                    id={environmentId}
                  >
                    {renderBlocks(contentBlock.body, imagesById, imageType, imageMissingText)}
                    <div className="mt-3 rounded-xl border border-white/10 divide-y divide-white/10 overflow-hidden">
                      <details className="group">
                        <summary
                          className={cn(
                            'flex items-center justify-between gap-3 px-4 sm:px-5 py-3 sm:py-3.5  hover:bg-white/5 cursor-pointer [&::-webkit-details-marker]:hidden',
                            environmentTextColorClassByType.exercise
                          )}
                        >
                          <span className="ui-text inline-flex items-center gap-2 font-semibold leading-6">
                            <span
                              className={cn(
                                'inline-flex h-5 min-w-5 items-center justify-center rounded-full text-xs font-semibold border',
                                environmentBadgeClassByType.exercise.bg,
                                environmentBadgeClassByType.exercise.text,
                                environmentBadgeClassByType.exercise.border
                              )}
                            >
                              ✓
                            </span>
                            {t('labels.solution')}
                          </span>
                          <ChevronRight
                            size={16}
                            className="opacity-70 transition-transform group-open:rotate-90"
                          />
                        </summary>
                        <div className="px-4 sm:px-5 pb-4 sm:pb-5 pt-3 sm:pt-4 text-gray-300">
                          {renderBlocks(
                            contentBlock.solution,
                            imagesById,
                            imageType,
                            imageMissingText
                          )}
                        </div>
                      </details>
                    </div>
                  </CollapsibleCard>
                </div>
              )
            }

            if (contentBlock.type === 'example') {
              return (
                <div key={`${metadata.label}-env-${contentBlockIndex}`}>
                  <CollapsibleCard
                    type="example"
                    title={mainTitle}
                    subtitle={subtitleBadge}
                    id={environmentId}
                  >
                    {renderBlocks(contentBlock.body, imagesById, imageType, imageMissingText)}
                    <div className="mt-3 rounded-xl border border-white/10 divide-y divide-white/10 overflow-hidden">
                      <details className="group">
                        <summary
                          className={cn(
                            'flex items-center justify-between gap-3 px-4 sm:px-5 py-3 sm:py-3.5  hover:bg-white/5 cursor-pointer [&::-webkit-details-marker]:hidden',
                            environmentTextColorClassByType.example
                          )}
                        >
                          <span className="ui-text inline-flex items-center gap-2 font-semibold leading-6">
                            <span
                              className={cn(
                                'inline-flex h-5 min-w-5 items-center justify-center rounded-full text-xs font-semibold border',
                                environmentBadgeClassByType.example.bg,
                                environmentBadgeClassByType.example.text,
                                environmentBadgeClassByType.example.border
                              )}
                            >
                              ✓
                            </span>
                            {t('labels.solution')}
                          </span>
                          <ChevronRight
                            size={16}
                            className="opacity-70 transition-transform group-open:rotate-90"
                          />
                        </summary>
                        <div className="px-4 sm:px-5 pb-4 sm:pb-5 pt-3 sm:pt-4 text-gray-300">
                          {renderBlocks(
                            contentBlock.solution,
                            imagesById,
                            imageType,
                            imageMissingText
                          )}
                        </div>
                      </details>
                    </div>
                  </CollapsibleCard>
                </div>
              )
            }

            // contentBlock.type === 'problem'
            return (
              <div key={`${metadata.label}-env-${contentBlockIndex}`}>
                <CollapsibleCard
                  type="problem"
                  title={mainTitle}
                  subtitle={subtitleBadge}
                  id={environmentId}
                >
                  <div>
                    {renderBlocks(contentBlock.body, imagesById, imageType, imageMissingText)}
                  </div>
                  <div className="mt-3 rounded-xl border border-white/10 divide-y divide-white/10 overflow-hidden">
                    {contentBlock.hints.length > 0 &&
                      contentBlock.hints.map((hint, hintIndex) => (
                        <details key={`hint-${hintIndex}`} className="group">
                          <summary className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 sm:py-3.5  text-amber-200 hover:bg-white/5 cursor-pointer [&::-webkit-details-marker]:hidden">
                            <span className="ui-text inline-flex items-center gap-2 font-medium leading-6">
                              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500/15 text-xs font-semibold text-amber-200 border border-amber-400/20">
                                {hintIndex + 1}
                              </span>
                              {t('labels.hint')}
                            </span>
                            <ChevronRight
                              size={16}
                              className="opacity-70 transition-transform group-open:rotate-90"
                            />
                          </summary>
                          <div className="px-4 sm:px-5 pb-4 sm:pb-5 pt-3 sm:pt-4 text-gray-300">
                            {renderBlocks(hint, imagesById, imageType, imageMissingText)}
                          </div>
                        </details>
                      ))}

                    {contentBlock.solution && (
                      <details className="group">
                        <summary
                          className={cn(
                            'flex items-center justify-between gap-3 px-4 sm:px-5 py-3 sm:py-3.5  hover:bg-white/5 cursor-pointer [&::-webkit-details-marker]:hidden',
                            environmentTextColorClassByType.problem
                          )}
                        >
                          <span className="ui-text inline-flex items-center gap-2 font-semibold leading-6">
                            <span
                              className={cn(
                                'inline-flex h-5 min-w-5 items-center justify-center rounded-full text-xs font-semibold border',
                                environmentBadgeClassByType.problem.bg,
                                environmentBadgeClassByType.problem.text,
                                environmentBadgeClassByType.problem.border
                              )}
                            >
                              ✓
                            </span>
                            {t('labels.solution')}
                          </span>
                          <ChevronRight
                            size={16}
                            className="opacity-70 transition-transform group-open:rotate-90"
                          />
                        </summary>
                        <div className="px-4 sm:px-5 pb-4 sm:pb-5 pt-3 sm:pt-4 text-gray-300">
                          {renderBlocks(
                            contentBlock.solution,
                            imagesById,
                            imageType,
                            imageMissingText
                          )}
                        </div>
                      </details>
                    )}
                  </div>
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
  locale,
}: HandoutDetailProps) {
  const t = useTranslations('handouts')
  const tContent = useTranslations('ui.content')
  const imageMissingText = tContent('imageMissing')
  const { document: documentContent, images } = handout
  // Create images lookup map
  const imagesById: Record<string, HandoutImage> = {}
  for (const image of images) imagesById[image.contentId] = image

  return (
    <>
      {/* Header */}
      <header className="lg:mb-12">
        <div className="mb-6">
          <h1 className="text-5xl sm:text-6xl lg:text-5xl font-bold text-white tracking-tight leading-tight">
            <MathRendererClient content={documentContent.subtitle || documentContent.title || ''} />
          </h1>
        </div>

        {/* Title */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          {documentContent.subtitle && (
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-blue-500/15 to-purple-500/15 border border-blue-400/20">
              <div className="w-2 h-2 rounded-full bg-blue-400"></div>
              <span className="text-blue-200 font-medium text-sm">
                <MathRendererClient content={documentContent.title || ''} />
              </span>
            </div>
          )}

          {/* Authors */}
          {authors.length > 0 && (
            <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-white/5 border border-white/10 leading-5">
              <div className="flex items-center gap-2">
                <Users className="size-4 text-gray-400" aria-hidden />
                <span className="text-sm uppercase font-semibold text-gray-400">
                  {' '}
                  {authors.length > 1 ? t('labels.authors') : t('labels.author')}{' '}
                </span>
              </div>
              <span className="text-gray-200 font-semi-bold text-sm"> {authors.join(', ')} </span>
            </div>
          )}
        </div>
      </header>

      {/* Math Sections */}
      {renderDocumentSections(documentContent, sectionMetadata, imagesById, t, imageMissingText)}

      {/* Comments Section */}
      <ArticleSection
        icon={<MessageSquare size={28} />}
        title={t('labels.comments')}
        id={getLocalizedAnchor(ANCHORS.COMMENTS, locale)}
        className="mt-8 sm:mt-12 md:mt-16 min-h-[60vh]"
      >
        <CommentSection variant="inline" target={{ targetType: 'Handout', targetId: contentId }} />
      </ArticleSection>
    </>
  )
}
