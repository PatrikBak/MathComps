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
 * Category label for a news article, styled as a small colored eyebrow.
 * Links to the category-filtered news list.
 */
export function NewsCategoryBadge({ category }: NewsCategoryBadgeProps) {
  // Translations for category labels
  const t = useTranslations('news.categories')

  // Get the href for the category which will filter the news list
  const href = `${ROUTES.NEWS}?category=${category}`

  // Fetch the color scheme mapping for the category
  const scheme = CATEGORY_COLORS[category]

  // Eyebrow styling: small uppercase letterspaced label in the category color
  const className = cn(
    'text-xs font-semibold uppercase tracking-wider',
    scheme.text,
    'hover:opacity-80 transition-opacity'
  )

  return (
    <AppLink href={href} className={className}>
      {t(category)}
    </AppLink>
  )
}
