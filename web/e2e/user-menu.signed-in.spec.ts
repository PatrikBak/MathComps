import type { Organization } from '@/components/features/problem-selection/model/selection-types'
import { ROUTES } from '@/i18n/i18n'

import messages from '../messages/en.json'
import { stubOwnOrganizations } from './support/backend-routes'
import { selectionPath } from './support/competitions'
import { openUserMenu } from './support/interaction'
import { expect, test } from './support/test'

/** How long the page has to settle before a wait is called a failure. */
const SETTLE_TIMEOUT_MS = 15_000

/** A page with nothing on it but the header, in English. */
const ABOUT_PATH = `/en${ROUTES.ABOUT}`

/** What the problem selection is called, which heads its items in the menu. */
const SELECTION_TITLE = messages.pages.problemSelection.title

/** The organizations of a reader on two lists, in the order the API answers with, which is by name. */
const TWO_ORGANIZATIONS: Organization[] = [
  { slug: 'duogeo', name: 'DuoGeo' },
  { slug: 'mathcomps', name: 'MathComps' },
]

test.describe("the user menu's problem selections", () => {
  test('offers a member each selection they are on, in the order the organizations come', async ({
    page,
  }) => {
    // A reader on two organizations' lists
    await stubOwnOrganizations(page, TWO_ORGANIZATIONS)

    // Any page
    await page.goto(ABOUT_PATH)

    // The menu open
    await openUserMenu(page)

    // The selections under their heading
    const items = page.getByRole('group', { name: SELECTION_TITLE }).getByRole('menuitem')

    // One per organization, named by it in the order served
    await expect(items).toHaveCount(TWO_ORGANIZATIONS.length)
    await expect(items.nth(0)).toHaveAccessibleName('DuoGeo')
    await expect(items.nth(1)).toHaveAccessibleName('MathComps')

    // Each opening that organization's selection
    await expect(items.nth(0)).toHaveAttribute('href', selectionPath('duogeo'))
    await expect(items.nth(1)).toHaveAttribute('href', selectionPath('mathcomps'))
  })

  test('offers a reader on no list no selection', async ({ page }) => {
    // A reader on no list
    const lookups = await stubOwnOrganizations(page, [])

    // Any page
    await page.goto(ABOUT_PATH)

    // Asked for with the page, before the menu opens
    await expect.poll(lookups, { timeout: SETTLE_TIMEOUT_MS }).toBeGreaterThan(0)

    // The menu open
    await openUserMenu(page)

    // Its own items drawn
    await expect(page.getByRole('menuitem', { name: messages.common.profile })).toBeVisible()

    // No selection heading among them
    await expect(page.getByRole('group', { name: SELECTION_TITLE })).toHaveCount(0)
  })

  test('offers a member their selections in the mobile drawer too', async ({ page }) => {
    // A phone's width, where the header folds its menu into a drawer
    await page.setViewportSize({ width: 390, height: 844 })

    // A reader on two organizations' lists
    await stubOwnOrganizations(page, TWO_ORGANIZATIONS)

    // Any page
    await page.goto(ABOUT_PATH)

    // The drawer open
    await page.getByRole('button', { name: messages.navigation.menuOpen }).click()

    // The selections under their heading
    const links = page.getByRole('group', { name: SELECTION_TITLE }).getByRole('link')

    // One per organization, named by it in the order served
    await expect(links).toHaveCount(TWO_ORGANIZATIONS.length, { timeout: SETTLE_TIMEOUT_MS })
    await expect(links.nth(0)).toHaveAccessibleName('DuoGeo')
    await expect(links.nth(1)).toHaveAccessibleName('MathComps')

    // Each opening that organization's selection
    await expect(links.nth(0)).toHaveAttribute('href', selectionPath('duogeo'))
    await expect(links.nth(1)).toHaveAttribute('href', selectionPath('mathcomps'))
  })
})
