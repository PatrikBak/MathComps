import { MDXRemote } from 'next-mdx-remote/rsc'
import React from 'react'

import { AppLink } from '@/components/shared/components/AppLink'

import { NewsAuthorLabel } from './NewsAuthorLabel'
import { NewsCategoryBadge } from './NewsCategoryBadge'
import { NewsDateLabel } from './NewsDateLabel'
import type { NewsArticle } from './types'

/**
 * Helper to create an error for disallowed MDX elements in news cards.
 *
 * @param element - The name of the disallowed element.
 *
 * @returns Never, throws an error.
 */
function disallowedElement(element: string): never {
  throw new Error(
    `<${element}> is not allowed in news card content. ` +
      `News cards only support paragraphs and inline elements (links, bold, italic, code).`
  )
}

/**
 * Simplified MDX components for card content.
 * Only basic inline elements - no headings, lists, etc.
 * Throws errors for disallowed elements to catch issues at build time.
 */
const cardMdxComponents = {
  // Headings not allowed in card view
  h1: () => disallowedElement('h1'),
  h2: () => disallowedElement('h2'),
  h3: () => disallowedElement('h3'),

  // Paragraph
  p: (props: React.HTMLAttributes<HTMLParagraphElement>) => (
    <p className="text-foreground/70 text-sm leading-relaxed" {...props} />
  ),

  // Links - styled for cards
  a: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => {
    // Ensure href is provided
    if (!href) {
      throw new Error('Link in news card is missing required href attribute.')
    }

    // Let the AppLink handle navigation properly
    return (
      <AppLink
        href={href}
        className="text-link hover:text-link-hover transition-colors underline"
        {...props}
      >
        {children}
      </AppLink>
    )
  },

  // Inline formatting
  strong: (props: React.HTMLAttributes<HTMLElement>) => (
    <strong className="text-foreground font-semibold" {...props} />
  ),
  em: (props: React.HTMLAttributes<HTMLElement>) => <em className="italic" {...props} />,
  code: (props: React.HTMLAttributes<HTMLElement>) => (
    <code className="bg-surface-inset/70 px-1 py-0.5 rounded text-xs text-brand-light" {...props} />
  ),

  // Block elements not allowed in cards
  ul: () => disallowedElement('ul'),
  ol: () => disallowedElement('ol'),
  blockquote: () => disallowedElement('blockquote'),
  pre: () => disallowedElement('pre'),
  hr: () => disallowedElement('hr'),
  table: () => disallowedElement('table'),
  img: () => disallowedElement('img'),
}

/**
 * Props for the {@link NewsCard} component.
 */
type NewsCardProps = {
  /** The news article to display. */
  article: NewsArticle
}

/**
 * A single news article card.
 * Server-rendered with MDX content for SEO.
 */
export function NewsCard({ article }: NewsCardProps) {
  return (
    <article className="bg-surface/50 border border-foreground/10 rounded-xl p-4 sm:p-5 h-full flex flex-col overflow-hidden">
      {/* Metadata: Badge pinned top-right, Author in left column */}
      <div className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 mb-3 text-sm items-start">
        {/* Left column: Date + Author wrap naturally */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {/* Show date on mobile */}
          <div className="md:hidden">
            <NewsDateLabel date={article.date} />
          </div>
          <NewsAuthorLabel author={article.author} />
        </div>
        {/* Right column: Badge stays pinned */}
        <NewsCategoryBadge category={article.category} />
      </div>

      {/* Title */}
      <h3 className="text-xl font-bold text-foreground leading-tight mb-3">{article.title}</h3>

      {/* MDX Content - server-rendered for SEO */}
      <div className="flex-grow">
        <MDXRemote source={article.content} components={cardMdxComponents} />
      </div>
    </article>
  )
}
