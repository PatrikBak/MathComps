'use client'

import { useTranslations } from 'next-intl'

import { SegmentedSwitch } from '@/components/shared/components/SegmentedSwitch'

import { COMMENTS_ORDERS, type CommentsOrder } from '../model/selection-routes'

/**
 * Props for the {@link CommentsOrderSwitch} component.
 */
type CommentsOrderSwitchProps = {
  /** The order the pool's comments run in. */
  order: CommentsOrder
  /** Runs the comments in another order. */
  onChange: (order: CommentsOrder) => void
}

/**
 * The switch between the comments orders. It sits on a line of text without making it taller, and is a size smaller
 * on phones.
 */
export function CommentsOrderSwitch({ order, onChange }: CommentsOrderSwitchProps) {
  // Comment-order copy
  const t = useTranslations('problemSelection.pool.commentsOrder')

  return (
    // A flex box, so the wrapper adds no text line height of its own
    <div className="flex">
      <SegmentedSwitch
        value={order}
        onChange={onChange}
        ariaLabel={t('label')}
        compactOnPhones
        fitsTextLine
        options={COMMENTS_ORDERS.map((candidate) => ({ value: candidate, label: t(candidate) }))}
      />
    </div>
  )
}
