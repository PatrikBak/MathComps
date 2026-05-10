import Image from 'next/image'
import { useTranslations } from 'next-intl'
import type { ReactNode } from 'react'
import Markdown, { type Components } from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/cjs/styles/prism'

import { resolveMediaUrl } from '@/components/shared/utils/media-utils'

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
 */
export function RichMathEditorRenderer({ content }: RichMathEditorRendererProps) {
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
            let normalizedHref = href ? resolveMediaUrl(href) : '#'

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
            // Resolve media: URLs to full R2 URLs (only for string sources)
            const resolvedSrc = typeof src === 'string' ? resolveMediaUrl(src) : src

            // Don't render image if src is empty or not a string
            if (!resolvedSrc || typeof resolvedSrc !== 'string') {
              return (
                <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-foreground/5 rounded text-xs text-muted italic">
                  🖼️ {alt || t('imageAlt')}
                </span>
              )
            }

            // Parse the recognised query parameters (width/height/inline/scale)
            const { params, cleanUrl } = parseImageUrl(resolvedSrc)

            // Concrete intrinsic dimensions reserve layout (no CLS); when missing,
            // fall back to the legacy width=0/height=0/unoptimized shape so untyped
            // comment images still render
            const hasIntrinsicSize = params.width !== undefined && params.height !== undefined
            const intrinsicWidth = hasIntrinsicSize ? params.width! : 0
            const intrinsicHeight = hasIntrinsicSize ? params.height! : 0

            // Inline images flow with the surrounding text inside a <span> wrapper;
            // block images keep the centred max-height wrapper for layout containment
            if (params.inline) {
              return (
                <span className="inline-block align-middle">
                  <Image
                    src={cleanUrl}
                    alt={alt ?? ''}
                    width={intrinsicWidth}
                    height={intrinsicHeight}
                    sizes={hasIntrinsicSize ? undefined : '100vw'}
                    unoptimized={!hasIntrinsicSize}
                    className="inline-block max-w-full h-auto object-contain"
                    style={{ width: 'auto', height: 'auto', zoom: params.scale }}
                  />
                </span>
              )
            }

            // Render block images wrapped in a container that enforces max-height
            // even when zoom is applied (zoom happens after max-height on the image)
            return (
              <div className="max-h-[400px] overflow-hidden rounded-md my-2 mx-auto w-fit">
                <Image
                  src={cleanUrl}
                  alt={alt ?? ''}
                  width={intrinsicWidth}
                  height={intrinsicHeight}
                  sizes={hasIntrinsicSize ? undefined : '100vw'}
                  unoptimized={!hasIntrinsicSize}
                  className="block max-w-full h-auto object-contain"
                  style={{ width: 'auto', height: 'auto', zoom: params.scale }}
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
}
