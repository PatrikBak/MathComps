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

  // Format the date using current locale; the value is a calendar date, so format it in UTC
  // to avoid rolling back a day in western timezones
  const formattedDate = format.dateTime(new Date(date), {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })

  // Return the formatted date with calendar icon
  return (
    <div className={cn('inline-flex items-center gap-2 text-muted-foreground text-sm')}>
      <Calendar size={14} />
      <time dateTime={date}>{formattedDate}</time>
    </div>
  )
}
