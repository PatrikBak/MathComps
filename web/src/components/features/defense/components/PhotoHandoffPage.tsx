'use client'

import { useHash, useMounted } from '@mantine/hooks'
import { useTranslations } from 'next-intl'
import type { ReactNode } from 'react'

import { Button } from '@/components/shared/components/Button'
import { FetchStatePlaceholder } from '@/components/shared/components/FetchStatePlaceholder'
import { PhotoViewer } from '@/components/shared/components/PhotoViewer'
import { assertNever } from '@/components/shared/utils/assert-never'
import { cn } from '@/components/shared/utils/css-utils'
import type { AppErrorCode } from '@/lib/api/api-error-codes'
import { resolveErrorMessage } from '@/lib/api/api-error-utils'

import { useDefensePhotoViewer } from '../hooks/use-defense-photo-viewer'
import type { UseDefensePhotosResult } from '../hooks/use-defense-photos'
import { usePhotoHandoff } from '../hooks/use-photo-handoff'
import { defenseTargetKey, toSessionTarget } from '../model/defense-target'
import type { HandoffPhotoReading, NamedDefenseTarget } from '../model/defense-types'
import type { HandoffPhoto } from '../model/photo-handoff'
import { groupHandoffPhotos } from '../model/photo-handoff'
import { DefensePhotoButton } from './DefensePhotoButton'
import { DefensePhotoFailure } from './DefensePhotoFailure'
import { DefensePhotoStrip } from './DefensePhotoStrip'
import { DefenseTargetLabel } from './DefenseTargetLabel'

/**
 * The column the page stands in, kept narrow on a screen wider than a phone's.
 */
const COLUMN_CLASS = 'mx-auto flex w-full max-w-xl flex-col gap-8'

/**
 * The panel a notice on the page stands in.
 */
const NOTICE_CLASS = cn(
  'flex flex-col items-center justify-center gap-3 p-6 text-center text-sm text-muted',
  'rounded-lg border border-dashed border-foreground/10'
)

/**
 * Props for the {@link HandoffFailures}.
 */
type HandoffFailuresProps = {
  /** The photos standing under the problem photos go to now, in page order. */
  current: readonly HandoffPhoto[]
  /** The phone's photos and what can be done with them. */
  photos: UseDefensePhotosResult<HandoffPhotoReading>
}

/**
 * The failed photos among a problem's, one row each: which photo by its tile's number, why it failed, and the way on.
 */
function HandoffFailures({ current, photos }: HandoffFailuresProps) {
  // Nothing failed, so nothing to say
  if (!current.some((photo) => photo.kind === 'failed')) return null

  // One row per failed photo, numbered as its tile is
  return (
    <ul className="divide-y divide-foreground/10 rounded-lg border border-foreground/10 text-sm">
      {current.map((photo, index) => {
        // Only a failed photo has a row
        if (photo.kind !== 'failed') return null

        // Its row: the mark, which photo and why, and the way on
        return (
          <li
            key={photo.id}
            className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-3 py-2.5"
          >
            <DefensePhotoFailure
              photoNumber={index + 1}
              errorCode={photo.errorCode}
              onRetry={() => photos.retryPhoto(photo.id)}
              onRemove={() => photos.removePhotos([photo.id])}
            />
          </li>
        )
      })}
    </ul>
  )
}

/**
 * Props for the {@link HandoffPhotoStrip}.
 */
type HandoffPhotoStripProps = {
  /** The photos, in page order. */
  photos: readonly HandoffPhoto[]
  /** Tiles after the photos. */
  children?: ReactNode
}

/**
 * Photos the phone sent to one problem, each shown large on a press and swiped through from there.
 */
function HandoffPhotoStrip({ photos, children }: HandoffPhotoStripProps) {
  // The photos shown large over the whole screen
  const viewer = useDefensePhotoViewer({
    links: photos.map((photo) => photo.previewUrl),
    item: 'photo',
  })

  // A function which shows the photos large from the one pressed
  const enlarge = (id: number) => viewer.openAt(photos.findIndex((photo) => photo.id === id))

  // The photos, then the same photos large
  return (
    <>
      <DefensePhotoStrip photos={photos} actions={{ kind: 'enlarge', onEnlarge: enlarge }}>
        {children}
      </DefensePhotoStrip>
      <PhotoViewer
        photos={viewer.viewerPhotos}
        index={viewer.index}
        isOpen={viewer.isOpen}
        onIndexChange={viewer.swipeTo}
        onClose={viewer.close}
      />
    </>
  )
}

/**
 * Props for the {@link LiveHandoff}.
 */
type LiveHandoffProps = {
  /** The problem photos go to now. */
  target: NamedDefenseTarget
  /** The phone's photos and what can be done with them. */
  photos: UseDefensePhotosResult<HandoffPhotoReading>
}

/**
 * A code that works: the problem photos go to now, its photos with the button taking more, and the photos sent to
 * the problems it pointed at before.
 */
