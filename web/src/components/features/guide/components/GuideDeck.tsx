'use client'

import { useDisclosure, useElementSize } from '@mantine/hooks'
import { ChevronLeft, ChevronRight, type LucideIcon } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { type ReactNode, useCallback, useMemo, useRef } from 'react'

import ContactButton from '@/components/features/contact/ContactButton'
import { Pager } from '@/components/shared/components/Pager'
import { assertNever } from '@/components/shared/utils/assert-never'
import { cn } from '@/components/shared/utils/css-utils'
import { useStickyScroll } from '@/hooks/use-sticky-scroll'

import { GUIDE_PAGES, type GuidePage } from '../content/guide-content-types'
import { type GuideFilters } from '../content/guide-filters'
import { useGuideLabels } from '../content/guide-labels'
import { GetStartedPage } from '../pages/GetStartedPage'
import { OlympiadPage } from '../pages/OlympiadPage'
import { OtherPage } from '../pages/OtherPage'
import { ResourcesPage } from '../pages/ResourcesPage'
import { SeminarsPage } from '../pages/SeminarsPage'
import { WhyPage } from '../pages/WhyPage'
import { GuideDeckContext, type GuideDeckContextValue } from './guide-deck-context'
import { GuideTabStrip } from './GuideTabStrip'
import { useDeckEntityRequest } from './use-deck-entity-request'
import { useDeckKeyboard } from './use-deck-keyboard'
import { useDeckUrlState } from './use-deck-url-state'
import { useModalRegistry } from './use-modal-registry'

/**
 * Props for the {@link ArrowButton} component.
 */
type ArrowButtonProps = {
  /** Which adjacent page the button steps toward. */
  direction: 'previous' | 'next'
  /** The chevron glyph. */
  icon: LucideIcon
  /** The small uppercase kicker above the page name (e.g. "Previous"). */
  kicker: string
  /** The adjacent page's name. */
  label: string
  /** Whether stepping in this direction is unavailable (at the first/last page). */
  disabled: boolean
  /** Invoked to step to the adjacent page. */
  onClick: () => void
}

/**
 * A large previous/next navigation button shown beneath the deck.
 */
function ArrowButton({
  direction,
  icon: Icon,
  kicker,
  label,
  disabled,
  onClick,
}: ArrowButtonProps) {
  // The circular chevron beside the kicker + page name
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-foreground/10 bg-surface/40 p-3.5 text-left transition-colors',
        'hover:border-brand hover:bg-brand/10 disabled:opacity-30 disabled:hover:border-foreground/10 disabled:hover:bg-surface/40',
        direction === 'next' && 'flex-row-reverse text-right'
      )}
    >
      <span className="grid h-9 w-9 flex-none place-items-center rounded-full border border-foreground/15">
        <Icon size={18} />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-[11px] uppercase tracking-wide text-muted hyphens-none sm:text-xs">
          {kicker}
        </span>
        <span className="text-sm font-semibold leading-tight text-foreground hyphens-none sm:text-base">
          {label}
        </span>
      </span>
    </button>
  )
}

/**
 * Props for the {@link GuideDeck} component.
 */
type GuideDeckProps = {
  /** Pre-rendered rich resource descriptions, keyed by resource id. */
  richDescriptions: Record<string, ReactNode>
}

/**
 * The guide deck: a page-at-a-time pager (tabs + arrows + dots + swipe + keyboard) over six pages,
 * with the active page and its per-page filters reflected in the URL.
 */
