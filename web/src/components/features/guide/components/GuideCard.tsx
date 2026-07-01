import { useDisclosure } from '@mantine/hooks'
import { ArrowUpRight, Info } from 'lucide-react'
import { type ReactNode, useCallback, useEffect } from 'react'

import { AppLink } from '@/components/shared/components/AppLink'
import { Modal } from '@/components/shared/components/Modal'
import { assertNever } from '@/components/shared/utils/assert-never'
import { cn } from '@/components/shared/utils/css-utils'
import { isExternalHref } from '@/components/shared/utils/url-utils'

import type { GuideLink } from '../content/guide-content-types'
import { tileBehavior } from '../content/guide-tile-behavior'
import { BulletList } from '../layout/BulletList'
import { GuideHeading } from '../layout/GuideHeading'
import { GuideLinkButton } from '../layout/GuideLinkButton'
import { GuideText } from '../layout/GuideText'
import { useGuideDeck } from './guide-deck-context'
import { useDeckEntityReveal } from './use-deck-entity-reveal'

/** The corner disclosure hint icon: ⓘ for a modal trigger, ↗ for an outbound link. */
type CornerAffordance = 'modal' | 'link'

/**
 * A tile whose whole card navigates, hinted by a corner ↗.
 */
type LinkTile = {
  /** Discriminator: a navigating tile. */
  kind: 'link'
  /** The navigation target (external links open a new tab). */
  href: string
}

/**
 * A tile whose whole card is a button, hinted by a corner ⓘ (modal) or ↗ (link).
 */
type ButtonTile = {
  /** Discriminator: a button tile. */
  kind: 'button'
  /** The click handler. */
  onClick: () => void
  /** Which corner hint to show. */
  affordance: CornerAffordance
}

/**
 * A plain, non-interactive tile with no corner hint.
 */
type StaticTile = {
  /** Discriminator: a static tile. */
  kind: 'static'
}

/**
 * A tile's interaction mode, tagged by kind.
 */
type TileVariant = LinkTile | ButtonTile | StaticTile

/**
 * Props for the {@link Corner} component.
 */
type CornerProps = {
  /** Which corner hint to show. */
  affordance: CornerAffordance
}

/**
 * The faint corner hint that brightens on hover: ⓘ for a modal, ↗ for an outbound link.
 */
function Corner({ affordance }: CornerProps) {
  // The hover color and glyph vary by affordance
  let hoverClass: string
  let icon: ReactNode
  // Resolve the corner presentation for the affordance
  switch (affordance) {
    // Modal trigger → an info glyph that warms to the brand color
    case 'modal':
      hoverClass = 'group-hover:text-brand-light'
      icon = <Info size={17} />
      break
    // Outbound link → an arrow that warms to the link color
    case 'link':
      hoverClass = 'group-hover:text-link'
      icon = <ArrowUpRight size={17} />
      break
    // Exhaustive: a new affordance becomes a compile error
    default:
      return assertNever(affordance)
  }
  // The faint glyph, brightening on hover
  return (
    <span
      className={cn(
        'pointer-events-none absolute right-3.5 top-3.5 text-muted opacity-50 transition-opacity group-hover:opacity-100 sm:right-4 sm:top-4',
        hoverClass
      )}
    >
      {icon}
    </span>
  )
}

/**
 * Props for the {@link TileShell} component.
 */
type TileShellProps = {
  /** The element id. */
  id: string
  /** Whether to show the transient reveal ring (a search jump just landed here). */
  revealed: boolean
  /** The tile contents. */
  children: ReactNode
} & TileVariant

/**
 * The uniform tile shell: a hairline card that is whole-card clickable (button or link) or static,
 * with a faint corner affordance that brightens on hover.
 */
