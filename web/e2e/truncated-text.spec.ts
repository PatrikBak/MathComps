import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import { chromium } from '@playwright/test'

import { FACET_ROW_ATTRIBUTE } from '@/components/shared/components/facets/hooks/use-facet-row-navigation'

import searchFixture from './fixtures/problem-filter-response.json'
import { filtersCopy } from './support/archive-filters'
import {
  BACKEND_ORIGIN,
  PROBLEMS_PATH,
  SEARCH_PATH,
  stubProblemSearch,
} from './support/backend-routes'
import { openFacet } from './support/facets'
import { expect, test } from './support/test'

/** The facet listing problem numbers, each a one-digit name right beside its checkbox. */
const PROBLEM_NUMBER = filtersCopy.facets.problemNumber

/** The facet listing keywords. */
const TAGS = filtersCopy.facets.tags

/** Every option's checkbox in an open facet. */
const OPTION_CHECKBOX = `input${FACET_ROW_ATTRIBUTE.anySelector}`

/** A keyword's name far too long for its facet's panel. */
const LONG_NAME =
  'Inequalities between the arithmetic, geometric and harmonic means of several variables'

/** A Retina screen's pixel density, which a page zoom multiplies. */
const RETINA_SCALE = 2

/** The base of the zoom level Chrome stores: a level of n is a zoom of this factor to the power n. */
const ZOOM_LEVEL_FACTOR = 1.2

/** Page zooms from the browser's menu at which some names that fit measure a hair past their box. */
const PAGE_ZOOMS = [90, 110, 125]

/**
 * The archive's answer to a search, its first keyword renamed to {@link LONG_NAME}.
 *
 * @returns The answer.
 */
function searchWithLongName(): typeof searchFixture {
  // A copy, leaving the fixture the other specs read as it is
  const answer = structuredClone(searchFixture)

  // The first keyword, renamed where the facets read their names from
  answer.filterResult.baseOptions.tags[0].displayName = LONG_NAME

  // The answer with the long name in it
  return answer
}

/**
 * What a test on a zoomed page is handed besides the usual.
 */
type ZoomedPageFixtures = {
  /** The zoom the whole page is shown at, in percent. */
  pageZoom: number
}

/**
 * The runner with the whole page zoomed from the browser's menu. Chrome keeps that zoom in its profile, which no
 * context option reaches, so each test's browser starts from a profile written for it. The full Chromium runs it,
 * since the headless shell leaves that zoom unread.
 */
const zoomedTest = test.extend<ZoomedPageFixtures>({
  // Shown as it is unless a test sets a zoom of its own
  pageZoom: [100, { option: true }],

  // Each test's browser, zoomed before its page opens
  context: async ({ pageZoom, baseURL, userAgent, headless }, runTest, testInfo) => {
    // The test's own profile
    const profile = testInfo.outputPath('profile')

    // The zoom as Chrome keeps it, in steps of the factor counted from 100%
    const level = Math.log(pageZoom / 100) / Math.log(ZOOM_LEVEL_FACTOR)

    // Written where Chrome reads it, under its default partition
    mkdirSync(path.join(profile, 'Default'), { recursive: true })
    writeFileSync(
      path.join(profile, 'Default', 'Preferences'),
      JSON.stringify({ partition: { default_zoom_level: { x: level } } })
    )

    // The browser, started from that profile on a Retina screen
    const context = await chromium.launchPersistentContext(profile, {
      channel: 'chromium',
      headless,
      baseURL,
      userAgent,
      deviceScaleFactor: RETINA_SCALE,
    })

    // The test runs in it
    await runTest(context)

    // And it closes after
    await context.close()
  },
})

test.describe('truncated text', () => {
  test('shows a cut-off name in full when its end is hovered', async ({ page }) => {
    // Every search answered with the archive's page, one keyword named too long for its panel
    await page.route(`${BACKEND_ORIGIN}${SEARCH_PATH}`, (route) =>
      route.fulfill({ json: searchWithLongName() })
    )

    // The archive
    await page.goto(PROBLEMS_PATH)

    // The facet listing keywords, opened
    const panel = await openFacet(page, TAGS)

    // Where the long name sits, cut off at the panel's edge
    const nameBox = (await panel.getByText(LONG_NAME, { exact: true }).boundingBox())!

    // The pointer resting on the name's end, where the ellipsis is drawn
    await page.mouse.move(nameBox.x + nameBox.width - 4, nameBox.y + nameBox.height / 2)

    // The name read in full
    await expect(page.getByRole('tooltip')).toHaveText(LONG_NAME)
  })
})

zoomedTest.describe('truncated text on a zoomed page', () => {
  for (const zoom of PAGE_ZOOMS) {
    zoomedTest.describe(`at ${zoom}%`, () => {
      zoomedTest.use({ pageZoom: zoom })

      zoomedTest('keeps the checkbox beside a name that fits clickable', async ({ page }) => {
        // Every search answered with one and the same page of the archive
        await stubProblemSearch(page, () => null)

        // The archive
        await page.goto(PROBLEMS_PATH)

        // The page at the zoom asked for, which its pixel density carries
        expect(await page.evaluate(() => window.devicePixelRatio)).toBeCloseTo(
          (RETINA_SCALE * zoom) / 100
        )

        // The facet listing problem numbers, opened
        const panel = await openFacet(page, PROBLEM_NUMBER)

        // Every option's checkbox, in turn
        for (const checkbox of await panel.locator(OPTION_CHECKBOX).all()) {
          // The checkbox clicked in its middle, landing on whatever is drawn there as a reader's click does
          await checkbox.click({ force: true })

          // Ticked
          await expect(checkbox).toBeChecked()
        }
      })
    })
  }
})
