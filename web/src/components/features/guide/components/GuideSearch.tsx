import { ArrowUpRight, Info, Search } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { Modal } from '@/components/shared/components/Modal'
import { TruncatedText } from '@/components/shared/components/TruncatedText'
import { assertNever } from '@/components/shared/utils/assert-never'
import { cn } from '@/components/shared/utils/css-utils'

import { useGuideLabels } from '../content/guide-labels'
import type { GuideSearchEntry } from './guide-search'
import { useGuideSearch } from './use-guide-search'

/**
 * Props for the {@link GuideSearch} component.
 */
type GuideSearchProps = {
  /** Whether the palette is open. */
  isOpen: boolean
  /** Open/close the palette. */
  onOpenChange: (open: boolean) => void
}

/**
 * Props for the {@link ActionIcon} component.
 */
type ActionIconProps = {
  /** The target card's behavior in the deck. */
  behavior: GuideSearchEntry['behavior']
}

/**
 * The faint hint inside a result's reveal target: ⓘ when revealing the card opens a modal, nothing
 * otherwise (a lone-link card already exposes its own open button).
 */
function ActionIcon({ behavior }: ActionIconProps) {
  // Pick the hint glyph for the behavior
  switch (behavior) {
    // A modal-bearing card hints at its panel
    case 'modal':
      return <Info size={15} className="mt-0.5 shrink-0 text-muted" />
    // A lone link has its own open button; a plain card has nothing to hint
    case 'link':
    case 'static':
      return null
    // Exhaustive: a new behavior becomes a compile error
    default:
      return assertNever(behavior)
  }
}

/**
 * The guide's cross-page search: a quiet trigger in the tab row plus a "Jump to…" command palette that
 * fuzzy-matches every entity across the four content pages and reveals the chosen result in the deck
 * (scrolling to its card, opening its modal when it has one); a lone-link result also offers a direct open.
 */
export function GuideSearch({ isOpen, onOpenChange }: GuideSearchProps) {
  // Localized page names
  const labels = useGuideLabels()
  // Palette copy
  const t = useTranslations('guide.deck.search')
  // The search state machine: query, results, highlight, and the reveal/open dispatch
  const {
    query,
    onQueryChange,
    selected,
    setSelected,
    results,
    activeRowRef,
    onInputKeyDown,
    reveal,
    openLink,
  } = useGuideSearch({ isOpen, onClose: () => onOpenChange(false) })

  return (
    <>
      {/* Trigger: a quiet icon-only magnifier pinned to the tab bar's corner */}
      <button
        type="button"
        onClick={() => onOpenChange(true)}
        aria-label={t('open')}
        title={t('open')}
        className="inline-grid h-8 w-8 shrink-0 place-items-center rounded-full border border-foreground/15 text-muted transition-colors hover:border-brand hover:text-foreground"
      >
        <Search size={16} />
      </button>

      {/* The command palette */}
      <Modal
        isOpen={isOpen}
        onClose={() => onOpenChange(false)}
        showCloseButton={false}
        align="top"
        className="max-w-xl overflow-hidden p-0"
      >
        {/* Query input */}
        <div className="flex items-center gap-3 border-b border-foreground/10 px-4 py-3">
          <Search size={18} className="shrink-0 text-muted" />
          <input
            type="text"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder={t('placeholder')}
            autoFocus
            className="w-full bg-transparent text-foreground outline-none placeholder:text-muted"
          />
        </div>

        {/* Results, or an empty-state line */}
        <div className="max-h-[55vh] overflow-y-auto p-2">
          {/* No query yet → a gentle hint */}
          {!query.trim() && <p className="px-3 py-6 text-center text-sm text-muted">{t('hint')}</p>}
          {/* A query that matched nothing */}
          {query.trim() && results.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-muted">{t('noResults')}</p>
          )}
          {/* The ranked results */}
          {results.map((entry, index) => (
            <div
              key={`${entry.page}:${entry.id}`}
              ref={index === selected ? activeRowRef : null}
              onMouseEnter={() => setSelected(index)}
              className={cn(
                'flex items-stretch rounded-lg transition-colors',
                index === selected ? 'bg-brand/15' : 'hover:bg-foreground/5'
              )}
            >
              {/* Default action: reveal the card in the deck */}
              <button
                type="button"
                onClick={() => reveal(entry)}
                className="flex min-w-0 flex-1 items-start gap-3 px-3 py-2 text-left"
              >
                {/* Title + page tag, then the one-line description */}
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="flex flex-wrap items-center gap-x-2">
                    <span className="font-medium text-foreground">{entry.title}</span>
                    <span className="rounded-full border border-brand/30 px-2 py-0.5 text-[11px] text-brand-light">
                      {labels.page[entry.page]}
                    </span>
                  </span>
                  {/* The "what is it" payoff line; a hover tooltip reveals it in full when truncated */}
                  {entry.description && (
                    <TruncatedText className="mt-0.5 text-sm text-muted">
                      {entry.description}
                    </TruncatedText>
                  )}
                </span>
                {/* The faint modal hint, when revealing opens a panel */}
                <ActionIcon behavior={entry.behavior} />
              </button>
              {/* Secondary action: open a lone link's target directly */}
              {entry.behavior === 'link' && (
                <button
                  type="button"
                  onClick={() => openLink(entry)}
                  aria-label={t('openLink')}
                  title={t('openLink')}
                  className="flex shrink-0 items-center rounded-r-lg px-3 text-muted transition-colors hover:bg-foreground/10 hover:text-brand-light"
                >
                  <ArrowUpRight size={16} />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Key hints */}
        <div className="flex gap-4 border-t border-foreground/10 px-4 py-2 text-xs text-muted">
          {/* Result-dependent hints, only meaningful once there's something to act on */}
          {results.length > 0 && (
            <>
              <span>↑↓ {t('navigate')}</span>
              <span>↵ {t('reveal')}</span>
              {/* The open shortcut, only while a lone-link result is highlighted */}
              {results[selected]?.behavior === 'link' && <span>⌘↵ {t('openHint')}</span>}
            </>
          )}
          {/* Close is always available */}
          <span>esc {t('close')}</span>
        </div>
      </Modal>
    </>
  )
}
