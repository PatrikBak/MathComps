import { Calendar } from 'lucide-react'

import { cn } from '@/components/shared/utils/css-utils'

/**
 * Props for the {@link NewsDateLabel} component.
 */
type NewsDateLabelProps = {
  /** The date of the news article */
  date: string
}

/**
 * Formatted date label for news articles.
 */
export function NewsDateLabel({ date }: NewsDateLabelProps) {
  // Format the date, classic Slovak style 😇
  const formattedDate = new Date(date).toLocaleDateString('sk-SK', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })

  // Return the formatted date with calendar icon
  return (
    <div className={cn('inline-flex items-center gap-2 text-gray-400 text-sm')}>
      <Calendar size={14} />
      <time>{formattedDate}</time>
    </div>
  )
}