export function GuideDeck({ richDescriptions }: GuideDeckProps) {
  // Hero + page copy
  const tGuide = useTranslations('guide')
  // Deck chrome copy (the previous/next kickers)
  const tDeck = useTranslations('guide.deck')
  // Localized value labels (page names)
  const labels = useGuideLabels()

  // A sentinel marking the deck's natural top, sitting just above the sticky tab bar
  const topAnchorRef = useRef<HTMLDivElement | null>(null)
  // The sticky tab bar's live height (it grows as the row wraps), so a reveal can land a card below it
  const { ref: stickyTabBarRef, height: stickyTabBarHeight } = useElementSize<HTMLDivElement>()
  // Window-scroll helper that lands a target under the sticky header
  const { scrollToElement } = useStickyScroll()
  // Glide the deck's top flush beneath the site header — only ever upward, so paging from the hero
  // doesn't yank the view down
  const scrollToStickyTop = useCallback(
    () => scrollToElement(topAnchorRef.current, { onlyUp: true }),
    [scrollToElement]
  )

  // The URL-backed page + per-page filter memory and its navigation controls
  const { selectedIndex, filtersForPage, goToIndex, goToPage, setPageFilters } =
    useDeckUrlState(scrollToStickyTop)
  // The open-card-modal registry, so arrow paging can stand down while a modal is up
  const { registerOpenModal, anyModalOpen } = useModalRegistry()
  // The pending deep-link reveal request (navigates, then flags the entity for its card)
  const { openEntityId, requestOpenEntity, clearOpenEntity } = useDeckEntityRequest(goToPage)
  // Whether the cross-page search palette is open
  const [paletteOpen, palette] = useDisclosure(false)

  // Arrow-key paging + ⌘K/"/" search, standing down while typing or behind a modal
  useDeckKeyboard({ selectedIndex, goToIndex, anyModalOpen, openPalette: palette.open })

  // A stable filter-change handler per page, so each filterable page's memoized groups don't churn
  const filterHandlers = useMemo(
    () =>
      Object.fromEntries(
        GUIDE_PAGES.map((page) => [page, (next: GuideFilters) => setPageFilters(page, next)])
      ) as Record<GuidePage, (filters: GuideFilters) => void>,
    [setPageFilters]
  )

  // Bundle the deck controls into one stable object for the context
  const deckControls: GuideDeckContextValue = useMemo(
    () => ({
      goToPage,
      requestOpenEntity,
      openEntityId,
      clearOpenEntity,
      registerOpenModal,
      stickyTabBarHeight,
      richDescriptions,
    }),
    [
      goToPage,
      requestOpenEntity,
      openEntityId,
      clearOpenEntity,
      registerOpenModal,
      stickyTabBarHeight,
      richDescriptions,
    ]
  )

  // Render the component for a page
  const renderPage = (page: GuidePage) => {
    // Dispatch on the page (filterable pages get their remembered filters + stable change handler)
    switch (page) {
      case 'why':
        return <WhyPage />
      case 'olympiad':
        return <OlympiadPage />
      case 'other':
        return <OtherPage filters={filtersForPage(page)} onFiltersChange={filterHandlers[page]} />
      case 'seminars':
        return (
          <SeminarsPage filters={filtersForPage(page)} onFiltersChange={filterHandlers[page]} />
        )
      case 'resources':
        return (
          <ResourcesPage filters={filtersForPage(page)} onFiltersChange={filterHandlers[page]} />
        )
      case 'getStarted':
        return <GetStartedPage />
      // Exhaustive: a new page becomes a compile error
      default:
        return assertNever(page)
    }
  }

  // The previous page's label (em dash at the first page)
  const previousLabel = selectedIndex > 0 ? labels.page[GUIDE_PAGES[selectedIndex - 1]] : '—'
  // The next page's label (em dash at the last page)
  const nextLabel =
    selectedIndex < GUIDE_PAGES.length - 1 ? labels.page[GUIDE_PAGES[selectedIndex + 1]] : '—'

  // The deck: hero, sticky tabs, the pager, then arrow + dot navigation
  return (
    <GuideDeckContext value={deckControls}>
      {/* Hero */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold leading-tight tracking-tight text-foreground sm:text-4xl md:text-5xl">
          {tGuide('hero.title')}
        </h1>
        <p className="mt-3 text-base text-muted-foreground hyphens-none sm:text-lg">
          {tGuide.rich('hero.description', {
            // The closing CTA opens the contact form, pre-set to a content suggestion
            link: (chunks) => (
              <ContactButton
                reason="contentContribution"
                className="text-link underline transition-colors hover:text-link-hover"
              >
                {chunks}
              </ContactButton>
            ),
          })}
        </p>
      </div>

      {/* Anchor marking the deck's top, just above the sticky tab bar */}
      <div ref={topAnchorRef} className="h-0" />

      {/* Sticky page-tab bar (measured so a card reveal can land below it) */}
      <GuideTabStrip
        rootRef={stickyTabBarRef}
        selectedIndex={selectedIndex}
        onSelect={goToIndex}
        paletteOpen={paletteOpen}
        onPaletteOpenChange={palette.set}
      />

      {/* The pager */}
      <Pager
        selectedIndex={selectedIndex}
        onSelect={goToIndex}
        slides={GUIDE_PAGES.map((page) => (
          <div key={page} className="px-1.5 pt-6 pb-1.5">
            {renderPage(page)}
          </div>
        ))}
      />

      {/* Previous / next arrows */}
      <div className="mt-8 flex items-stretch justify-between gap-3">
        <ArrowButton
          direction="previous"
          icon={ChevronLeft}
          kicker={tDeck('previous')}
          label={previousLabel}
          disabled={selectedIndex === 0}
          onClick={() => goToIndex(selectedIndex - 1)}
        />
        <ArrowButton
          direction="next"
          icon={ChevronRight}
          kicker={tDeck('next')}
          label={nextLabel}
          disabled={selectedIndex === GUIDE_PAGES.length - 1}
          onClick={() => goToIndex(selectedIndex + 1)}
        />
      </div>

      {/* Dots */}
      <div className="mb-2 mt-4 flex justify-center gap-2">
        {GUIDE_PAGES.map((page, index) => (
          <button
            key={page}
            type="button"
            aria-label={labels.page[page]}
            onClick={() => goToIndex(index)}
            className={cn(
              'h-2 w-2 rounded-full transition-colors',
              index === selectedIndex ? 'bg-brand' : 'bg-foreground/20 hover:bg-foreground/40'
            )}
          />
        ))}
      </div>
    </GuideDeckContext>
  )
}
