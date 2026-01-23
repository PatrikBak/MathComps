import { Expand, Eye, Image, Paperclip, Send, Shrink, Type, X } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { LoadingSpinner } from '@/components/shared/components/LoadingSpinner'
import { cn } from '@/components/shared/utils/css-utils'
import { useDeviceCapabilities } from '@/hooks/use-device-capabilities'

import { MAX_ATTACHMENTS_PER_COMMENT, MAX_IMAGES_PER_COMMENT } from '../utils/attachment-utils'
import { MAX_CHARACTERS_PER_COMMENT } from '../utils/content-metrics'
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
        isOver ? 'text-red-400 font-medium' : isNear ? 'text-amber-400' : 'text-gray-500'
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
 * Shows a shrink button to return to inline view.
 */
type ExpandedModeConfig = {
  /** The discriminator */
  mode: 'expanded'
  /** Callback to shrink the editor from a modal */
  onShrink?: () => void
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
  /** Current number of uploaded images */
  imageCount: number
  /** Current number of uploaded file attachments */
  attachmentCount: number
  /** Callback triggered when the send button is clicked */
  onSend?: () => void
  /** Callback triggered when the cancel button is clicked */
  onCancel?: () => void
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
  imageCount,
  attachmentCount,
  onSend,
  onCancel,
  isValid,
  isLoading = false,
}: RichMathEditorFooterProps) {
  // Get translations
  const tEditor = useTranslations('ui.editor')

  // Use existing device capabilities hook for OS detection
  const { isMobileOS, isMac } = useDeviceCapabilities()

  // Compute whether we're over limits
  const isOverCharLimit = charCount > MAX_CHARACTERS_PER_COMMENT
  const isOverImageLimit = imageCount > MAX_IMAGES_PER_COMMENT
  const isOverAttachmentLimit = attachmentCount > MAX_ATTACHMENTS_PER_COMMENT

  // Compute whether we're close to limits
  const isNearCharLimit = charCount / MAX_CHARACTERS_PER_COMMENT >= 0.8 && !isOverCharLimit
  const isNearImageLimit = imageCount >= MAX_IMAGES_PER_COMMENT - 1 && !isOverImageLimit
  const isNearAttachmentLimit =
    attachmentCount >= MAX_ATTACHMENTS_PER_COMMENT - 1 && !isOverAttachmentLimit

  return (
    <div
      className={cn(
        'grid grid-cols-[1fr_auto] items-center gap-2 px-2 py-1.5',
        {
          card: cn(
            'bg-slate-800/50',
            !borderless && 'rounded-b-lg border border-t-0 border-slate-600/60'
          ),
          inline: 'bg-slate-800/10 border border-white/10 rounded-b-lg',
        }[variant]
      )}
    >
      {/* Column 1: Expand/Shrink + Metrics (can wrap) */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* Expand button */}
        {modeConfig.mode === 'inline' && modeConfig.onExpand && (
          <button
            type="button"
            onClick={modeConfig.onExpand}
            className="flex items-center gap-1.5 pl-0.5 pr-2 sm:px-2 py-1 rounded text-xs transition-colors text-gray-400 hover:text-gray-200 hover:bg-slate-600/50 whitespace-nowrap"
            title={tEditor('expandEditor')}
          >
            <Expand size={12} />
            <span>{tEditor('expandWithPreview')}</span>
            <Eye size={12} />
          </button>
        )}

        {/* Shrink button */}
        {modeConfig.mode === 'expanded' && modeConfig.onShrink && (
          <button
            type="button"
            onClick={modeConfig.onShrink}
            className="flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors text-gray-400 hover:text-gray-200 hover:bg-slate-600/50 whitespace-nowrap"
            title={tEditor('shrinkEditor')}
          >
            <Shrink size={12} />
            <span className="hidden md:inline">{tEditor('shrink')}</span>
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
                  max={MAX_CHARACTERS_PER_COMMENT}
                  isOver={isOverCharLimit}
                  isNear={isNearCharLimit}
                  title={tEditor('maxCharacters', { max: MAX_CHARACTERS_PER_COMMENT })}
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
                'flex items-center justify-center rounded-lg transition-colors duration-200',
                'w-8 h-8 sm:w-10 sm:h-10',
                'bg-slate-700/30 text-gray-400 hover:bg-slate-600/50 hover:text-gray-200'
              )}
              title={tEditor('cancelEsc')}
            >
              <X size={16} className="sm:hidden" />
              <X size={18} className="hidden sm:block" />
            </button>
          )}
          <button
            type="button"
            onClick={onSend}
            disabled={!isValid || isLoading}
            className={cn(
              'flex items-center justify-center rounded-lg transition-colors duration-200',
              'w-8 h-8 sm:w-10 sm:h-10',
              isValid
                ? 'bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30 hover:text-indigo-300'
                : 'bg-slate-700/20 text-gray-500 cursor-not-allowed',
              isLoading && 'cursor-wait opacity-90'
            )}
            title={
              isMobileOS
                ? tEditor('submit')
                : tEditor('submitShortcut', { modifier: isMac ? '⌘' : 'Ctrl' })
            }
          >
            {isLoading ? (
              <LoadingSpinner className="w-4 h-4 sm:w-5 sm:h-5 border-white/20 border-t-white" />
            ) : (
              <>
                <Send size={16} className="sm:hidden" />
                <Send size={18} className="hidden sm:block" />
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )
}
