import { useTranslations } from 'next-intl'
import { memo, type PropsWithChildren, type ReactNode, useMemo } from 'react'
import Markdown, { type Components, type ExtraProps, type UrlTransform } from 'react-markdown'
import type { PluggableList } from 'unified'

import { AppLink } from '@/components/shared/components/AppLink'
import { ImageWithLoader } from '@/components/shared/components/ImageWithLoader'
import { cn } from '@/components/shared/utils/css-utils'
import {
  type FileLinks,
  type ImageContext,
  resolveMarkdownImageUrl,
  resolveUserUploadMediaUrl,
} from '@/components/shared/utils/media-utils'

import { rehypeSourceRanges, sourceRangeOf } from '../plugins/rehype-source-ranges'
import {
  NUMBER_REFERENCE_NUMBER,
  NUMBER_REFERENCE_TAG,
  remarkNumberReferences,
} from '../plugins/remark-number-references'
import { parseImageUrl } from '../utils/image-url-params'
import {
  rehypePlugins as sharedRehypePlugins,
  remarkPlugins as sharedRemarkPlugins,
} from '../utils/markdown-pipeline'
import { preprocessDisplayMath } from '../utils/preprocessors'
import { RichMathEditorSpoiler } from './RichMathEditorSpoiler'

/**
 * What a `#N` in rendered content is drawn as, given N; null leaves the `#N` as text.
 */
export type NumberReferenceRenderer = (number: number) => ReactNode

/**
 * Props for the {@link RichMathEditorRenderer} component.
 */
type RichMathEditorRendererProps = {
  /** The markdown content to render */
  content: string
  /**
   * Which markdown surface owns this content — picks how bare `media:<id>` image keys resolve, and whether its images
   * sit on a white card. Omit only for content that carries no figures.
   */
  imageContext?: ImageContext
  /** Links to the uploaded files the content names; a file without one shows by its name alone. */
  fileLinks?: FileLinks
  /** What a `#N` in the content is drawn as, every `#N` staying text without it. */
  renderNumberReference?: NumberReferenceRenderer
  /** Whether the rendered elements are stamped with where they stand in the content. */
  marksSourceRanges?: boolean
}

/**
 * Whether images from each source sit on a white card. Problem and handout figures are black ink on a
 * transparent background, which the dark page would swallow; a user's upload is shown as it came.
 */
const LIGHT_IMAGE_BACKGROUND: Record<ImageContext, boolean> = {
  problems: true,
  handouts: true,
  userUploads: false,
}

/**
 * Props for the {@link AttachmentBadge} component.
 */
type AttachmentBadgeProps = {
  /** Where the attached file opens, or null for a file the content came with no link to. */
  href: string | null
  /** The attachment's name, as the content writes it. */
  children: ReactNode
}

/**
 * An attached file, drawn as a badge around its name: a link that opens the file, or muted text for a file with no
 * link.
 */
function AttachmentBadge({ href, children }: AttachmentBadgeProps) {
  // The badge's box, linked or not
  const box =
    'inline-flex items-center gap-1 px-2 py-0.5 bg-foreground/5 rounded text-xs border border-foreground/10'

  // A file with no link, as muted text
  if (href === null) {
    return <span className={cn(box, 'text-muted')}>{children}</span>
  }

  // The file, opening in a new tab
  return (
    <AppLink
      href={href}
      external
      newTab
      plain
      className={cn(
        box,
        'hover:bg-foreground/10 text-link hover:text-link-hover transition-colors'
      )}
    >
      {children}
    </AppLink>
  )
}

/**
 * The props react-markdown hands the component that draws a spoiler.
 */
type SpoilerTagProps = PropsWithChildren<ExtraProps> & {
  /** The spoiler's label, as the content writes it */
  label?: string
}

/**
 * The markdown components, plus the custom tags for spoilers and `#N` references.
 */
type CustomComponents = Components & {
  /** Custom component for spoilers */
  spoiler?: ({ children, label, node }: SpoilerTagProps) => ReactNode
  /** Custom component for a `#N` in the text */
  [NUMBER_REFERENCE_TAG]?: ({ children, node }: PropsWithChildren<ExtraProps>) => ReactNode
}

