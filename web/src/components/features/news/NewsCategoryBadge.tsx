import { useTranslations } from 'next-intl'

import { AppLink } from '@/components/shared/components/AppLink'
import { cn } from '@/components/shared/utils/css-utils'
import { ROUTES } from '@/i18n/i18n'

import { CATEGORY_CONFIG, type NewsCategory } from './types'

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

  // Get the config of the pre-defined category
  const config = CATEGORY_CONFIG[category]

  // Get the href for the category which will filter the news list
  const href = `${ROUTES.NEWS}?category=${category}`

  // Classes for the badge combining the defaults and category-specific classes
  const className = cn(
    'px-2.5 py-1 text-xs font-medium rounded-md text-white',
    config.bgColor,
    'hover:opacity-80 transition-opacity'
  )

  return (
    <AppLink href={href} className={className}>
      {t(category)}
    </AppLink>
  )
}
