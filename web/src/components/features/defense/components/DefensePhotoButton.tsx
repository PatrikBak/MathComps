'use client'

import { Camera, Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { Button } from '@/components/shared/components/Button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/shared/components/DropdownMenu'
import { assertNever } from '@/components/shared/utils/assert-never'
import { useDeviceCapabilities } from '@/hooks/use-device-capabilities'
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
  /** Opens the QR code for sending photos from the student's phone, or none where no phone is offered. */
  onPhone?: () => void
  /** Whether no more photos fit, which turns the button off. */
  isFull: boolean
}

/**
 * The composer's way to photos of handwritten work: a phone offers its camera, its library and its files, a
 * computer its files. Several can be picked at once. The system's picker can take a moment to come up, so the
 * button spins until it does. Where the main pointer is a mouse or a trackpad and the phone is offered, the button
 * opens a menu with both. Once no more photos fit, it opens nothing.
 */
export function DefensePhotoButton({ variant, onPick, onPhone, isFull }: DefensePhotoButtonProps) {
  // Copy for the photos of handwritten work
  const t = useTranslations('defense.photos')

  // The picker, taking any image, since the API decides which it can read
  const picker = useFilePicker({ accept: 'image/*', multiple: true, onPick })

  // Whether the main pointer is a mouse or a trackpad, which marks a computer
  const { hasFinePointer } = useDeviceCapabilities()

  // Whether the button offers the phone too: on a computer, the phone beside it being the better camera, and only
  // given a way to it. A phone or a tablet takes its photos itself
  const offersPhone = hasFinePointer && onPhone !== undefined

  // What a press on the button does: the picker straight away, unless the menu opens instead
  const onClick = offersPhone ? undefined : picker.open

  // The camera, or the wait for the picker
  const icon = picker.isOpening ? (
    <Loader2 size={16} className="animate-spin" aria-hidden="true" />
  ) : (
    <Camera size={16} aria-hidden="true" />
  )

  // The button as it stands
  const button = (() => {
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
            // Unavailable by its ARIA state alone once no more photos fit, which keeps the focus on it through the
            // pick that fills the composer
            aria-disabled={isFull || undefined}
            // Never disabled outright, which the menu's trigger would otherwise pass on to it once no more fit
            disabled={false}
            onClick={onClick}
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
            // Unavailable by its ARIA state alone once no more photos fit, which keeps the focus on it through the
            // pick that fills the composer
            aria-disabled={isFull || undefined}
            // Never disabled outright, which the menu's trigger would otherwise pass on to it once no more fit
            disabled={false}
            onClick={onClick}
          >
            {icon}
            {t('addPage')}
          </Button>
        )

      // Every variant is handled above
      default:
        return assertNever(variant)
    }
  })()

  // A phone or a tablet, or no phone offered, where the button is the picker itself
  if (!offersPhone) return button

  // A computer, where the button asks which device the photos come from. Not modal, since a row opens a dialog.
  // The menu opens over a card, the editor's or the dialog's, whichever button it comes from
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild disabled={isFull}>
        {button}
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" opensOver="card">
        {/* The computer's own files */}
        <DropdownMenuItem onSelect={picker.open}>{t('fromComputer')}</DropdownMenuItem>

        {/* A scan on the phone, which sends its photos here */}
        <DropdownMenuItem onSelect={onPhone}>{t('fromPhone')}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