/** The shared remark plugins with each `#N` in the text turned into a reference. */
const remarkPluginsWithNumberReferences = [...sharedRemarkPlugins, remarkNumberReferences]

/**
 * Resolves the className for a list element, honoring custom marker styles passed via the `list-style-<style>`
 * className convention.
 *
 * @param className - Optional className forwarded from react-markdown
 * @param defaultMarker - Default Tailwind marker class applied when no custom style is set
 * @returns Resolved className string for the list element
 */
function resolveListClassName(className: string | undefined, defaultMarker: string): string {
  // Custom marker styles arrive as className="list-style-<style>"
  const isCustomStyle = typeof className === 'string' && className.startsWith('list-style-')

  // Use the custom marker class when present, otherwise fall back to the default
  const markerClass = isCustomStyle ? className : defaultMarker

  // Combine the marker class with the shared list layout classes. A list nested in an item gets its own indent and
  // the same gap as between items.
  return `${markerClass} list-inside my-2 space-y-1 [li>&]:my-1 [li>&]:pl-[1.25em]`
}

/**
 * A function which keeps a URL that is safe to link or load and drops any other.
 */
const urlTransform: UrlTransform = (url) => {
  // Normalize URL to lowercase for case-insensitive comparison
  const lowerUrl = url.toLowerCase()

  // Explicitly block dangerous schemes
  if (
    lowerUrl.startsWith('javascript:') ||
    lowerUrl.startsWith('data:') ||
    lowerUrl.startsWith('vbscript:')
  ) {
    return undefined
  }

  // Allow safe schemes and relative paths
  if (
    url.startsWith('media:') ||
    url.startsWith('http://') ||
    url.startsWith('https://') ||
    url.startsWith('/') ||
    url.startsWith('#') ||
    url.startsWith('mailto:')
  ) {
    return url
  }

  // Allow domain-like URLs without protocol (e.g., example.com)
  if (/^[a-zA-Z0-9]([a-zA-Z0-9-]*\.)+[a-zA-Z]{2,}/.test(url)) {
    return url
  }

  // Block everything else
  return undefined
}

/**
 * Renders markdown content with LaTeX math support and spoiler support, and where asked a `#N` as whatever the caller
 * draws for N.
 *
 * Wrapped in {@link memo} so a parent re-render with unchanged props skips parsing the markdown again. The components
 * each tag is drawn with stay the same functions while the content changes, since a new function is a new element
 * type to React, which remounts the whole output under it, images included.
 */
