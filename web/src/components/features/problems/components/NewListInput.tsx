'use client'

import { Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { FOCUS_RING_ROW_CLASS } from '@/components/shared/components/Button'
import { LoadingSpinner } from '@/components/shared/components/LoadingSpinner'
import { cn } from '@/components/shared/utils/css-utils'

import type { UseNewListFormResult } from '../hooks/use-new-list-form'

/**
 * The props of {@link NewListInput}.
 */
type NewListInputProps = {
  /** The form the field reads and writes. */
  form: UseNewListFormResult
  /** Extra classes for the row. */
  className?: string
}

/**
 * The field a new list is named in, submitted with Enter and abandoned with Escape.
 *
 * The row is the field, since the input inside it carries no edge of its own.
 */
export const NewListInput = ({ form, className }: NewListInputProps) => {
  // Translations for the filter sidebar
  const t = useTranslations('problems.filters')

  return (
    <div
      className={cn(
        'flex select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm',
        FOCUS_RING_ROW_CLASS,
        className
      )}
    >
      {/* Row icon */}
      <Plus className="h-4 w-4 shrink-0 text-muted" />

      {/* The name field */}
      <input
        ref={form.inputRef}
        type="text"
        value={form.name}
        onChange={(event) => form.setName(event.target.value)}
        onKeyDown={(event) => {
          // Keystrokes belong to the field, so the surface holding it doesn't act on them
          event.stopPropagation()

          // Enter names the list
          if (event.key === 'Enter') {
            event.preventDefault()
            form.submit()
          }

          // Escape gives up on it
          if (event.key === 'Escape') {
            event.preventDefault()
            form.cancel()
          }
        }}
        placeholder={t('newListPlaceholder')}
        disabled={form.isPending}
        className="flex-1 min-w-0 bg-transparent text-sm text-foreground placeholder-muted border-none outline-none focus:ring-0"
      />

      {/* Spinner, holding its width so the row doesn't shift once it shows */}
      <LoadingSpinner className={cn('h-4 w-4 shrink-0', !form.isPending && 'invisible')} />
    </div>
  )
}
