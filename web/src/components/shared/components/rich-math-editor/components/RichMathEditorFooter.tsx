import { CornerDownLeft, Image, type LucideIcon, Paperclip, Square, Type, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { ReactNode } from 'react'

import { FOCUS_RING_CLASS } from '@/components/shared/components/Button'
import { LoadingSpinner } from '@/components/shared/components/LoadingSpinner'
import { cn } from '@/components/shared/utils/css-utils'
import { useDeviceCapabilities } from '@/hooks/use-device-capabilities'

import { type EditorState } from '../model/EditorState'

/**
 * Props for the {@link CounterBadge} component.
 */
type CounterBadgeProps = {
  /** The icon of what the badge counts */
  icon: LucideIcon
  /** Current count value */
  count: number
  /** Maximum allowed value */
  max: number
  /** Whether the count reads as spent */
  isSpent: boolean
  /** Whether the count is approaching the limit */
  isNear: boolean
  /** Tooltip text for the badge */
  title: string
  /** Whether to use tabular numbers for consistent width */
  tabular?: boolean
}

/**
 * A count against its limit beside the icon of what it counts, coloured by how close to the limit it
 * stands.
 */
export function CounterBadge({
  icon: Icon,
  count,
  max,
  isSpent,
  isNear,
  title,
  tabular = false,
}: CounterBadgeProps) {
  // The count against its limit, coloured as it closes in
  return (
    <span
      className={cn(
        'flex items-center gap-1 transition-colors',
        tabular && 'tabular-nums',
        isSpent ? 'text-error font-medium' : isNear ? 'text-warning' : 'text-muted'
      )}
      title={title}
    >
      <Icon size={12} />
      <span>
        {count}/{max}
      </span>
    </span>
  )
}

/**
 * Props for the {@link RichMathEditorFooter} component.
 */
type RichMathEditorFooterProps = {
  /** The draft's state */
  state: EditorState
  /** Whether Escape runs the cancel, which the cancel's tooltip then names */
  escapeCancels: boolean
  /** What the surface counts of its own, shown beside the draft's counters */
  meta: ReactNode
  /**
   * Callback triggered when the send button is clicked. The action buttons, cancel included, show only
   * where it is given
   */
  onSend: (() => void) | undefined
  /** Callback triggered when the cancel button is clicked */
  onCancel: (() => void) | undefined
  /** Callback that stops the in-flight submit */
  onStop: (() => void) | undefined
  /** Whether the draft can be sent now */
  isSendable: boolean
  /** Whether a submit is in flight */
  isLoading: boolean
  /** Classes for where the footer stands */
  className?: string
}

/**
 * The editor's footer: its counters beside its cancel and send controls, and nothing at all where it has
 * neither to show.
 */
export function RichMathEditorFooter({
  state,
  escapeCancels,
  meta,
  onSend,
  onCancel,
  onStop,
  isSendable,
  isLoading,
  className,
}: RichMathEditorFooterProps) {
  // Editor translations
  const tEditor = useTranslations('ui.editor')

  // Shared action labels
  const tActions = useTranslations('ui.actions')

  // Whether the in-flight submit can be stopped
  const isStoppable = isLoading && Boolean(onStop)

  // Which platform the reader is on
  const { isMobileOS, isMac } = useDeviceCapabilities()

  // The draft's character, image and attachment counts
  const { charCount, imageCount, attachmentCount } = state.metrics

  // Whether any counter shows. The image and attachment ones show once the draft holds one; the
  // surface's own, and the characters where there is a limit, show from the empty editor on
  const hasMetrics =
    meta !== undefined || state.maxCharacters !== null || imageCount > 0 || attachmentCount > 0

  // Nothing to count and nothing to send, so no row to give it
  if (!hasMetrics && !onSend) return null

  // The counters, then the actions
  return (
    <div className={cn('flex items-center justify-end gap-3 pb-1.5 pl-3 pr-1.5 pt-1', className)}>
      {/* Metrics */}
      {hasMetrics && (
        <div className="flex min-w-0 items-center gap-3 text-xs">
          {meta}
          {imageCount > 0 && (
            <CounterBadge
              icon={Image}
              count={imageCount}
              max={state.maxImages}
              isSpent={state.isOverImageLimit}
              isNear={state.isNearImageLimit}
              title={tEditor('maxImages', { max: state.maxImages })}
            />
          )}
          {attachmentCount > 0 && (
            <CounterBadge
              icon={Paperclip}
              count={attachmentCount}
              max={state.maxAttachments}
              isSpent={state.isOverAttachmentLimit}
              isNear={state.isNearAttachmentLimit}
              title={tEditor('maxAttachments', { max: state.maxAttachments })}
            />
          )}
          {state.maxCharacters !== null && (
            <CounterBadge
              icon={Type}
              count={charCount}
              max={state.maxCharacters}
              isSpent={state.isOverCharacterLimit}
              isNear={state.isNearCharacterLimit}
              title={tEditor('maxCharacters', { max: state.maxCharacters })}
              tabular
            />
          )}
        </div>
      )}

      {/* Action buttons */}
      {onSend && (
        <div className="flex shrink-0 items-center gap-1">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-lg transition-colors duration-200',
                'text-muted hover:bg-foreground/10 hover:text-foreground',
                FOCUS_RING_CLASS
              )}
              title={escapeCancels ? tEditor('cancelEsc') : tActions('cancel')}
            >
              <X size={18} />
            </button>
          )}
          <button
            type="button"
            onClick={isStoppable ? onStop : onSend}
            disabled={!isStoppable && !isSendable}
            aria-label={isStoppable ? tEditor('stop') : tEditor('submit')}
            className={cn(
              'flex h-9 min-w-9 items-center justify-center gap-1 rounded-md px-2.5',
              'text-xs font-semibold transition-all duration-200',
              'active:scale-95 motion-reduce:active:scale-100',
              // Lit while a send can go, and while one is on its way
              isSendable || isLoading
                ? 'bg-brand/40 text-brand-foreground border border-brand-light/20 hover:bg-brand/60'
                : 'text-muted border border-transparent cursor-not-allowed',
              isLoading && !isStoppable && 'cursor-wait opacity-90',
              FOCUS_RING_CLASS
            )}
            // The stop while there is one, else the send, naming its shortcut off a mobile OS
            title={
              isStoppable
                ? tEditor('stop')
                : isMobileOS
                  ? tEditor('submit')
                  : tEditor('submitShortcut', { modifier: isMac ? '⌘' : 'Ctrl' })
            }
          >
            {/* The button's face, by where the send stands */}
            {isStoppable ? (
              // In-flight: stop button
              <Square size={13} className="fill-current" />
            ) : isLoading ? (
              // In flight with no way to stop it: a spinner
              <LoadingSpinner className="w-5 h-5 border-foreground/20 border-t-foreground" />
            ) : isMobileOS ? (
              // Mobile OS: action label
              tEditor('submit')
            ) : (
              // Desktop: ⌘/Ctrl + Enter keycap
              <>
                <span>{isMac ? '⌘' : 'Ctrl'}</span>
                <CornerDownLeft size={14} aria-hidden="true" />
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )
}