export const RichMathEditorRenderer = memo(function RichMathEditorRenderer({
  content,
  imageContext,
  fileLinks,
  renderNumberReference,
  marksSourceRanges,
}: RichMathEditorRendererProps) {
  // Editor translations
  const t = useTranslations('ui.editor')

  // Whether this content's images sit on a white card
  const lightImageBackground = imageContext !== undefined && LIGHT_IMAGE_BACKGROUND[imageContext]

  // How each tag is drawn
  const components = useMemo(
    () =>
      ({
        p: ({ children, node }) => {
          // Check if paragraph contains block-level elements (like spoiler) to avoid invalid HTML nesting (div
          // inside p)
          const hasBlockElement = node?.children?.some((child) => {
            // Non-element children never trigger a wrapper change
            if (child.type !== 'element') return false

            // Spoilers and explicit divs are always block-level
            if (child.tagName === 'spoiler' || child.tagName === 'div') return true

            // Images count as block-level UNLESS they carry ?inline=true
            if (child.tagName === 'img') {
              // The image's address, which carries the inline flag
              const src = child.properties?.src

              // One with no address stays block-level
              if (typeof src !== 'string') return true

              // Block-level unless it asks to sit inline
              return !parseImageUrl(src).params.inline
            }

            // Everything else stays inside <p>
            return false
          })

          // If paragraph contains block-level elements, wrap in div
          if (hasBlockElement) {
            return (
              <div {...sourceRangeOf(node)} className="mb-2 last:mb-0">
                {children}
              </div>
            )
          }

          // Otherwise, render as paragraph
          return (
            <p {...sourceRangeOf(node)} className="mb-2 last:mb-0">
              {children}
            </p>
          )
        },
        h2: ({ children, node }) => (
          <h2
            {...sourceRangeOf(node)}
            className="text-[1.25em] font-semibold text-foreground mt-5 mb-2 first:mt-0"
          >
            {children}
          </h2>
        ),
        h3: ({ children, node }) => (
          <h3
            {...sourceRangeOf(node)}
            className="text-[1.125em] font-semibold text-foreground mt-4 mb-2 first:mt-0"
          >
            {children}
          </h3>
        ),
        strong: ({ children }) => (
          <strong className="font-semibold text-foreground">{children}</strong>
        ),
        em: ({ children }) => <em className="italic">{children}</em>,
        // A fenced block arrives wrapped in its own `pre`, which carries the panel and resets the inline pill
        // styling its `code` child would otherwise wear.
        pre: ({ children, node }) => (
          <pre
            {...sourceRangeOf(node)}
            className="bg-foreground/5 my-2 overflow-x-auto rounded-md p-3 text-sm [&>code]:bg-transparent [&>code]:p-0 [&>code]:text-sm [&>code]:text-foreground"
          >
            {children}
          </pre>
        ),
        code: ({ children }) => (
          <code className="bg-foreground/5 px-1 py-0.5 rounded text-xs text-brand-light font-mono">
            {/* The newline that closed the fence would render as a blank last line; inline
                code has none to lose. */}
            {typeof children === 'string' ? children.replace(/\n$/, '') : children}
          </code>
        ),
        blockquote: ({ children, node }) => (
          <blockquote
            {...sourceRangeOf(node)}
            className="border-l-2 border-brand/50 pl-3 my-2 text-muted italic"
          >
            {children}
          </blockquote>
        ),
        ul: ({ children, className, node }) => (
          <ul {...sourceRangeOf(node)} className={resolveListClassName(className, 'list-disc')}>
            {children}
          </ul>
        ),
        ol: ({ children, className, node }) => (
          <ol {...sourceRangeOf(node)} className={resolveListClassName(className, 'list-decimal')}>
            {children}
          </ol>
        ),
        del: ({ children }) => <del className="line-through text-muted">{children}</del>,
        a: ({ href, children }) => {
          // Whether the link is to an attached file
          const isAttachment = String(children).startsWith('📎')

          // Resolve media: URLs to the files' links
          const resolvedHref = href ? resolveUserUploadMediaUrl(href, fileLinks) : '#'

          // An uploaded file the content came with no link to stays unlinked
          if (resolvedHref === undefined) {
            return isAttachment ? (
              <AttachmentBadge href={null}>{children}</AttachmentBadge>
            ) : (
              <span className="text-muted">{children}</span>
            )
          }

          // The address the link goes to
          let normalizedHref = resolvedHref

          // Normalize URLs: add protocol if missing
          // Matches: www.example.com, example.com, sub.example.co.uk, etc.
          // But not: /path, #anchor, javascript:, mailto:, media:, already has ://
          if (
            !normalizedHref.includes('://') &&
            !normalizedHref.startsWith('/') &&
            !normalizedHref.startsWith('#') &&
            !normalizedHref.startsWith('mailto:') &&
            !normalizedHref.startsWith('javascript:') &&
            /^[a-zA-Z0-9]([a-zA-Z0-9-]*\.)+[a-zA-Z]{2,}(\/|$|\?|#)/.test(normalizedHref)
          ) {
            normalizedHref = `https://${normalizedHref}`
          }

          // An attachment, drawn as its badge
          if (isAttachment) {
            return <AttachmentBadge href={normalizedHref}>{children}</AttachmentBadge>
          }

          // Any other link, in a new tab
          return (
            <AppLink
              href={normalizedHref}
              external
              newTab
              plain
              className="text-link hover:text-link-hover underline"
            >
              {children}
            </AppLink>
          )
        },
        img: ({ src, alt }) => {
          // The src split into its recognised query parameters (width/height/inline/scale) and the URL without
          // them, read before the src resolves, since an uploaded file's signed link carries none of ours
          const parsedSrc = typeof src === 'string' ? parseImageUrl(src) : null

          // The address the image loads from, resolved in this renderer's context
          const resolvedSrc =
            parsedSrc && resolveMarkdownImageUrl(parsedSrc.cleanUrl, imageContext, fileLinks)

          // Bail to a labelled error placeholder when there is no address to load
          if (!parsedSrc || !resolvedSrc) {
            return (
              <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-foreground/5 rounded text-xs text-muted italic">
                🖼️ {alt || t('imageAlt')}
              </span>
            )
          }

          // The parameters the image is drawn by
          const { params } = parsedSrc

          // Intrinsic dimensions when present; zero is ImageWithLoader's sentinel for fluid mode (runtime sizing,
          // no layout reservation)
          const intrinsicWidth = params.width ?? 0
          const intrinsicHeight = params.height ?? 0

          // Optional white wrap so diagrams with dark strokes stay readable; inline gets a tighter rounding, block
          // gets a card-style rounding
          const inlineLightWrap = lightImageBackground && 'bg-white rounded p-1'
          const blockLightWrap = lightImageBackground && 'bg-white rounded-lg p-1'

          // Inline images route through ImageWithLoader's native inline mode — handles vertical alignment, zero
          // leading and (when dimensioned) exact reserved dimensions on its own
          if (params.inline) {
            return (
              <ImageWithLoader
                inline
                src={resolvedSrc}
                alt={alt ?? ''}
                width={intrinsicWidth}
                height={intrinsicHeight}
                scale={params.scale}
                spinnerSize={16}
                className="inline-block align-middle"
                containerClassName={cn(inlineLightWrap)}
              />
            )
          }

          // Block images route through ImageWithLoader inside a centred wrapper — the container's explicit
          // dimensions make the optional white bg fill the whole card (and we get a free loading spinner) when
          // dimensions are present; fluid mode shrink-wraps the image
          return (
            <div className="my-2 flex justify-center">
              <ImageWithLoader
                src={resolvedSrc}
                alt={alt ?? ''}
                width={intrinsicWidth}
                height={intrinsicHeight}
                scale={params.scale}
                className="block"
                containerClassName={cn(blockLightWrap)}
              />
            </div>
          )
        },
        spoiler: ({ children, label, node }: SpoilerTagProps) => (
          <RichMathEditorSpoiler label={label ?? t('hiddenText')} sourceRange={sourceRangeOf(node)}>
            {children}
          </RichMathEditorSpoiler>
        ),
        [NUMBER_REFERENCE_TAG]: ({ children, node }) =>
          // What the caller draws for the number, or the `#N` as written where it draws nothing
          renderNumberReference?.(Number(node?.properties[NUMBER_REFERENCE_NUMBER])) ?? children,
      }) as CustomComponents,
    [fileLinks, imageContext, lightImageBackground, renderNumberReference, t]
  )

  // Preprocess display math before parsing, keeping the way back to the content as written
  const { text: processedContent, toSourceOffset } = preprocessDisplayMath(content)

  // The remark plugins, turning each `#N` into a reference where the caller draws one
  const remarkPlugins =
    renderNumberReference === undefined ? sharedRemarkPlugins : remarkPluginsWithNumberReferences

  // The rehype plugins, stamping the rendered elements with where they stand in the content when asked
  const rehypePlugins: PluggableList = marksSourceRanges
    ? [...sharedRehypePlugins, [rehypeSourceRanges, { toSourceOffset }]]
    : sharedRehypePlugins

  return (
    <Markdown
      // Pipeline: GFM -> directive (parses :::) -> spoiler (transforms directive) -> math -> breaks, then
      // where asked the `#N` references
      remarkPlugins={remarkPlugins}
      // Pipeline: rehype-raw parses HTML -> rehype-sanitize removes XSS -> rehype-katex renders math ->
      // rehype-math-nowrap keeps inline math with its punctuation, then where asked the source ranges
      rehypePlugins={rehypePlugins}
      // URL sanitization: allow-list safe schemes, explicitly block dangerous ones
      urlTransform={urlTransform}
      components={components}
    >
      {processedContent}
    </Markdown>
  )
})