function TileShell(props: TileShellProps) {
  // Interactive everywhere except the static variant
  const interactive = props.kind !== 'static'
  // Shared tile chrome. flex-col (not block) so a stretched <button> tile top-aligns its content
  // like the <a>/<div> variants, instead of the browser's default vertical centering.
  const className = cn(
    'group relative flex scroll-mt-24 flex-col rounded-xl border border-foreground/10 bg-surface/40 p-4 text-left transition-colors sm:p-5',
    interactive && 'hover:border-foreground/20 hover:bg-foreground/[0.03]',
    props.revealed && 'ring-2 ring-brand ring-offset-2 ring-offset-background'
  )

  // Build the tile for its interaction mode
  switch (props.kind) {
    // Link → the whole card navigates (external links open a new tab)
    case 'link':
      return (
        <AppLink
          id={props.id}
          href={props.href}
          newTab={isExternalHref(props.href)}
          className={cn(className, 'no-underline')}
        >
          <Corner affordance="link" />
          {props.children}
        </AppLink>
      )
    // Button → the whole card is a button, with a modal or link corner hint
    case 'button':
      return (
        <button
          id={props.id}
          type="button"
          onClick={props.onClick}
          className={cn(
            className,
            'w-full cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-focus'
          )}
        >
          <Corner affordance={props.affordance} />
          {props.children}
        </button>
      )
    // Static → a plain, non-interactive card
    case 'static':
      return (
        <div id={props.id} className={className}>
          {props.children}
        </div>
      )
    // Exhaustive: a new tile kind becomes a compile error
    default:
      return assertNever(props)
  }
}

/**
 * Props for the {@link MetaRow} component.
 */
type MetaRowProps = {
  /** Whether the row is the tile's primary content rather than its quiet bottom line. */
  lead: boolean
  /** The meta tokens. */
  children: ReactNode
}

/**
 * A tile's meta line: a single colored token plus plain tokens. It rides the bottom as a quiet aside
 * beneath the description, or leads directly under the title when the tile carries no description.
 */
function MetaRow({ lead, children }: MetaRowProps) {
  // A flex row of meta tokens, placed by lead vs trailing
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted',
        // Leading → sits right under the title; trailing → pinned to the bottom, set off by a gap
        lead ? 'mt-1' : 'mt-auto pt-3'
      )}
    >
      {children}
    </div>
  )
}

/**
 * Props for the {@link GuideCard} component.
 */
type GuideCardProps = {
  /** A stable id; also the deck deep-link target. */
  id: string
  /** The tile heading. */
  title: ReactNode
  /** An optional name shown beside the title and in the modal heading (e.g. a full name). */
  aside?: string
  /** A one-line description: plain text or a rich node; absent for a metadata-only tile. */
  description?: ReactNode
  /** Caller-composed meta tokens, shown on the quiet bottom line. */
  meta?: ReactNode
  /** Overflow detail bullets; their presence grows a detail modal. */
  details?: ReactNode[]
  /** Official links: one makes the tile a link, several open a chooser modal. */
  links: GuideLink[]
}

/**
 * The one guide tile. Its whole interaction model is derived from which ingredients are present:
 * overflow bullets or several links grow a modal (whole-card button), a lone link makes the whole
 * card navigate, and anything else stays a plain card. A deck deep-link reveals any card (scroll +
 * highlight); a modal-bearing one also opens its modal.
 */