function LiveHandoff({ target, photos }: LiveHandoffProps) {
  // Copy for the phone's page
  const t = useTranslations('defense.photoHandoff')

  // The photos under the problems they went to
  const groups = groupHandoffPhotos(photos.photos, target)

  // The current problem first, the earlier ones under it
  return (
    <div className={COLUMN_CLASS}>
      {/* Where photos go now */}
      <section className="flex flex-col gap-4">
        {/* The problem, and the hint */}
        <header className="flex flex-col gap-1">
          <p className="text-sm text-muted">{t('goesTo')}</p>
          <h1 className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 text-lg">
            <DefenseTargetLabel target={target} emphasis="strong" />
          </h1>
          <p className="text-sm text-muted">{t('hint')}</p>
        </header>

        {/* The problem's photos, then the way to more, started over with the large view shut whenever the code
            moves on */}
        <HandoffPhotoStrip key={defenseTargetKey(toSessionTarget(target))} photos={groups.current}>
          <DefensePhotoButton variant="page" onPick={photos.addPhotos} />
        </HandoffPhotoStrip>

        {/* Why any of the problem's photos failed */}
        <HandoffFailures current={groups.current} photos={photos} />
      </section>

      {/* Problems the code pointed at before */}
      {groups.earlier.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="text-sm font-medium text-muted">{t('earlier')}</h2>
          {groups.earlier.map((group) => (
            <div
              key={defenseTargetKey(toSessionTarget(group.target))}
              className="flex flex-col gap-2"
            >
              <h3 className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 text-sm">
                <DefenseTargetLabel target={group.target} emphasis="muted" />
              </h3>
              <HandoffPhotoStrip photos={group.photos} />
            </div>
          ))}
        </section>
      )}
    </div>
  )
}

/**
 * A code that never worked or has run out, which the API's own copy says with the way on.
 */
function DeadHandoff() {
  // Central failure-code copy
  const tApiErrors = useTranslations('apiErrors')

  // The one line, in the page's column
  return (
    <div className={COLUMN_CLASS}>
      <p className={cn(NOTICE_CLASS, 'text-foreground')}>
        {tApiErrors('DefensePhotoHandoffNotFound')}
      </p>
    </div>
  )
}

/**
 * Props for the {@link CheckFailed}.
 */
type CheckFailedProps = {
  /** Why the check gave up, or undefined when nothing said why. */
  errorCode: AppErrorCode | undefined
  /** Checks again. */
  onRetry: () => void
}

/**
 * A first check that gave up for a reason other than the code, saying why, with another go.
 */
function CheckFailed({ errorCode, onRetry }: CheckFailedProps) {
  // Copy for the phone's page
  const t = useTranslations('defense.photoHandoff')

  // Central failure-code copy
  const tApiErrors = useTranslations('apiErrors')

  // Copy for the buttons the whole app shares
  const tActions = useTranslations('ui.actions')

  // Why, and another go, in the page's column
  return (
    <div className={COLUMN_CLASS}>
      <div className={NOTICE_CLASS}>
        <p>{resolveErrorMessage(errorCode, tApiErrors, { fallback: t('checkError') })}</p>
        <Button size="sm" variant="secondary" onClick={onRetry}>
          {tActions('retry')}
        </Button>
      </div>
    </div>
  )
}

/**
 * Props for the {@link CodeHandoff}.
 */
type CodeHandoffProps = {
  /** The handoff code the page was opened with. */
  code: string
}

/**
 * The phone's page for one code, by where the code stands.
 */
function CodeHandoff({ code }: CodeHandoffProps) {
  // Where the code stands, and the photos sent through it
  const { state, photos } = usePhotoHandoff(code)

  // By where the code stands
  switch (state.kind) {
    // The code works
    case 'live':
      return <LiveHandoff target={state.target} photos={photos} />

    // The code never worked, or has run out
    case 'dead':
      return <DeadHandoff />

    // The code's first check is still on its way, through a wait or a lost connection
    case 'checking':
      return (
        <div className={COLUMN_CLASS}>
          <FetchStatePlaceholder
            uiState={state.uiState}
            className={NOTICE_CLASS}
            empty={null}
            failed={null}
          />
        </div>
      )

    // The code's first check gave up, for a reason other than the code itself
    case 'checkFailed':
      return <CheckFailed errorCode={state.errorCode} onRetry={state.retry} />

    // Every state is handled above
    default:
      return assertNever(state)
  }
}

/**
 * The page a phone opens from a computer's QR, with no account: it takes photos of the student's handwritten work
 * and sends each one, through the code, to the problem the computer points the code at. Removing a page that was
 * read, and fixing its text, happen on the computer. The code rides after the address's `#`, which a browser never
 * sends to a server, so no log of a request holds it.
 */
export function PhotoHandoffPage() {
  // The address's part from its # on, read once the page is in the browser
  const [hash] = useHash()

  // Whether the page has read its address yet
  const isMounted = useMounted()

  // Nothing to say before the address is read
  if (!isMounted) return null

  // The code, without its #
  const code = hash.slice(1)

  // An address carrying no code reads as one that no longer works
  if (code === '') return <DeadHandoff />

  // The code's page, starting over should the address name another
  return <CodeHandoff key={code} code={code} />
}
