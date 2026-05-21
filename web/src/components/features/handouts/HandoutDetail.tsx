import { MessageSquare, Users } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { preload } from 'react-dom'

import { CommentSection } from '@/components/features/comments/components/CommentSection'
import type {
  Document,
  HandoutData,
  HandoutImage,
  RawContentBlock,
} from '@/components/features/handouts/handout-content-types'
import type { SectionMetadata } from '@/components/features/handouts/handout-utils'
import { getProblemImageUrl } from '@/components/features/problems/services/problem-api-urls'
import { MathRendererClient } from '@/components/math/MathRendererClient'
import { inlineBlockToMathSource } from '@/components/math/utils/math-render'
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
import { renderBlocks, renderRawContentBlock } from './handout-content-renderer'
import { HandoutActions } from './HandoutActions'

/**
 * Translation function bound to the {@link 'handouts'} message namespace.
 */
type HandoutsTranslator = ReturnType<typeof useTranslations<'handouts'>>

/**
 * Props for the {@link HandoutDetail} component.
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
 * Renders the optional title of an environment block (e.g. theorem name,
 * definition concept) as a single math-aware string, matching how the
 * document title and subtitle are rendered.
 *
 * @param title The optional inline title block, or null/undefined if absent.
 * @returns The rendered React node, or null if no title was provided.
 */
function renderTitle(title: RawContentBlock | null | undefined): React.ReactNode {
  // No title
  if (!title) return null

  // Reconstruct the raw source string so KaTeX sees the whole title at once
  const rawString = inlineBlockToMathSource(title)
  if (!rawString) return null

  // Single MathRendererClient pass keeps text and math on the same baseline
  return <MathRendererClient content={rawString} />
}

/**
 * Renders the difficulty indicator for a problem as a superscript run of asterisks.
 *
 * @param difficulty The numeric difficulty rating; 0 means no stars are shown.
 * @returns A `<sup>` element with the stars, or null when difficulty is 0.
 */
function renderDifficultyStars(difficulty: number): React.ReactNode {
  // No stars
  if (difficulty === 0) return null

  // Some starts as a superscript
  return <sup className={ENVIRONMENT_TEXT_COLOR.problem}>{'*'.repeat(difficulty)}</sup>
}

/**
 * Renders all sections of a handout {@link Document} as a sequence of
 * {@link ArticleSection} blocks, with each environment (theorem, exercise,
 * example, problem, definition) wrapped in a {@link CollapsibleCard} carrying
 * its proof / solution / hint disclosures. Environment numbers are tracked
 * per-type across the whole document.
 *
 * @param documentContent The parsed {@link Document} to render.
 * @param sectionMetadata Pre-computed per-section metadata (id, label, title, level).
 * @param imagesById Lookup map of {@link HandoutImage}s keyed by content ID.
 * @param t Translator bound to the handouts namespace.
 * @param imageMissingText Fallback text for missing images.
 * @returns The rendered document tree wrapped in a math-styled container.
 */