export function GuideCard({ id, title, aside, description, meta, details, links }: GuideCardProps) {
  // The modal-registration control (cards announce an open modal so the deck stands down its paging)
  const { registerOpenModal } = useGuideDeck()
  // Whether the detail/chooser modal is open
  const [modalOpen, { open: openModal, close: closeModal }] = useDisclosure(false)

  // Overflow bullets, if any
  const detailItems = details ?? []
  // Whether overflow bullets are present (drives the modal body + corner affordance)
  const hasDetails = detailItems.length > 0
  // The tile's interaction model, from the shared classifier
  const behavior = tileBehavior(detailItems.length, links.length)
  // A modal-bearing tile: detail bullets or a multi-link chooser
  const hasModal = behavior === 'modal'

  // On a deck deep-link to this card, a modal-bearing one also opens its modal
  const handleReveal = useCallback(() => {
    // Open the modal only when there is one
    if (hasModal) openModal()
  }, [hasModal, openModal])

  // Reveal this card (scroll + highlight, plus the modal open above) when the deck deep-links to it;
  // the ring holds until any modal it opens is closed, so it's seen rather than spent behind the panel
  const { revealed } = useDeckEntityReveal(id, handleReveal, modalOpen)

  // Let the deck know a modal is up, so its arrow-key paging stands down while it's open
  useEffect(() => {
    // Nothing to announce while closed
    if (!modalOpen) return
    // Register on open; the returned deregister fires on close or unmount
    return registerOpenModal()
  }, [modalOpen, registerOpenModal])

  // Derive the tile's interaction mode from the classified behavior
  let shell: TileVariant
  // Dispatch on the shared tile-behavior classification
  switch (behavior) {
    // A modal-bearing tile is a whole-card button, hinting at a detail panel or a link chooser
    case 'modal':
      shell = { kind: 'button', onClick: openModal, affordance: hasDetails ? 'modal' : 'link' }
      break
    // A lone link makes the whole card navigate
    case 'link':
      shell = { kind: 'link', href: links[0].url }
      break
    // Nothing interactive — a plain card
    case 'static':
      shell = { kind: 'static' }
      break
    // Exhaustive: a new behavior becomes a compile error
    default:
      shell = assertNever(behavior)
  }

  // The aside beside the title, a notch dimmer; reused on the tile and as the modal heading
  const asideNode = aside && (
    <GuideText variant="acronym" as="span">
      ({aside})
    </GuideText>
  )

  // The detail/chooser modal body: an informative detail modal leads with the description and bullets;
  // a pure link chooser shows just the labeled links under the title.
  const modalBody = (
    <>
      {/* The description leads the detail modal, kept at body size; the chooser drops it as redundant */}
      {hasDetails && <GuideText className="mb-4 sm:text-base">{description}</GuideText>}
      {/* Overflow detail bullets */}
      {hasDetails && <BulletList items={detailItems} />}
      {/* A labeled button per official link */}
      {links.length > 0 && (
        <div className={cn('flex flex-col gap-2', hasDetails && 'mt-4')}>
          {links.map((link) => (
            <GuideLinkButton key={link.url} link={link} />
          ))}
        </div>
      )}
    </>
  )

  // The tile, plus its modal when the ingredients earned one
  return (
    <>
      <TileShell id={id} revealed={revealed} {...shell}>
        {/* Title, with the optional aside beside it */}
        <div className="flex flex-wrap items-baseline gap-x-2 pr-6">
          <GuideHeading level="h4">{title}</GuideHeading>
          {asideNode}
        </div>
        {/* One-line description, plain or rich, when the tile carries one */}
        {description && (
          <GuideText variant="small" as="div" className="mt-1">
            {description}
          </GuideText>
        )}
        {/* The meta line; it leads the tile when there's no description, else rides the bottom */}
        {meta && <MetaRow lead={!description}>{meta}</MetaRow>}
      </TileShell>
      {/* The detail bullets, mirrored into the page flow for crawlers. The visible copy lives in the
          modal below, which renders in a portal that never server-renders, so on its own it would keep
          this text out of the HTML */}
      {hasDetails && (
        <div className="sr-only">
          <BulletList items={detailItems} />
        </div>
      )}
      {/* The detail/chooser modal */}
      {hasModal && (
        <Modal
          isOpen={modalOpen}
          onClose={closeModal}
          showCloseButton
          title={
            <span className="flex flex-wrap items-baseline gap-x-2">
              {title}
              {asideNode}
            </span>
          }
        >
          {modalBody}
        </Modal>
      )}
    </>
  )
}
