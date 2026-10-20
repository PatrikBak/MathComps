'use client'

import { useAuth } from '@clerk/nextjs'
import { useLocale, useTranslations } from 'next-intl'
import { Activity, type ReactNode, useState } from 'react'

import { Button } from '@/components/shared/components/Button'
import { FetchStatePlaceholder } from '@/components/shared/components/FetchStatePlaceholder'
import { COMPACT_PANEL_CLASS } from '@/components/shared/components/FilterEmptyState'
import { ProseLink } from '@/components/shared/components/ProseLink'
import { assertNever } from '@/components/shared/utils/assert-never'
import { cn } from '@/components/shared/utils/css-utils'
import { useLoginRedirect } from '@/hooks/use-login-redirect'
import type { Locale } from '@/i18n/i18n'
import { errorCodeOf } from '@/lib/api/api-error'

import { PINNED_ATTRIBUTE } from '../hooks/use-open-detail'
import type { OpenDetail } from '../model/selection-routes'
import { PROPOSAL_AUTHORING_LANGUAGE } from '../model/selection-types'
import { BoardPanel } from './BoardPanel'
import { type PaperChoices, PaperDetail } from './PaperDetail'
import { PoolView } from './PoolView'
import { ProposalDetail } from './ProposalDetail'
import { SelectionWorkspaceProvider, useSelectionWorkspace } from './SelectionWorkspaceProvider'

/**
 * The selection's frame: the pool, a single problem or a single paper on the left, the board being filled on the
 * right. On a narrow screen the board folds into a bar above the content.
 */
export function SelectionShell() {
  // The page's own name and description
  const tPage = useTranslations('pages.problemSelection')

  return (
    <SelectionWorkspaceProvider>
      {/* Page title, for assistive tech */}
      <h1 className="sr-only">{tPage('title')}</h1>

      {/* The selection, or what stands in for it when there is none to show */}
      <SelectionAccess>
        <div
          className={cn(
            'lg:grid lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start lg:gap-8',
            'xl:grid-cols-[minmax(0,1fr)_23rem]'
          )}
        >
          {/* The board, on a wide screen, sticks where it already starts, the page's own 48px top padding
              below the header, and stays inside the window, so a long board scrolls on its own */}
          <aside
            // Marked as a part that can stay put while the screen scrolls under it
            {...PINNED_ATTRIBUTE.stamp('board')}
            className={cn(
              'mb-5 lg:sticky lg:top-[calc(var(--header-height)+48px)] lg:order-2 lg:mb-0',
              'lg:max-h-[calc(100dvh-var(--header-height)-64px)] lg:overflow-y-auto'
            )}
          >
            <BoardPanel />
          </aside>

          {/* The pool, or the page open over it */}
          <div className="min-w-0 lg:order-1">
            <SelectionContent />
          </div>
        </div>
      </SelectionAccess>
    </SelectionWorkspaceProvider>
  )
}

/**
 * Props for the {@link SelectionAccess} component.
 */
type SelectionAccessProps = {
  /** The selection itself. */
  children: ReactNode
}

/**
 * The selection, loading or loaded. A reader who has to sign in first, a first read trying again or held back by
 * a lost connection, an account the API turns away, and a read that gave up before anything arrived each get a
 * stand-in in its place instead.
 */
function SelectionAccess({ children }: SelectionAccessProps) {
  // Copy for what stands in for the selection
  const t = useTranslations('problemSelection.access')

  // The shared names for doing things to something
  const tActions = useTranslations('ui.actions')

  // Whether anybody is signed in, once sign-in has settled
  const { isLoaded, isSignedIn } = useAuth()

  // The selection, how far its read has got, and the way to read it again
  const { selection, uiState, retry } = useSelectionWorkspace()

  // The way to an account, which comes back to this page
  const { getLoginUrl } = useLoginRedirect()

  // Nobody to read the selection as, so its read never starts
  if (isLoaded && !isSignedIn) {
    return (
      <SelectionNotice>
        <p>
          {t.rich('signIn', {
            link: (chunks) => <ProseLink href={getLoginUrl()}>{chunks}</ProseLink>,
          })}
        </p>
      </SelectionNotice>
    )
  }

  // Data on screen outlives a refresh that failed or a connection that went
  if (selection !== null) return children

  // With no selection on screen yet, how far its read has got decides what stands in its place
  switch (uiState.kind) {
    // A first read on its way, which the selection draws its own placeholder for
    case 'loading':
    // A read that has landed, which always brings the selection and so never gets here
    case 'ready':
      return children

    // Another attempt on its way, or a lost connection the read picks up after by itself
    case 'retrying':
    case 'offline':
      return (
        <FetchStatePlaceholder
          uiState={uiState}
          className={COMPACT_PANEL_CLASS}
          empty={null}
          failed={null}
        />
      )

    // The read gave up: an account off the MathComps organization's list is turned away,
    // anything else can try again
    case 'failed':
      return errorCodeOf(uiState.error) === 'Forbidden' ? (
        <SelectionNotice>
          <p>{t('forbidden')}</p>
        </SelectionNotice>
      ) : (
        <SelectionNotice>
          <p>{t('failed')}</p>
          <Button size="sm" variant="secondary" onClick={retry}>
            {tActions('retry')}
          </Button>
        </SelectionNotice>
      )

    // Every state is handled above
    default:
      return assertNever(uiState)
  }
}

