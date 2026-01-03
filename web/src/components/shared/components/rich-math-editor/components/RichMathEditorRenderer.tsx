import Image from 'next/image'
import type { ReactNode } from 'react'
import Markdown, { type Components } from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/cjs/styles/prism'
import rehypeKatex from 'rehype-katex'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import remarkBreaks from 'remark-breaks'
import remarkDirective from 'remark-directive'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'

import { resolveMediaUrl } from '@/components/shared/utils/media-utils'

import { remarkSpoiler } from '../plugins/remark-spoiler'
import { preprocessDisplayMath } from '../utils/preprocessors'
import { RichMathEditorSpoiler } from './RichMathEditorSpoiler'

/**
 * Custom sanitization schema that extends the default GitHub schema.
 *
 * This allows our custom `<spoiler>` element while blocking XSS vectors
 * like `<script>`, `<iframe>`, event handlers, and CSS defacement via `style`.
 *
 * The sanitizer runs BEFORE KaTeX, so KaTeX-generated styles are unaffected.
 * We only need to whitelist what users can type, not what plugins generate.
 */
const sanitizeSchema = {
  ...defaultSchema,
  tagNames: [
    ...(defaultSchema.tagNames ?? []),
    // Custom element for spoilers
    'spoiler',
    // MathML tags for accessibility (KaTeX can output these)
    'math',
    'mi',
    'mn',
    'mo',
    'ms',
    'mtext',
  ],
  attributes: {
    ...defaultSchema.attributes,
    spoiler: ['label'],
    // Only allow "language-*" classes (syntax highlighting)
    code: [['className', /^language-/]],
    // Only allow "math-*" classes (remark-math generates "math-inline" and "math-display")
    span: [['className', /^math-/]],
    // MathML attributes
    math: ['xmlns', 'display'],
    annotation: ['encoding'],
  },
  // Allow media: protocol for user's R2-hosted images
  protocols: {
    ...defaultSchema.protocols,
    src: [...(defaultSchema.protocols?.src ?? []), 'media'],
    href: [...(defaultSchema.protocols?.href ?? []), 'media'],
  },
}

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
 * Renders markdown content with LaTeX math support and spoiler support.
 *
 * Uses react-markdown with remark-math and rehype-katex plugins
 * to render full markdown (bold, italic, lists, quotes, code, etc.)
 * alongside inline ($...$) and display ($$...$$) math.
 */
export function RichMathEditorRenderer({ content }: RichMathEditorRendererProps) {
  // Preprocess display math before parsing
  const processedContent = preprocessDisplayMath(content)

  return (
    <Markdown
      // Pipeline: GFM -> directive (parses :::) -> spoiler (transforms directive) -> math -> breaks
      remarkPlugins={[remarkGfm, remarkDirective, remarkSpoiler, remarkMath, remarkBreaks]}
      // Pipeline: rehype-raw parses HTML -> rehype-sanitize removes XSS -> rehype-katex renders math
      rehypePlugins={[rehypeRaw, [rehypeSanitize, sanitizeSchema], rehypeKatex]}
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
            const hasBlockElement = node?.children?.some(
              (child) =>
                child.type === 'element' &&
                (child.tagName === 'spoiler' || child.tagName === 'div' || child.tagName === 'img')
            )

            // If paragraph contains block-level elements, wrap in div
            if (hasBlockElement) {
              return <div className="mb-2 last:mb-0">{children}</div>
            }

            // Otherwise, render as paragraph
            return <p className="mb-2 last:mb-0">{children}</p>
          },
          h3: ({ children }) => (
            <h3 className="text-lg font-semibold text-white mt-4 mb-2 first:mt-0">{children}</h3>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-white">{children}</strong>
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
              <code className="bg-slate-700/50 px-1 py-0.5 rounded text-xs text-indigo-300 font-mono">
                {children}
              </code>
            )
          },
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-indigo-500/50 pl-3 my-2 text-gray-400 italic">
              {children}
            </blockquote>
          ),
          ul: ({ children }) => (
            <ul className="list-disc list-inside my-2 space-y-1">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside my-2 space-y-1">{children}</ol>
          ),
          li: ({ children }) => <li className="text-gray-300">{children}</li>,
          del: ({ children }) => <del className="line-through text-gray-500">{children}</del>,
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
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-700/60 hover:bg-slate-600/60 rounded text-xs text-indigo-300 hover:text-indigo-200 transition-colors border border-slate-600/40"
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
                className="text-indigo-400 hover:text-indigo-300 underline"
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
                <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-slate-700/50 rounded text-xs text-gray-400 italic">
                  🖼️ {alt || 'Obrázok'}
                </span>
              )
            }

            // We'll parse scale parameter from URL (e.g., ?scale=50 for 50%)
            let scale: number | undefined

            // We'll store the URL with scale parameter removed here
            let finalUrl = resolvedSrc

            try {
              // Extract the scale parameter
              const url = new URL(resolvedSrc)
              const scaleParam = url.searchParams.get('scale')

              // If it's present
              if (scaleParam) {
                // Parse it as an integer
                const parsed = parseFloat(scaleParam)

                // If it's a valid percentage, retrieve it
                if (!isNaN(parsed) && parsed > 0) {
                  scale = parsed / 100
                }

                // Remove scale param from URL for clean image src
                url.searchParams.delete('scale')

                // Update final URL
                finalUrl = url.toString()
              }
            } catch {
              // URL parsing failed, use original src
            }

            // Render correct images wrapped in a container that enforces max-height
            // even when zoom is applied (zoom happens after max-height on the image)
            return (
              <div className="max-h-[400px] overflow-hidden rounded-md my-2 mx-auto w-fit">
                <Image
                  src={finalUrl}
                  alt={alt ?? ''}
                  width={0}
                  height={0}
                  sizes="100vw"
                  unoptimized
                  className="block max-w-full h-auto object-contain"
                  style={{ width: 'auto', height: 'auto', zoom: scale }}
                />
              </div>
            )
          },
          spoiler: ({ children, label }: { children: ReactNode; label?: string }) => (
            <RichMathEditorSpoiler label={label ?? 'Skrytý text'}>{children}</RichMathEditorSpoiler>
          ),
        } as CustomComponents
      }
    >
      {processedContent}
    </Markdown>
  )
}
