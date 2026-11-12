import type { HandoutData } from '@/components/features/handouts/handout-content-types'
import type {
  HandoutEnvIndex,
  HandoutIndex,
} from '@/components/features/handouts/handout-metadata-types'
import {
  buildEnvironmentAnchorId,
  computeSectionMetadata,
} from '@/components/features/handouts/handout-utils'
import { RETURN_URL_PARAM } from '@/constants/auth-constants'
import envIndex from '@/content/handout-env-index.json'
import handoutIndex from '@/content/handouts.json'
import digitsInEnglish from '@/content/handouts/digits.en.json'

import { addressParams } from './support/address'
import { headerSignInLink, switchLanguage } from './support/interaction'
import { expect, SETTLE_TIMEOUT_MS, test } from './support/test'

/** The handout the page is opened on, whose slug is worded differently in every language. */
const handout = (handoutIndex as unknown as HandoutIndex).sections
  .flatMap((section) => section.handouts)
  .find((candidate) => candidate.slug.en === 'digits')

/** A problem of that handout which English and Slovak both name, by those names. */
const problem = Object.values((envIndex as unknown as HandoutEnvIndex)[handout?.id ?? ''] ?? {})
  .map((placement) => placement.slug)
  .find((slugs) => slugs.en !== undefined && slugs.sk !== undefined)

/** A section heading of the English handout past its first, which its translations title differently. */
const heading = computeSectionMetadata((digitsInEnglish as unknown as HandoutData).document)[1]

/** A query giving one key twice, and a fragment naming nothing on the page. */
const QUERY_AND_HASH = '?probe=1&probe=2#kept'

test.describe("the address's fragment", () => {
  test('survives a switch to another language', async ({ page }) => {
    // The English about page, its address carrying a query and a fragment
    await page.goto(`/en/about${QUERY_AND_HASH}`)

    // Switch to Slovak
    await switchLanguage(page, 'sk')

    // The Slovak about page, with the query and the fragment still on it
    await expect(page).toHaveURL(`/sk/o-projekte${QUERY_AND_HASH}`)
  })

  test('names one of the site anchors the way the new language does', async ({ page }) => {
    // The English about page, opened at its author
    await page.goto('/en/about#aboutAuthor')

    // Switch to Slovak
    await switchLanguage(page, 'sk')

    // The Slovak about page at its author, under its Slovak name
    await expect(page).toHaveURL('/sk/o-projekte#oAutorovi')

    // The author section, on screen
    await expect(page.locator('#oAutorovi')).toBeInViewport()
  })

  test("names a handout's problem the way the new language does", async ({ page }) => {
    // The content has to hold the handout and a problem both languages name
    if (handout === undefined || problem?.en === undefined || problem.sk === undefined) {
      throw new Error('No digits handout with a problem named in English and Slovak')
    }

    // The English handout, opened at the problem
    await page.goto(`/en/handouts/${handout.slug.en}#${buildEnvironmentAnchorId(problem.en)}`)

    // Switch to Slovak
    await switchLanguage(page, 'sk')

    // The Slovak handout at the same problem, under its Slovak name
    await expect(page).toHaveURL(
      `/sk/materialy/${handout.slug.sk}#${buildEnvironmentAnchorId(problem.sk)}`
    )

    // The problem, on screen
    await expect(page.locator(`#${buildEnvironmentAnchorId(problem.sk)}`)).toBeInViewport()
  })

  test("drops a handout's section heading, which the new language titles differently", async ({
    page,
  }) => {
    // The content has to hold the handout and a heading past the first
    if (handout === undefined || heading === undefined) {
      throw new Error('No digits handout with a second section')
    }

    // The English handout, opened at the heading
    await page.goto(`/en/handouts/${handout.slug.en}#${heading.id}`)

    // Switch to Slovak
    await switchLanguage(page, 'sk')

    // The Slovak handout with no fragment at all
    await expect(page).toHaveURL(`/sk/materialy/${handout.slug.sk}`)
  })

  test('survives a trip through the header sign-in link', async ({ page }) => {
    // The content has to hold the handout for there to be a page to open
    if (handout === undefined) throw new Error('No handout has the English slug digits')

    // The English handout's address, carrying a query and a fragment
    const address = `/en/handouts/${handout.slug.en}${QUERY_AND_HASH}`

    // The handout, opened
    await page.goto(address)

    // Sign in from the header
    await headerSignInLink(page).click()

    // The login page, coming back to the handout with the query and the fragment
    await expect
      .poll(() => addressParams(page).get(RETURN_URL_PARAM), { timeout: SETTLE_TIMEOUT_MS })
      .toBe(address)
  })
})
