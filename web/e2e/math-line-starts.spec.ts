import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

import { ROUTES } from '@/i18n/i18n'

import { findBadLineStarts } from './support/line-starts'

/**
 * The widths every handout is audited at. Below 640px `.math-inline` becomes an
 * `inline-flex` box, and that is what lets a line break land between a formula and
 * the punctuation after it, so the phone width is the one that catches an orphan.
 * The desktop width covers the plain inline layout the same prose gets above 640px.
 */
const AUDIT_VIEWPORTS = [
  { width: 380, height: 900 },
  { width: 1200, height: 900 },
]

/** How long a page of KaTeX needs before its formulas have their final size. */
const RENDER_TIMEOUT_MS = 15_000

/** Walking every handout takes far longer than one page of assertions. */
const WALK_TIMEOUT_MS = 240_000

/** The blocks a handout renders its prose in. */
const PROSE_BLOCKS = 'main p, main li'

/**
 * Audits a page's prose at every width it is read at. Hints, answers, proofs and
 * solutions sit in collapsed disclosures, which is where the densest prose lives,
 * so they are opened first.
 *
 * @param page The page to audit, already showing the prose.
 * @param label A name for the page, so a failure says where it happened.
 */
async function expectCleanLineStarts(page: Page, label: string): Promise<void> {
  // Open every disclosure, since collapsed prose is never laid out
  await page
    .locator('main details')
    .evaluateAll((panels) =>
      panels.forEach((panel) => (panel as HTMLDetailsElement).setAttribute('open', ''))
    )

  // The same prose wraps in different places at every width it is read at
  for (const viewport of AUDIT_VIEWPORTS) {
    // Re-lay the page out at this width
    await page.setViewportSize(viewport)

    // Measure where every line of prose begins
    const offenders = await findBadLineStarts(page, PROSE_BLOCKS)

    // Nothing in the prose may open a line
    expect(offenders, `${label} at ${viewport.width}px`).toEqual([])
  }
}

test.describe('handout prose', () => {
  test.use({ viewport: AUDIT_VIEWPORTS[0] })

  test('never opens a line with a stray character', async ({ page }) => {
    test.setTimeout(WALK_TIMEOUT_MS)

    // The index lists every handout, and each row links by the internal route,
    // which the SK reader reaches through a redirect.
    await page.goto(`/sk${ROUTES.HANDOUTS}`)
    const rows = page.locator(`a[href*="${ROUTES.HANDOUTS}/"]`)
    await expect(rows.first()).toBeVisible({ timeout: RENDER_TIMEOUT_MS })
    // The path each row links to
    const handoutPaths = await rows.evaluateAll((links) =>
      links.map((link) => link.getAttribute('href') ?? '')
    )

    // Every handout is worth walking: which formula falls at a line end is a
    // property of the prose, so one handout proves very little.
    for (const handoutPath of handoutPaths) {
      // Open the handout
      await page.goto(handoutPath)

      // The prose only settles once KaTeX has laid every formula out
      await expect(page.locator(PROSE_BLOCKS).first()).toBeVisible({ timeout: RENDER_TIMEOUT_MS })
      await expect(page.locator('.katex').first()).toBeAttached({ timeout: RENDER_TIMEOUT_MS })

      // Audit the handout at every width
      await expectCleanLineStarts(page, handoutPath)
    }
  })
})
