import type { Page } from '@playwright/test'

import type { HandoutData } from '@/components/features/handouts/handout-content-types'
import {
  buildEnvironmentAnchorId,
  computeSectionMetadata,
  listDocumentEnvironments,
} from '@/components/features/handouts/handout-utils'
import digits from '@/content/handouts/digits.en.json'

import { expect, test } from './support/test'

/** The handout the links point into, a long one, so landing on any anchor in it means scrolling down to it. */
const HANDOUT_PATH = '/en/handouts/digits'

/** The document behind that page. */
const document = (digits as unknown as HandoutData).document

/**
 * How many times each link is opened. The page reveals its content on a timer racing the browser's own landing,
 * which wins now and then, so a single load proves little either way.
 */
const LOADS = 4

/** How long a target has to come to rest under the sticky header before a load is called a miss. */
const LANDING_TIMEOUT_MS = 5_000

/** How long a reloaded page is watched for moving away from the top, which covers its content being revealed. */
const RELOAD_WATCH_MS = 3_000

/** The handout's sections, in reading order. */
const sections = computeSectionMetadata(document)

/** The section in the middle of the handout. */
const middleSection = sections[Math.floor(sections.length / 2)]

/** The handout's environments, in reading order. */
const environments = listDocumentEnvironments(document)

/** The environment in the middle of the handout. */
const middleEnvironment = environments[Math.floor(environments.length / 2)]

/** A hash link into the handout, and what it points at. */
type HashLinkCase = {
  /** What kind of anchor the link names. */
  kind: string
  /** The id the link's hash names, or undefined when the handout holds no such anchor. */
  anchorId: string | undefined
}

/** One link per kind of anchor the page carries, each taken from the middle of the handout. */
const HASH_LINK_CASES: HashLinkCase[] = [
  { kind: 'section heading', anchorId: middleSection?.id },
  {
    kind: 'environment',
    anchorId: middleEnvironment && buildEnvironmentAnchorId(middleEnvironment.block.slug),
  },
]

/**
 * Waits for the anchor to come to rest where its scroll margin puts it, under the sticky header.
 *
 * @param page - The page holding the handout.
 * @param anchorId - The id of the anchor the page should land on.
 * @param message - What the wait is about, named when it times out.
 */
async function expectLandedOn(page: Page, anchorId: string, message: string): Promise<void> {
  // The target once on screen, never while React holds it in its hidden placeholder
  const target = page.locator(`#${anchorId}`).filter({ visible: true })

  // A function which measures how far the target sits from its landing spot
  const distanceFromLanding = () =>
    target.evaluate((element) =>
      Math.abs(
        element.getBoundingClientRect().top - parseFloat(getComputedStyle(element).scrollMarginTop)
      )
    )

  // Landed, within rounding
  await expect
    .poll(distanceFromLanding, { message, timeout: LANDING_TIMEOUT_MS })
    .toBeLessThanOrEqual(2)
}

test.describe('a hash link into a handout', () => {
  // One test per kind of anchor
  for (const { kind, anchorId } of HASH_LINK_CASES) {
    test(`lands on its ${kind}`, async ({ page }) => {
      // The handout has to hold such an anchor for there to be a link to it
      if (anchorId === undefined) throw new Error(`The handout holds no ${kind}`)

      // Each load is a fresh one, so the content is streamed in every time
      for (let load = 0; load < LOADS; load++) {
        // Somewhere else first, since a hash link opened on its own page is only a scroll
        await page.goto('about:blank')

        // The link, opened the way a pasted one is
        await page.goto(`${HANDOUT_PATH}#${anchorId}`)

        // On the target
        await expectLandedOn(page, anchorId, `load ${load + 1} of #${anchorId}`)
      }
    })
  }

  test('leaves a reload at the top of the page at the top', async ({ page }) => {
    // The handout has to hold a section for there to be a link to it
    if (middleSection === undefined) throw new Error('The handout holds no section')

    // The link, opened
    await page.goto(`${HANDOUT_PATH}#${middleSection.id}`)

    // On its section
    await expectLandedOn(page, middleSection.id, `the first load of #${middleSection.id}`)

    // The reader back up at the top, with the hash still in the address bar
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))

    // The same address, reloaded
    await page.reload()

    // The furthest the page moves from the top while its content is revealed, sampled every frame
    const furthestScroll = await page.evaluate(
      (watchMs) =>
        new Promise<number>((resolve) => {
          // When the watch began
          const startedAt = performance.now()

          // The furthest scroll seen since
          let furthest = window.scrollY

          // A function which samples one frame and schedules the next until the watch is over
          const sample = () => {
            // The scroll this frame
            furthest = Math.max(furthest, window.scrollY)

            // The watch over, the furthest scroll handed back
            if (performance.now() - startedAt >= watchMs) return resolve(furthest)

            // The next frame
            requestAnimationFrame(sample)
          }

          // The first frame
          sample()
        }),
      RELOAD_WATCH_MS
    )

    // Never left the top
    expect(furthestScroll).toBe(0)
  })
})
