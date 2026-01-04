import React from 'react'

import { cn } from '@/components/shared/utils/css-utils'
import { slugify } from '@/components/shared/utils/string-utils'

import AnimatedSection from './AnimatedSection'
import { CopyLinkButton } from './CopyLinkButton'

/**
 * Props for the {@link ArticleSection} component.
 */
type ArticleSectionProps = {
  /** Section number (e.g., "1", "1.2", "2.3.1") - omit if using icon */
  number?: string
  /** Optional icon to display instead of the section number */
  icon?: React.ReactNode
  /** Section title - used to generate the slug/ID automatically */
  title: string
  /** Optional pre-computed ID for the section. If not provided, will be generated from title */
  id?: string
  /** Rendered title content - can be a React node for complex titles (e.g., with math) */
  titleContent?: React.ReactNode
  /** Content to render inside the section */
  children: React.ReactNode
  /** Optional CSS class for the section container */
  className?: string
}

/**
 * Shared article section component that provides consistent structure and styling
 * for content sections across different pages (guides, handouts, etc.).
 */
export function ArticleSection({
  number,
  icon,
  title,
  id,
  titleContent,
  children,
  className,
}: ArticleSectionProps) {
  // Use provided ID or generate slug from title
  const slug = id || slugify(title)

  return (
    <AnimatedSection>
      <section className={cn('max-w-none', className)}>
        <h2
          id={slug}
          className="group text-3xl font-bold text-white mt-16 mb-6 border-b border-gray-700 pb-3 flex items-center gap-2"
        >
          {icon ? (
            <span className="text-gray-400">{icon}</span>
          ) : number ? (
            <span className="mr-1 text-gray-300">{number}</span>
          ) : null}
          <span>{titleContent || title}</span>
          <CopyLinkButton sectionSlug={slug} iconSize={20} />
        </h2>
        {children}
      </section>
    </AnimatedSection>
  )
}
