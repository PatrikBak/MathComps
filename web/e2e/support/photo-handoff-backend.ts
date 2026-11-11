import type { Page, Route } from '@playwright/test'

import {
  defenseTargetKey,
  toSessionTarget,
} from '@/components/features/defense/model/defense-target'
import type {
  DefensePhotoHandoffCode,
  DefensePhotoHandoffPage,
  DefensePhotoHandoffPages,
  DefenseSessionTarget,
  HandoffPhotoSent,
  NamedDefenseTarget,
  NamedProposalTarget,
  PhotoHandoffCheck,
} from '@/components/features/defense/model/defense-types'
import { HOUR_MS } from '@/components/shared/utils/time-units'
import { ROUTES } from '@/i18n/i18n'

import type { Refusal } from './backend-routes'
import { BACKEND_ORIGIN, fileLinkTo, refuse } from './backend-routes'
import { pageTextOf } from './hosted-backend'

/** Where the backend points a handoff code at a problem, and checks one. */
const CHECK_PATH = '/defense/photos/handoff'

/** Where the backend reads a photo sent through a handoff code. */
const SEND_PATH = '/defense/photos/handoff/photos'

/** Where the backend hands a composer the pages waiting for its problem. */
const PAGES_PATH = '/defense/photos/handoff/pages'

/** The most pixels a photo keeps along its longer side, as the fake tells the phone. */
const PHOTO_LONG_EDGE = 2000

/** How long a code works once it is made, as the API has it. */
const CODE_LIFETIME_MS = 8 * HOUR_MS

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
 * A page as the phone sends it, read already.
 */
type SentPage = {
  /** The kept photo, which its link is made from. */
  photoId: string
  /** What the page read as. */
  text: string
  /** When the phone says the photo was taken, as an ISO 8601 instant. */
  capturedAt: string
}

/**
 * A page the phone sent that no composer has taken yet.
 */
type WaitingPage = {
  /** The key of the problem the page went to, the one the code pointed at as it was sent. */
  targetKey: string
  /** The page as a take hands it over. */
  page: DefensePhotoHandoffPage
}

/**
 * What the composer's handoff calls send.
 */
type HandoffRequestBody = {
  /** The problem the composer is on, as the API names it. */
  target: DefenseSessionTarget
}

/**
 * The backend behind a handoff code, as a test drives it.
 */
export type PhotoHandoffBackend = {
  /** Points the code at another problem, as the computer does. */
  pointAt: (target: NamedDefenseTarget) => void
  /** Makes the code stop working. */
  expire: () => void
  /** Queues a refusal for one more check, after any already queued. */
  refuseNextCheck: (refusal: Refusal) => void
  /** Queues a refusal for one more time a computer points the code, after any already queued. */
  refuseNextPoint: (refusal: Refusal) => void
  /** Queues a refusal for one more photo sent, after any already queued. */
  refuseNextSend: (refusal: Refusal) => void
  /** How many photos have been read. */
  readCount: () => number
  /** The problems a computer has pointed the code at, every ask counted, oldest first. */
  pointedTargets: () => readonly DefenseSessionTarget[]
  /** Leaves a page waiting as if the phone had sent it, for a composer on the problem the code points at. */
  sendFromPhone: (page: SentPage) => void
  /** How many times a composer has asked for its waiting pages. */
  takes: () => number
  /** Answers another page's handoff calls too, from the same code and the same waiting pages: a phone's beside the computer's. */
  answerOn: (page: Page) => Promise<void>
}

/**
 * Where the code stands as the page opens.
 */
export type PhotoHandoffOptions = {
  /** Whether the code works yet, as it does once a computer has made it. */
  isLive: boolean
  /** The pages the phone sent to the code's problem while no composer was open, oldest sent first. */
  waiting: readonly SentPage[]
}

/** A code just made, with nothing sent through it yet. */
const FRESH_CODE: PhotoHandoffOptions = { isLive: true, waiting: [] }

/**
 * The problem a composer's handoff call names.
 *
 * @param route - The call.
 *
 * @returns The problem, as the API names it.
 */
function targetNamedBy(route: Route): DefenseSessionTarget {
  // The target in the body, as the composer sends it
  const body = route.request().postDataJSON() as HandoffRequestBody

  // The problem it names
  return body.target
}

/**
 * Stands in for the handoff routes, holding one code: the phone's page checks it and sends photos through it, and
 * a computer's composer points it at its problem and takes the pages waiting there. A photo sent while the code
 * works is read to the problem the code points at when it arrives, the answer naming that problem, and waits there
 * until a composer on that problem takes it, once, as the API does it.
 *
 * @param page - The page to answer on.
 * @param code - The one code this backend made.
 * @param target - The problem the code points at first.
 * @param options - Where the code stands as the page opens.
 *
 * @returns The handle the test drives the backend with.
 */
