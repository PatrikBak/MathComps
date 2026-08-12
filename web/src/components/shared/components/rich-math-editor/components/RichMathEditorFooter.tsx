import { CornerDownLeft, Expand, Eye, Image, Paperclip, Square, Type, X } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { FOCUS_RING_CLASS } from '@/components/shared/components/Button'
import { LoadingSpinner } from '@/components/shared/components/LoadingSpinner'
import { cn } from '@/components/shared/utils/css-utils'
import { useDeviceCapabilities } from '@/hooks/use-device-capabilities'

import { MAX_ATTACHMENTS_PER_COMMENT, MAX_IMAGES_PER_COMMENT } from '../utils/attachment-utils'
import type { RichMathEditorVariant } from './RichMathEditor'

/**
 * Props for the {@link CounterBadge} component.
 */
type CounterBadgeProps = {
  /** Icon component to display */
  icon: React.ComponentType<{ size: number }>
  /** Current count value */
  count: number
  /** Maximum allowed value */
  max: number
  /** Whether the count exceeds the limit */
  isOver: boolean
  /** Whether the count is approaching the limit */
  isNear: boolean
  /** Tooltip text for the badge */
  title: string
  /** Whether to use tabular numbers for consistent width */
  tabular?: boolean
}

/**
 * Badge component displaying a count with an icon.
 * Automatically colors based on proximity to limit.
 */
