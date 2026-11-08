'use client'

import { Camera, Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { Button } from '@/components/shared/components/Button'
import { assertNever } from '@/components/shared/utils/assert-never'
import { useFilePicker } from '@/hooks/use-file-picker'

/**
 * How the button stands: `compact` among the editor's footer controls, `page` as a tile after the pages so far.
 */
type DefensePhotoButtonVariant = 'compact' | 'page'

/**
 * Props for the {@link DefensePhotoButton}.
 */
type DefensePhotoButtonProps = {
  /** How the button stands. */
  variant: DefensePhotoButtonVariant
  /** Takes the photos the student picked. */
  onPick: (files: readonly File[]) => void
}

/**
 * The composer's way to photos of handwritten work: a phone offers its camera, its library and its files, a
 * computer its files. Several can be picked at once. The system's picker can take a moment to come up, so the
 * button spins until it does.
 */
export function DefensePhotoButton({ variant, onPick }: DefensePhotoButtonProps) {
  // Copy for the composer's photos
  const t = useTranslations('defense.photos')

  // The picker, taking any image, since the API decides which it can read
  const picker = useFilePicker({ accept: 'image/*', multiple: true, onPick })

  // The camera, or the wait for the picker
  const icon = picker.isOpening ? (
    <Loader2 size={16} className="animate-spin" aria-hidden="true" />
  ) : (
    <Camera size={16} aria-hidden="true" />
  )

  // The button as it stands
  switch (variant) {
    // Among the footer's controls, its word only where the footer has room for it
    case 'compact':
      return (
        <Button
          variant="ghost"
          size="sm"
          className="px-2.5"
          title={t('addTitle')}
          aria-busy={picker.isOpening || undefined}
          onClick={picker.open}
        >
          {icon}
          <span className="sr-only sm:not-sr-only">{t('add')}</span>
        </Button>
      )

    // A tile after the pages so far, as big as theirs
    case 'page':
      return (
        <Button
          variant="outline"
          className="size-20 shrink-0 flex-col gap-1 border-dashed px-1 text-center text-xs leading-tight"
          title={t('addTitle')}
          aria-busy={picker.isOpening || undefined}
          onClick={picker.open}
        >
          {icon}
          {t('addPage')}
        </Button>
      )

    // Every variant is handled above
    default:
      return assertNever(variant)
  }
}
