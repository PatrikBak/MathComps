import { useTranslations } from 'next-intl'
import { memo, type ReactNode } from 'react'
import Markdown, { type Components } from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/cjs/styles/prism'

import { ImageWithLoader } from '@/components/shared/components/ImageWithLoader'
import { cn } from '@/components/shared/utils/css-utils'
import {
  type ImageContext,
  resolveMarkdownImageUrl,
  resolveUserUploadMediaUrl,
} from '@/components/shared/utils/media-utils'

import { parseImageUrl } from '../utils/image-url-params'
import {
  rehypePlugins as sharedRehypePlugins,
  remarkPlugins as sharedRemarkPlugins,
} from '../utils/markdown-pipeline'
import { preprocessDisplayMath } from '../utils/preprocessors'
import { RichMathEditorSpoiler } from './RichMathEditorSpoiler'

/**
 * Props for the {@link RichMathEditorRenderer} component.
 */
type RichMathEditorRendererProps = {
  /** The markdown content to render */
  content: string
  /**
   * Whether rendered images are wrapped in a white-background container.
   * Suited to diagrams whose strokes assume a light backdrop.
   */
  lightImageBackground: boolean
  /**
   * Which markdown surface owns this content — picks the host that bare
   * `media:<id>` image keys resolve against. Omit when the content has no
   * `media:` URLs to dispatch (e.g. a dev catalog).
   */
  imageContext?: ImageContext
}

/**
 * Custom components with spoiler support.
 */
type CustomComponents = Components & {
  /** Custom component for spoilers */
  spoiler?: ({ children }: { children: ReactNode }) => ReactNode
}

/**
 * Resolves the className for a list element, honoring custom marker styles
 * passed via the `list-style-<style>` className convention.
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

  // Combine the marker class with the shared list layout classes
  return `${markerClass} list-inside my-2 space-y-1`
}

/**
 * Renders markdown content with LaTeX math support and spoiler support.
 *
 * Wrapped in {@link memo} so a parent re-render with unchanged props is a no-op.
 * Without this guard, every parent re-render rebuilds the inline `components` /
 * `urlTransform` props, which gives `react-markdown`'s element types fresh
 * referential identity and causes React to unmount the entire output subtree —
 * including the `<img>` elements, which then trigger a fresh network request.
 */
