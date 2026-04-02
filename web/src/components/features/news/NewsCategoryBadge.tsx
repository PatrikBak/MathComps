import { useTranslations } from 'next-intl'

import { AppLink } from '@/components/shared/components/AppLink'
import { cn } from '@/components/shared/utils/css-utils'
import { ROUTES } from '@/i18n/i18n'

import { CATEGORY_COLORS } from './news-colors'
import { type NewsCategory } from './types'

/**
 * Props for the {@link NewsCategoryBadge} component.
 */
type NewsCategoryBadgeProps = {
  /** The category of the news article */
  category: NewsCategory
}

/**
 * Colored badge for news article category.
 */
export function NewsCategoryBadge({ category }: NewsCategoryBadgeProps) {
  // Translations for category labels
  const t = useTranslations('news.categories')

  // Get the href for the category which will filter the news list
  const href = `${ROUTES.NEWS}?category=${category}`

  // Fetch the color scheme mapping for the category
  const scheme = CATEGORY_COLORS[category]

  // Classes for the badge combining the defaults and category-specific classes
  const className = cn(
    'px-2.5 py-1 text-xs font-medium rounded-md',
    scheme.bg,
    scheme.text,
    'hover:opacity-80 transition-opacity'
  )

  return (
    <AppLink href={href} className={className}>
      {t(category)}
    </AppLink>
  )
}
