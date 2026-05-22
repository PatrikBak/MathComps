'use client'

import { useClipboard } from '@mantine/hooks'
import { Download, MoreVertical, Share2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'

import { getHandoutPdfUrl } from '@/components/features/problems/services/problem-api-urls'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/shared/components/DropdownMenu'

import { ActionPill } from './ActionPill'
import { useWakeLockContext } from './WakeLockProvider'

/**
 * Props for the {@link HandoutActions} component.
 */
type HandoutActionsProps = {
  /** PDF filename stem, e.g. "fun-algebra.sk" (without extension). */
  pdfFilenameStem: string
}

/**
 * Fields shared by every handout action.
 */
type HandoutActionBase = {
  /** React key. */
  key: string
  /** Leading icon node. */
  icon: React.ReactNode
  /** Action label. */
  label: string
}

/**
 * Link variant of the {@link HandoutAction} discriminated union.
 */
type HandoutLinkAction = HandoutActionBase & {
  /** Discriminator */
  kind: 'link'
  /** External target URL. */
  href: string
}

/**
 * Button variant of the {@link HandoutAction} discriminated union.
 */
type HandoutButtonAction = HandoutActionBase & {
  /** Discriminator */
  kind: 'button'
  /** Click handler. */
  onClick: () => void
}

/**
 * Single source of truth for one handout action — either a link or a button.
 */
type HandoutAction = HandoutLinkAction | HandoutButtonAction

/**
 * Props for the {@link ActionDropdownItem} component.
 */
type ActionDropdownItemProps = {
  /** Action descriptor. */
  action: HandoutAction
}

/**
 * Renders a single {@link HandoutAction} as a {@link DropdownMenuItem},
 * dispatching on the discriminated-union variant.
 */
function ActionDropdownItem({ action }: ActionDropdownItemProps) {
  // Visual contents — same for both variants
  const inner = (
    <div className="flex items-center">
      <span className="mr-2 flex w-5 items-center justify-center">{action.icon}</span>
      <span>{action.label}</span>
    </div>
  )

  // Dispatch on the variant
  switch (action.kind) {
    case 'link':
      return (
        <DropdownMenuItem asChild>
          <a href={action.href} target="_blank" rel="noopener noreferrer">
            {inner}
          </a>
        </DropdownMenuItem>
      )
    case 'button':
      return <DropdownMenuItem onSelect={action.onClick}>{inner}</DropdownMenuItem>
  }
}

/**
 * Renders a single {@link HandoutAction} as an {@link ActionPill}, dispatching
 * on the discriminated-union variant.
 *
 * @param action Action descriptor.
 * @returns The rendered pill node.
 */
function renderActionPill(action: HandoutAction) {
  switch (action.kind) {
    case 'link':
      return (
        <ActionPill
          key={action.key}
          kind="link"
          icon={action.icon}
          label={action.label}
          href={action.href}
        />
      )
    case 'button':
      return (
        <ActionPill
          key={action.key}
          kind="button"
          icon={action.icon}
          label={action.label}
          onClick={action.onClick}
        />
      )
  }
}

/**
 * Responsive presentation of the handout's share / download actions. On `sm+`
 * viewports each action becomes an {@link ActionPill} placed inline; on
 * smaller viewports they collapse into a single three-dot {@link DropdownMenu}.
 * Both presentations consume the same action descriptors so the action list
 * stays defined exactly once.
 */
export function HandoutActions({ pdfFilenameStem }: HandoutActionsProps) {
  // Translation hooks
  const tActions = useTranslations('ui.actions')
  const tHandouts = useTranslations('handouts.labels')

  // Clipboard hook for the share action
  const clipboard = useClipboard()

  // Share handler — copies the page URL and confirms via toast
  const handleShare = () => {
    clipboard.copy(window.location.href)
    toast.success(tActions('linkCopied'))
  }

  // Wake-lock state from the handouts route provider — single shared instance
  // that survives handout-to-handout navigation
  const {
    supported: wakeLockSupported,
    enabled: wantsScreenOn,
    setEnabled: setWantsScreenOn,
  } = useWakeLockContext()

  // Shared icon styling
  const iconClassName = 'size-4 text-muted-foreground'

  // Primary actions — currently just Share
  const primaryActions: HandoutAction[] = [
    {
      key: 'share',
      kind: 'button',
      icon: <Share2 className={iconClassName} aria-hidden />,
      label: tActions('share'),
      onClick: handleShare,
    },
  ]

  // Download actions — grouped together with a separator before them in the dropdown
  const downloadActions: HandoutAction[] = [
    {
      key: 'download-full',
      kind: 'link',
      icon: <Download className={iconClassName} aria-hidden />,
      label: tHandouts('downloadPdf'),
      href: getHandoutPdfUrl(`${pdfFilenameStem}.pdf`),
    },
    {
      key: 'download-skeleton',
      kind: 'link',
      icon: <Download className={iconClassName} aria-hidden />,
      label: tHandouts('downloadSkeleton'),
      href: getHandoutPdfUrl(`${pdfFilenameStem}-skeleton.pdf`),
    },
  ]

  // Flat list for the pill row
  const allActions = [...primaryActions, ...downloadActions]

  return (
    <>
      {/* Pill row on sm+ — `contents` lets pills join the parent flex flow directly */}
      <div className="hidden sm:contents">{allActions.map(renderActionPill)}</div>

      {/* Three-dot dropdown on smaller screens */}
      <div className="sm:hidden">
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <button
              className="inline-flex h-9 w-9 items-center justify-center rounded-full
                   bg-foreground/5 border border-foreground/10
                   text-muted-foreground hover:bg-foreground/5 hover:text-foreground/85
                   focus:outline-none focus-visible:ring-1 focus-visible:ring-focus/50
                   transition-colors duration-150"
              aria-label={tHandouts('moreActions')}
            >
              <MoreVertical className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-56 bg-surface/40 backdrop-blur-xl border-foreground/10"
            onCloseAutoFocus={(event) => event.preventDefault()}
          >
            {primaryActions.map((action) => (
              <ActionDropdownItem key={action.key} action={action} />
            ))}
            <DropdownMenuSeparator />
            {downloadActions.map((action) => (
              <ActionDropdownItem key={action.key} action={action} />
            ))}
            {wakeLockSupported && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                  checked={wantsScreenOn}
                  onCheckedChange={setWantsScreenOn}
                  onSelect={(event) => event.preventDefault()}
                >
                  {tActions('keepScreenOn')}
                </DropdownMenuCheckboxItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  )
}
