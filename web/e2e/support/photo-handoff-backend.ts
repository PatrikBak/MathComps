import type { Page, Route } from '@playwright/test'

import type {
  HandoffPhotoSent,
  NamedDefenseTarget,
  NamedProposalTarget,
  PhotoHandoffCheck,
} from '@/components/features/defense/model/defense-types'
import { ROUTES } from '@/i18n/i18n'

import type { Refusal } from './backend-routes'
import { BACKEND_ORIGIN, refuse } from './backend-routes'

/** Where the backend checks a handoff code. */
const CHECK_PATH = '/defense/photos/handoff'

/** Where the backend reads a photo sent through a handoff code. */
const SEND_PATH = '/defense/photos/handoff/photos'

/** The most pixels a photo keeps along its longer side, as the fake tells the phone. */
const PHOTO_LONG_EDGE = 2000

/** A code a QR carries. */
export const HANDOFF_CODE = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6'

/** The phone's page for {@link HANDOFF_CODE} in English, whose route carries no translation, the code after its `#`. */
export const HANDOFF_PAGE_PATH = `/en${ROUTES.PHOTO_HANDOFF}#${HANDOFF_CODE}`

/** A proposed problem a code points at. */
export const HANDOFF_TARGET: NamedProposalTarget = {
  kind: 'proposal',
  problemId: 'p-1',
  organizationSlug: 'olympiad',
  slug: 'p-1',
  number: 7,
  title: 'Two circles',
}

/**
 * The backend behind a phone's handoff page, as a test drives it.
 */
type PhotoHandoffBackend = {
  /** Points the code at another problem, as the computer does. */
  pointAt: (target: NamedDefenseTarget) => void
  /** Makes the code stop working. */
  expire: () => void
  /** Queues a refusal for one more check, after any already queued. */
  refuseNextCheck: (refusal: Refusal) => void
  /** Queues a refusal for one more photo sent, after any already queued. */
  refuseNextSend: (refusal: Refusal) => void
  /** How many photos have been read. */
  readCount: () => number
}

/**
 * Stands in for the handoff routes a phone's page calls, holding one code. A photo sent while the code works is
 * read to the problem the code points at when it arrives, and the answer names that problem.
 *
 * @param page - The page to answer on.
 * @param code - The one code this backend made.
 * @param target - The problem the code points at first.
 *
 * @returns The handle the test drives the backend with.
 */
export async function installPhotoHandoffBackend(
  page: Page,
  code: string,
  target: NamedDefenseTarget
): Promise<PhotoHandoffBackend> {
  // The problem photos go to now
  let current = target

  // Whether the code still works
  let isLive = true

  // The refusals the next checks and the next photos get, oldest first, anything after them answered
  const checkRefusals: Refusal[] = []
  const sendRefusals: Refusal[] = []

  // How many photos have been read, which names each one
  let readCount = 0

  // A function which says whether a call holds the code while it still works
  const holdsLiveCode = (route: Route) =>
    isLive && route.request().headers().authorization === `PhotoHandoff ${code}`

  // The check, answered with where the code sends photos now
  await page.route(
    (url) => url.origin === BACKEND_ORIGIN && url.pathname === CHECK_PATH,
    async (route) => {
      // A code this backend doesn't hold, or one that ran out
      if (!holdsLiveCode(route)) return refuse(route, 404, 'DefensePhotoHandoffNotFound')

      // The next refusal the test queued for a check, if any
      const refusal = checkRefusals.shift()

      // Turned away as the test asked
      if (refusal !== undefined) return refuse(route, refusal.status, refusal.errorCode)

      // Where photos go, and the size they're read at
      const check: PhotoHandoffCheck = {
        handoff: { target: current, expiresAt: '2099-01-01T00:00:00Z' },
        photoLongEdge: PHOTO_LONG_EDGE,
      }

      // Answered
      await route.fulfill({ json: check })
    }
  )

  // A photo, read to the problem current as it arrives
  await page.route(
    (url) => url.origin === BACKEND_ORIGIN && url.pathname === SEND_PATH,
    async (route) => {
      // A code this backend doesn't hold, or one that ran out
      if (!holdsLiveCode(route)) return refuse(route, 404, 'DefensePhotoHandoffNotFound')

      // When the photo was taken, which the real route refuses the call without
      const capturedAt = new URL(route.request().url()).searchParams.get('capturedAt') ?? ''

      // That instant, parsed
      const capturedMs = Date.parse(capturedAt)

      // Refused unless an exact ISO-8601 instant, since a date only the browser can parse is one the API refuses
      if (Number.isNaN(capturedMs) || new Date(capturedMs).toISOString() !== capturedAt) {
        return refuse(route, 400, 'MalformedRequest')
      }

      // The next refusal the test queued for a photo, if any
      const refusal = sendRefusals.shift()

      // Turned away as the test asked
      if (refusal !== undefined) return refuse(route, refusal.status, refusal.errorCode)

      // One more photo read
      readCount += 1

      // The reading, and the problem it went to
      const sent: HandoffPhotoSent = {
        reading: {
          photoId: `photo-${readCount}`,
          link: `${BACKEND_ORIGIN}/files/photo-${readCount}`,
          text: `Page ${readCount}`,
        },
        target: current,
      }

      // Answered as created
      await route.fulfill({ status: 201, json: sent })
    }
  )

  // A function which points the code at another problem
  const pointAt = (next: NamedDefenseTarget) => {
    current = next
  }

  // A function which makes the code stop working
  const expire = () => {
    isLive = false
  }

  // A function which queues a refusal for the next check
  const refuseNextCheck = (refusal: Refusal) => {
    checkRefusals.push(refusal)
  }

  // A function which queues a refusal for the next photo
  const refuseNextSend = (refusal: Refusal) => {
    sendRefusals.push(refusal)
  }

  // A function which counts the photos read so far
  const countReads = () => readCount

  // The handle
  return { pointAt, expire, refuseNextCheck, refuseNextSend, readCount: countReads }
}