function CounterBadge({
  icon: Icon,
  count,
  max,
  isOver,
  isNear,
  title,
  tabular = false,
}: CounterBadgeProps) {
  return (
    <span
      className={cn(
        'flex items-center gap-1 transition-colors',
        tabular && 'tabular-nums',
        isOver ? 'text-error font-medium' : isNear ? 'text-warning' : 'text-muted'
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
 * Mode configuration for the inline editor view.
 * Shows an expand button to open the modal view.
 */
type InlineModeConfig = {
  /** The discriminator */
  mode: 'inline'
  /** Callback to expand the editor to a modal */
  onExpand?: () => void
}

/**
 * Mode configuration for the expanded modal view.
 */
type ExpandedModeConfig = {
  /** The discriminator */
  mode: 'expanded'
}

/**
 * Discriminated union for mode-specific configuration.
 */
type ModeConfig = InlineModeConfig | ExpandedModeConfig

/**
 * Props for the {@link RichMathEditorFooter} component.
 */
type RichMathEditorFooterProps = {
  /** Visual variant of the editor */
  variant: RichMathEditorVariant
  /** When true, omits border styling (for use in containers that handle their own borders) */
  borderless?: boolean
  /** Mode-specific configuration (inline or expanded) */
  modeConfig: ModeConfig
  /** Current number of characters in the editor */
  charCount: number
  /** The most characters the content may hold */
  maxCharacters: number
  /** Current number of uploaded images */
  imageCount: number
  /** Current number of uploaded file attachments */
  attachmentCount: number
  /** Callback triggered when the send button is clicked */
  onSend?: () => void
  /** Callback triggered when the cancel button is clicked */
  onCancel?: () => void
  /** Callback that stops the in-flight submit. */
  onStop?: () => void
  /** Whether the content is valid and the send button should be enabled */
  isValid: boolean
  /** Whether the editor is in a loading state */
  isLoading?: boolean
}

/**
 * Footer component for the rich math editor.
 * Displays character and attachment counters, and action buttons.
 */
export function RichMathEditorFooter({
  variant,
  borderless = false,
  modeConfig,
  charCount,
  maxCharacters,
  imageCount,
  attachmentCount,
  onSend,
  onCancel,
  onStop,
  isValid,
  isLoading = false,
}: RichMathEditorFooterProps) {
  // Get translations
  const tEditor = useTranslations('ui.editor')

  // Whether the in-flight submit can be stopped
  const isStoppable = isLoading && Boolean(onStop)

  // OS detection
  const { isMobileOS, isMac } = useDeviceCapabilities()

  // Compute whether we're over limits
  const isOverCharLimit = charCount > maxCharacters
  const isOverImageLimit = imageCount > MAX_IMAGES_PER_COMMENT
  const isOverAttachmentLimit = attachmentCount > MAX_ATTACHMENTS_PER_COMMENT

  // Compute whether we're close to limits
  const isNearCharLimit = charCount / maxCharacters >= 0.8 && !isOverCharLimit
  const isNearImageLimit = imageCount >= MAX_IMAGES_PER_COMMENT - 1 && !isOverImageLimit
  const isNearAttachmentLimit =
    attachmentCount >= MAX_ATTACHMENTS_PER_COMMENT - 1 && !isOverAttachmentLimit

  return (
    <div
      className={cn(
        'grid grid-cols-[1fr_auto] items-center gap-2 px-2 py-1.5',
        {
          card: cn(
            'bg-surface/50',
            !borderless && 'rounded-b-lg border border-t-0 border-foreground/10'
          ),
          inline: 'bg-inset border border-foreground/10 rounded-b-lg',
        }[variant]
      )}
    >
      {/* Column 1: Expand + Metrics (can wrap) */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* Expand button */}
        {modeConfig.mode === 'inline' && modeConfig.onExpand && (
          <button
            type="button"
            onClick={modeConfig.onExpand}
            className="flex items-center gap-1.5 pl-0.5 pr-2 sm:px-2 py-1 rounded text-xs transition-colors text-muted hover:text-foreground hover:bg-foreground/10 whitespace-nowrap"
            title={tEditor('expandEditor')}
          >
            <Expand size={12} />
            <span>{tEditor('expandWithPreview')}</span>
            <Eye size={12} />
          </button>
        )}

        {/* Metrics */}
        {(() => {
          if (charCount === 0 && imageCount === 0 && attachmentCount === 0) return null

          return (
            <div className="flex items-center gap-3 text-xs">
              {imageCount > 0 && (
                <CounterBadge
                  icon={Image}
                  count={imageCount}
                  max={MAX_IMAGES_PER_COMMENT}
                  isOver={isOverImageLimit}
                  isNear={isNearImageLimit}
                  title={tEditor('maxImages', { max: MAX_IMAGES_PER_COMMENT })}
                />
              )}
              {attachmentCount > 0 && (
                <CounterBadge
                  icon={Paperclip}
                  count={attachmentCount}
                  max={MAX_ATTACHMENTS_PER_COMMENT}
                  isOver={isOverAttachmentLimit}
                  isNear={isNearAttachmentLimit}
                  title={tEditor('maxAttachments', { max: MAX_ATTACHMENTS_PER_COMMENT })}
                />
              )}
              {charCount > 0 && (
                <CounterBadge
                  icon={Type}
                  count={charCount}
                  max={maxCharacters}
                  isOver={isOverCharLimit}
                  isNear={isNearCharLimit}
                  title={tEditor('maxCharacters', { max: maxCharacters })}
                  tabular
                />
              )}
            </div>
          )
        })()}
      </div>

      {/* Column 2: Action buttons (fixed on right) */}
      {onSend && (
        <div className="flex items-center gap-1">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-lg transition-colors duration-200',
                'bg-foreground/5 text-muted hover:bg-foreground/10 hover:text-foreground',
                FOCUS_RING_CLASS
              )}
              title={tEditor('cancelEsc')}
            >
              <X size={18} />
            </button>
          )}
          <button
            type="button"
            onClick={isStoppable ? onStop : onSend}
            disabled={isStoppable ? false : !isValid || isLoading}
            aria-label={isStoppable ? tEditor('stop') : tEditor('submit')}
            className={cn(
              'flex h-9 min-w-9 items-center justify-center gap-1 rounded-md px-2.5',
              'text-xs font-semibold transition-all duration-200',
              'active:scale-95 motion-reduce:active:scale-100',
              isValid || isStoppable
                ? 'bg-brand/40 text-brand-foreground border border-brand-light/20 hover:bg-brand/60'
                : 'bg-foreground/5 text-muted border border-transparent cursor-not-allowed',
              isLoading && !isStoppable && 'cursor-wait opacity-90',
              FOCUS_RING_CLASS
            )}
            title={
              isStoppable
                ? tEditor('stop')
                : isMobileOS
                  ? tEditor('submit')
                  : tEditor('submitShortcut', { modifier: isMac ? '⌘' : 'Ctrl' })
            }
          >
            {isStoppable ? (
              // In-flight: stop button
              <Square size={13} className="fill-current" />
            ) : isLoading ? (
              <LoadingSpinner className="w-5 h-5 border-foreground/20 border-t-foreground" />
            ) : isMobileOS ? (
              // Touch: action label
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