export async function installPhotoHandoffBackend(
  page: Page,
  code: string,
  target: NamedDefenseTarget,
  options: PhotoHandoffOptions = FRESH_CODE
): Promise<PhotoHandoffBackend> {
  // The problem photos go to now
  let current = target

  // Whether the code works
  let isLive = options.isLive

  // When the code stops working, as long after now as a code made now lasts
  const expiresAt = new Date(Date.now() + CODE_LIFETIME_MS).toISOString()

  // The refusals the next checks, points and photos get, oldest first, anything after them answered
  const checkRefusals: Refusal[] = []
  const pointRefusals: Refusal[] = []
  const sendRefusals: Refusal[] = []

  // The problems a computer has pointed the code at, oldest first
  const pointed: DefenseSessionTarget[] = []

  // How many photos have been read, which names each one
  let readCount = 0

  // The pages sent that no composer has taken yet, oldest sent first
  let waiting: readonly WaitingPage[] = []

  // How many takes have reached the fake
  let takesMade = 0

  // A function which keys the problem the code points at now
  const currentKey = () => defenseTargetKey(toSessionTarget(current))

  // A function which says whether a call holds the code while it still works
  const holdsLiveCode = (route: Route) =>
    isLive && route.request().headers().authorization === `PhotoHandoff ${code}`

  /**
   * A function which leaves a page waiting for a composer on the problem the code points at now.
   *
   * @param sent - The page.
   */
  const leaveWaiting = (sent: SentPage) => {
    // Behind every page sent before it, its link made from its photo
    waiting = [
      ...waiting,
      { targetKey: currentKey(), page: { ...sent, link: fileLinkTo(sent.photoId) } },
    ]
  }

  // Whatever the phone sent before the page opened
  options.waiting.forEach(leaveWaiting)

  /**
   * A function which answers a page's handoff calls from this backend.
   *
   * @param servedPage - The page.
   */
  const answerOn = async (servedPage: Page) => {
    // A phone checking the code, and a computer pointing it, on the one route
    await servedPage.route(
      (url) => url.origin === BACKEND_ORIGIN && url.pathname === CHECK_PATH,
      async (route) => {
        // A computer pointing the code at its composer's problem, which makes the code work
        if (route.request().method() === 'POST') {
          // The problem it names
          const pointedTarget = targetNamedBy(route)

          // Kept, for the test to read back
          pointed.push(pointedTarget)

          // The next refusal the test queued for a point, if any
          const refusal = pointRefusals.shift()

          // Turned away as the test asked
          if (refusal !== undefined) return refuse(route, refusal.status, refusal.errorCode)

          // A problem other than the one this backend names is one the spec never set up
          if (defenseTargetKey(pointedTarget) !== currentKey()) {
            return refuse(route, 400, 'MalformedRequest')
          }

          // Working from now on
          isLive = true

          // The code, and when it stops working
          const made: DefensePhotoHandoffCode = { code, expiresAt }

          // Answered
          return route.fulfill({ json: made })
        }

        // A code this backend doesn't hold, or one that ran out
        if (!holdsLiveCode(route)) return refuse(route, 404, 'DefensePhotoHandoffNotFound')

        // The next refusal the test queued for a check, if any
        const refusal = checkRefusals.shift()

        // Turned away as the test asked
        if (refusal !== undefined) return refuse(route, refusal.status, refusal.errorCode)

        // Where photos go, and the size they're read at
        const check: PhotoHandoffCheck = {
          handoff: { target: current, expiresAt },
          photoLongEdge: PHOTO_LONG_EDGE,
        }

        // Answered
        await route.fulfill({ json: check })
      }
    )

    // A photo, read to the problem current as it arrives
    await servedPage.route(
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

        // The page as it read, named by its count, its text what the conversation's backend reads off a page
        const sent: SentPage = {
          photoId: `photo-${readCount}`,
          text: pageTextOf(readCount),
          capturedAt,
        }

        // Waiting for a composer on the problem it went to
        leaveWaiting(sent)

        // The reading, and the problem it went to
        const answer: HandoffPhotoSent = {
          reading: { photoId: sent.photoId, link: fileLinkTo(sent.photoId), text: sent.text },
          target: current,
        }

        // Answered as created
        await route.fulfill({ status: 201, json: answer })
      }
    )

    // A composer taking the pages waiting for its problem, each one given away as it is answered
    await servedPage.route(
      (url) => url.origin === BACKEND_ORIGIN && url.pathname === PAGES_PATH,
      async (route) => {
        // One more take
        takesMade++

        // The problem the composer is on
        const targetKey = defenseTargetKey(targetNamedBy(route))

        // Its pages, in the order they were taken on the phone
        const taken = waiting
          .filter((waitingPage) => waitingPage.targetKey === targetKey)
          .toSorted(
            (first, second) =>
              Date.parse(first.page.capturedAt) - Date.parse(second.page.capturedAt)
          )

        // Gone from those waiting, so no later take sees them again
        waiting = waiting.filter((waitingPage) => waitingPage.targetKey !== targetKey)

        // The pages, and whether more can come
        const answer: DefensePhotoHandoffPages = {
          pages: taken.map((waitingPage) => waitingPage.page),
          hasLiveCode: isLive,
        }

        // Answered
        await route.fulfill({ json: answer })
      }
    )
  }

  // Answering on the page it is installed on
  await answerOn(page)

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

  // A function which queues a refusal for the next point
  const refuseNextPoint = (refusal: Refusal) => {
    pointRefusals.push(refusal)
  }

  // A function which queues a refusal for the next photo
  const refuseNextSend = (refusal: Refusal) => {
    sendRefusals.push(refusal)
  }

  // A function which lists the problems pointed at so far
  const pointedTargets = () => pointed

  // A function which counts the photos read so far
  const countReads = () => readCount

  // A function which leaves a page waiting as if the phone had sent it
  const sendFromPhone = (sent: SentPage) => {
    // A phone sends only by a code that works
    if (!isLive) throw new Error('The phone has no working code to send by.')

    // Waiting for a composer on the code's problem
    leaveWaiting(sent)
  }

  // A function which counts the takes so far
  const takes = () => takesMade

  // The handle
  return {
    pointAt,
    expire,
    refuseNextCheck,
    refuseNextPoint,
    refuseNextSend,
    readCount: countReads,
    pointedTargets,
    sendFromPhone,
    takes,
    answerOn,
  }
}
