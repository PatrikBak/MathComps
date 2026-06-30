import { MDXRemote } from 'next-mdx-remote/rsc'
import React from 'react'

import { AppLink } from '@/components/shared/components/AppLink'
import { disallowedBlockComponents } from '@/lib/mdx-card-components'

import { NewsCardCover } from './NewsCardCover'
import { NewsCategoryBadge } from './NewsCategoryBadge'
import { NewsDateLabel } from './NewsDateLabel'
import type { NewsArticle } from './types'

/**
 * MDX component map for card content: styled paragraph and inline elements only; block-level tags throw.
 */
const cardMdxComponents = {
  // Body text
  p: (props: React.HTMLAttributes<HTMLParagraphElement>) => (
    <p className="text-foreground/70 text-sm leading-relaxed" {...props} />
  ),

  // Link
  a: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => {
    // Ensure href is provided
    if (!href) {
      throw new Error('Link in news card is missing required href attribute.')
    }

    // Render through AppLink
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

  // Bold
  strong: (props: React.HTMLAttributes<HTMLElement>) => (
    <strong className="text-foreground font-semibold" {...props} />
  ),
  // Italic
  em: (props: React.HTMLAttributes<HTMLElement>) => <em className="italic" {...props} />,
  // Inline code
  code: (props: React.HTMLAttributes<HTMLElement>) => (
    <code className="bg-surface-inset/70 px-1 py-0.5 rounded text-xs text-brand-light" {...props} />
  ),

  // Disallow headings and block elements
  ...disallowedBlockComponents('news card content'),
}

/**
 * Props for the {@link NewsCard} component.
 */
type NewsCardProps = {
  /** The news article to display. */
  article: NewsArticle
}

/**
 * A single news article card; renders the article's MDX body inline.
 */
export function NewsCard({ article }: NewsCardProps) {
  return (
    <article className="bg-surface/50 border border-foreground/10 rounded-xl flex flex-col md:flex-row overflow-hidden">
      {/* Cover: a banner on mobile, a left panel on desktop */}
      <div className="h-40 md:h-auto md:w-52 shrink-0">
        <NewsCardCover cover={article.cover} title={article.title} />
      </div>

      {/* Body */}
      <div className="flex flex-col flex-grow p-4 sm:p-5 min-w-0">
        {/* Eyebrow: category kicker, plus the date on mobile (timeline shows it on desktop) */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-1.5">
          <NewsCategoryBadge category={article.category} />
          <div className="md:hidden">
            <NewsDateLabel date={article.date} />
          </div>
        </div>

        {/* Title */}
        <h3 className="font-serif text-xl font-bold text-foreground leading-tight mb-2">
          {article.title}
        </h3>

        {/* MDX body */}
        <div className="flex-grow">
          <MDXRemote source={article.content} components={cardMdxComponents} />
        </div>
      </div>
    </article>
  )
}