function renderDocumentSections(
  documentContent: Document,
  sectionMetadata: SectionMetadata[],
  imagesById: Record<string, HandoutImage>,
  t: HandoutsTranslator,
  imageMissingText: string
): React.ReactNode {
  // Translate the environment labels
  const localizedEnvironmentLabelByType: Record<HandoutEnvironmentType, string> = {
    theorem: t('environments.theorem'),
    exercise: t('environments.exercise'),
    example: t('environments.example'),
    problem: t('environments.problem'),
    definition: t('environments.definition'),
  }

  // Translate the environment slugs
  const environmentTypeSlugMap: Record<HandoutEnvironmentType, string> = {
    theorem: t('environments.slugs.theorem'),
    exercise: t('environments.slugs.exercise'),
    example: t('environments.slugs.example'),
    problem: t('environments.slugs.problem'),
    definition: t('environments.slugs.definition'),
  }

  // Running counters per environment type — shared across the whole document,
  // not reset per section. Pre-incremented at each environment site to claim
  // the next number (e.g. "Theorem 3", "Definition 2").
  const environmentCounters: Record<HandoutEnvironmentType, number> = {
    theorem: 0,
    exercise: 0,
    example: 0,
    problem: 0,
    definition: 0,
  }

  // Render each section
  const renderedSections = documentContent.sections.map((section, index) => {
    // Get pre-computed metadata for this section (guaranteed to exist at same index)
    const metadata = sectionMetadata[index]

    return (
      <ArticleSection
        key={`${metadata.label}-${section.title}`}
        id={metadata.id}
        number={metadata.label}
        title={section.title}
        titleContent={<MathRendererClient content={section.title} />}
      >
        {section.text.content.map((contentBlock, contentBlockIndex) => {
          if (
            contentBlock.type === 'theorem' ||
            contentBlock.type === 'exercise' ||
            contentBlock.type === 'example' ||
            contentBlock.type === 'problem' ||
            contentBlock.type === 'definition'
          ) {
            // Pre-increment claims the next number for this environment type.
            const environmentNumber = `${++environmentCounters[contentBlock.type]}`

            // Hierarchical anchor ID, e.g. `"zakladne-vety-uloha-2"`. Format:
            // `{section-slug}-{type-slug}-{number}`.
            const environmentId = `${metadata.id}-${environmentTypeSlugMap[contentBlock.type]}-${environmentNumber}`

            // Localized environment label, e.g. "Theorem" / "Definice" / "Úloha".
            const environmentBaseTitle = localizedEnvironmentLabelByType[contentBlock.type]

            // The optional inline name authored in TeX (e.g. \Definition{Aritmetický průměr}).
            const userProvidedTitle = renderTitle(contentBlock.title)

            // Difficulty asterisks are problem-only (e.g. "Úloha 4**").
            const difficultyStars =
              contentBlock.type === 'problem'
                ? renderDifficultyStars(contentBlock.difficulty)
                : null

            // Composed card heading, e.g. "Theorem 3" or "Úloha 4**".
            const mainTitle = (
              <>
                {environmentBaseTitle} {environmentNumber}
                {difficultyStars}
              </>
            )

            // Subtitle badge: shown only when the author provided a title.
            const subtitleBadge = userProvidedTitle ? userProvidedTitle : undefined

            // The collapsible parts of the environment
            const disclosures: DisclosurePanelProps[] = []
            switch (contentBlock.type) {
              case 'definition':
                // Definitions are self-contained — no proof, solution, or hints.
                break
              case 'theorem':
                if (contentBlock.proof.length > 0) {
                  disclosures.push({
                    label: t('labels.proof'),
                    textColorClass: ENVIRONMENT_TEXT_COLOR.theorem,
                    badge: ENVIRONMENT_BADGE.theorem,
                    badgeContent: (
                      <span className="w-[8px] h-[8px] bg-current rounded-[2px]"></span>
                    ),
                    children: renderBlocks(contentBlock.proof, imagesById, imageMissingText),
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
                    children: renderBlocks(contentBlock.solution, imagesById, imageMissingText),
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
                    children: renderBlocks(hint, imagesById, imageMissingText),
                  })
                })
                if (contentBlock.solution.length > 0) {
                  disclosures.push({
                    label: t('labels.solution'),
                    textColorClass: ENVIRONMENT_TEXT_COLOR.problem,
                    badge: ENVIRONMENT_BADGE.problem,
                    badgeContent: '✓',
                    children: renderBlocks(contentBlock.solution, imagesById, imageMissingText),
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
                  {renderBlocks(contentBlock.body, imagesById, imageMissingText)}
                </CollapsibleCard>
              </div>
            )
          }

          return (
            <div key={`${metadata.label}-block-${contentBlockIndex}`}>
              {renderRawContentBlock(contentBlock as RawContentBlock, imagesById, imageMissingText)}
            </div>
          )
        })}
      </ArticleSection>
    )
  })

  return <div className="math-typography math-prose">{renderedSections}</div>
}

/**
 * Renders the detailed view of a handout — title header, author chips, action
 * menu, all environment-aware document sections (via {@link renderDocumentSections}),
 * and the inline {@link CommentSection}.
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

  // Warm the browser cache for every handout image. Many figures live inside
  // collapsed proofs / solutions / hints and would otherwise only start fetching
  // the moment the user expands a card. preload() hoists <link rel="preload">
  // tags into <head>; running it here in the Server Component ships the hints
  // in the initial HTML so the browser fetches in parallel with rendering.
  images.forEach((image) => {
    preload(getProblemImageUrl(image.contentId, 'handouts'), {
      as: 'image',
    })
  })

  return (
    <>
      {/* Header */}
      <header className="lg:mb-12">
        <div className="mb-6">
          <h1 className="text-5xl sm:text-6xl lg:text-5xl font-bold text-foreground tracking-tight leading-tight">
            <MathRendererClient content={document.subtitle || document.title || ''} />
          </h1>
        </div>

        {/* Title & subtitle */}
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

          {/* Share / download actions — pills on sm+, three-dot dropdown on smaller screens */}
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