/**
 * Props for the {@link SelectionNotice} component.
 */
type SelectionNoticeProps = {
  /** The sentence, and any way onward under it. */
  children: ReactNode
}

/**
 * A notice standing where the selection would be.
 */
function SelectionNotice({ children }: SelectionNoticeProps) {
  // The notice in the dashed panel
  return <div className={cn(COMPACT_PANEL_CLASS, 'text-sm text-muted')}>{children}</div>
}

/**
 * The pool, or the page open over it. The pool stays mounted while hidden, so its cards come back without being
 * built again. A page opens in the pool's language where what it shows is written in that language. A paper's page
 * opens in the language last picked for it, if any, with its ratings ordered as they were last left. Where any one
 * text will do, everything reads in the site's language, or in the one a problem has where it lacks that.
 */
function SelectionContent() {
  // The page open in full, if any, and the selection, if its read has landed
  const { detail, selection } = useSelectionWorkspace()

  // The site's language
  const siteLanguage = useLocale() as Locale

  // The language picked over the pool
  const [poolLanguage, setPoolLanguage] = useState<Locale>(PROPOSAL_AUTHORING_LANGUAGE)

  // The language the problems are read in: the one picked while every language is needed, the site's where any one
  // text will do
  const readingLanguage =
    selection === null || selection.needsEveryLanguage ? poolLanguage : siteLanguage

  // What was last chosen on each paper's page, by the paper's id
  const [paperChoices, setPaperChoices] = useState<ReadonlyMap<string, PaperChoices>>(new Map())

  // A function which keeps a choice made on a paper's page beside the ones made there before
  const keepPaperChoice = (paperId: string, choice: PaperChoices) =>
    setPaperChoices((current) =>
      new Map(current).set(paperId, { ...current.get(paperId), ...choice })
    )

  return (
    <>
      <Activity mode={detail === null ? 'visible' : 'hidden'}>
        <PoolView language={readingLanguage} onLanguageChange={setPoolLanguage} />
      </Activity>
      {detail !== null && (
        <DetailView
          detail={detail}
          poolLanguage={readingLanguage}
          paperChoices={paperChoices}
          onPaperChoice={keepPaperChoice}
        />
      )}
    </>
  )
}

/**
 * Props for the {@link DetailView} component.
 */
type DetailViewProps = {
  /** The page open over the pool. */
  detail: OpenDetail
  /** The language the pool is read in. */
  poolLanguage: Locale
  /** What was last chosen on each paper's page, by the paper's id. */
  paperChoices: ReadonlyMap<string, PaperChoices>
  /** Keeps a choice made on a paper's page, by the paper's id. */
  onPaperChoice: (paperId: string, choice: PaperChoices) => void
}

/**
 * The page open over the pool, a problem's or a paper's, once the selection holding its subject has arrived.
 */
function DetailView({ detail, poolLanguage, paperChoices, onPaperChoice }: DetailViewProps) {
  // The selection, if its read has landed
  const { selection } = useSelectionWorkspace()

  // The selection still on its way
  if (selection === null) {
    return <div className="h-96 animate-pulse rounded-xl bg-surface/25" aria-hidden />
  }

  // A problem's page or a paper's, by the kind of page open
  switch (detail.kind) {
    case 'proposal':
      return <ProposalDetail proposalId={detail.id} poolLanguage={poolLanguage} />
    case 'paper':
      return (
        <PaperDetail
          paperId={detail.id}
          poolLanguage={poolLanguage}
          choices={paperChoices.get(detail.id) ?? {}}
          onChoice={(choice) => onPaperChoice(detail.id, choice)}
        />
      )

    // Every kind is handled above
    default:
      return assertNever(detail)
  }
}
