import { Calendar } from 'lucide-react'
import { useFormatter } from 'next-intl'

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
  // Date formatter (uses current locale automatically)
  const format = useFormatter()

  // Format the date using current locale
  const formattedDate = format.dateTime(new Date(date), {
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