export const RichMathEditorRenderer = memo(function RichMathEditorRenderer({
  content,
  lightImageBackground,
  imageContext,
}: RichMathEditorRendererProps) {
  // Get translations
  const t = useTranslations('ui.editor')

  // Preprocess display math before parsing
  const processedContent = preprocessDisplayMath(content)

  return (
    <Markdown
      // Pipeline: GFM -> directive (parses :::) -> spoiler (transforms directive) -> math -> breaks
      remarkPlugins={[...sharedRemarkPlugins]}
      // Pipeline: rehype-raw parses HTML -> rehype-sanitize removes XSS -> rehype-katex renders math
      rehypePlugins={[...sharedRehypePlugins]}
      // URL sanitization: allow-list safe schemes, explicitly block dangerous ones
      urlTransform={(url) => {
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
      }}
      components={
        {
          p: ({ children, node }) => {
            // Check if paragraph contains block-level elements (like spoiler)
            // to avoid invalid HTML nesting (div inside p)
            const hasBlockElement = node?.children?.some((child) => {
              // Non-element children never trigger a wrapper change
              if (child.type !== 'element') return false

              // Spoilers and explicit divs are always block-level
              if (child.tagName === 'spoiler' || child.tagName === 'div') return true

              // Images count as block-level UNLESS they carry ?inline=true
              if (child.tagName === 'img') {
                const src = child.properties?.src
                if (typeof src !== 'string') return true
                return !parseImageUrl(src).params.inline
              }

              // Everything else stays inside <p>
              return false
            })

            // If paragraph contains block-level elements, wrap in div
            if (hasBlockElement) {
              return <div className="mb-2 last:mb-0">{children}</div>
            }

            // Otherwise, render as paragraph
            return <p className="mb-2 last:mb-0">{children}</p>
          },
          h3: ({ children }) => (
            <h3 className="text-lg font-semibold text-foreground mt-4 mb-2 first:mt-0">
              {children}
            </h3>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-foreground">{children}</strong>
          ),
          em: ({ children }) => <em className="italic">{children}</em>,
          code: ({ children, className }) => {
            // Check if this is a code block (has language class)
            const match = /language-(\w+)/.exec(className || '')
            const language = match?.[1]

            // Code block with syntax highlighting
            if (language) {
              return (
                <SyntaxHighlighter
                  style={oneDark}
                  language={language}
                  PreTag="div"
                  className="!my-2 !rounded-md !text-sm"
                >
                  {String(children).replace(/\n$/, '')}
                </SyntaxHighlighter>
              )
            }

            // Inline code
            return (
              <code className="bg-foreground/5 px-1 py-0.5 rounded text-xs text-brand-light font-mono">
                {children}
              </code>
            )
          },
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-focus/50 pl-3 my-2 text-muted italic">
              {children}
            </blockquote>
          ),
          ul: ({ children, className }) => (
            <ul className={resolveListClassName(className, 'list-disc')}>{children}</ul>
          ),
          ol: ({ children, className }) => (
            <ol className={resolveListClassName(className, 'list-decimal')}>{children}</ol>
          ),
          li: ({ children }) => <li className="text-muted-foreground">{children}</li>,
          del: ({ children }) => <del className="line-through text-muted">{children}</del>,
          a: ({ href, children }) => {
            // Resolve media: URLs to full R2 URLs
            let normalizedHref = href ? resolveUserUploadMediaUrl(href) : '#'

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

            // Style attachment links with a file icon and badge
            if (String(children).startsWith('📎')) {
              return (
                <a
                  href={normalizedHref}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-foreground/5 hover:bg-foreground/10 rounded text-xs text-link hover:text-link-hover transition-colors border border-foreground/10"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {children}
                </a>
              )
            }

            // Non-attachment links
            return (
              <a
                href={normalizedHref}
                className="text-link hover:text-link-hover underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                {children}
              </a>
            )
          },
          img: ({ src, alt }) => {
            // Resolve the image src in this renderer's context
            const resolvedSrc =
              typeof src === 'string' ? resolveMarkdownImageUrl(src, imageContext) : src

            // Bail to a labelled error placeholder when the src is missing
            if (!resolvedSrc || typeof resolvedSrc !== 'string') {
              return (
                <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-foreground/5 rounded text-xs text-muted italic">
                  🖼️ {alt || t('imageAlt')}
                </span>
              )
            }

            // Parse the recognised query parameters (width/height/inline/scale)
            const { params, cleanUrl } = parseImageUrl(resolvedSrc)

            // Intrinsic dimensions when present; zero is ImageWithLoader's
            // sentinel for fluid mode (runtime sizing, no layout reservation)
            const intrinsicWidth = params.width ?? 0
            const intrinsicHeight = params.height ?? 0

            // Optional white wrap so diagrams with dark strokes stay readable;
            // inline gets a tighter rounding, block gets a card-style rounding
            const inlineLightWrap = lightImageBackground && 'bg-white rounded p-1'
            const blockLightWrap = lightImageBackground && 'bg-white rounded-lg p-1'

            // Inline images route through ImageWithLoader's native inline mode
            // — handles vertical alignment, zero leading and (when dimensioned)
            // exact reserved dimensions on its own, no wrapping span needed
            if (params.inline) {
              return (
                <ImageWithLoader
                  inline
                  src={cleanUrl}
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

            // Block images route through ImageWithLoader inside a centred wrapper
            // — the container's explicit dimensions make the optional white bg
            // fill the whole card (and we get a free loading spinner) when
            // dimensions are present; fluid mode shrink-wraps the image
            return (
              <div className="my-2 flex justify-center">
                <ImageWithLoader
                  src={cleanUrl}
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
          spoiler: ({ children, label }: { children: ReactNode; label?: string }) => (
            <RichMathEditorSpoiler label={label ?? t('hiddenText')}>
              {children}
            </RichMathEditorSpoiler>
          ),
        } as CustomComponents
      }
    >
      {processedContent}
    </Markdown>
  )
})
