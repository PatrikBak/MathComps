import type { Page } from '@playwright/test'

import { ROUTES } from '@/i18n/i18n'

import { expect, test } from './support/test'

/**
 * The handouts page in English, whose outro opens the contact modal with a reason already picked. The
 * locale is fixed here because it picks the messages the assertions match on.
 */
const HANDOUTS_PATH = `/en${ROUTES.HANDOUTS}`

/** Where the app's own route takes a contact message. */
const CONTACT_PATH = '**/api/contact'

/** The copy the modal and its outcomes read in. */
const copy = {
  /** The link in the handouts outro that opens the modal. */
  open: 'send feedback',
  /** The submit button. */
  send: 'Send message',
  /** What a send that worked says. */
  sent: "Message sent successfully! We'll get back to you soon.",
  /** What a refusal with no code of its own says. */
  failed: 'Failed to send message',
  /** What a message that never reached the server says. */
  failedRetry: 'Failed to send message. Please try again later.',
  /** The `SERVER_ERROR` code's central copy. */
  serverError: 'Server error',
} as const

/**
 * Opens the contact modal and fills it with a message ready to send.
 *
 * @param page - The page it is opened on.
 */
async function openAndFillForm(page: Page) {
  // The handouts page, whose outro carries the link
  await page.goto(HANDOUTS_PATH)

  // Open the modal, which arrives with its reason already picked
  await page.getByRole('button', { name: copy.open }).click()

  // The form, filled with something that passes its own validation
  await page.getByLabel('Name').fill('Test Reader')
  await page.getByLabel('Email').fill('reader@example.com')
  await page.getByLabel('Message').fill('Something worth at least ten characters.')
}

/**
 * Answers the contact route with a refusal.
 *
 * @param page - The page the call is made from.
 * @param status - The status to refuse with.
 * @param body - The body it carries.
 */
async function refuseSend(page: Page, status: number, body: object) {
  // Stand in for the route, which never gets as far as sending anything
  await page.route(CONTACT_PATH, (route) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
  )
}

test.describe('sending a contact message', () => {
  test('closes the modal on a send that worked', async ({ page }) => {
    // The route answering the way it does when the mail went out
    await page.route(CONTACT_PATH, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Email sent successfully', emailId: 'test' }),
      })
    )

    // A filled form
    await openAndFillForm(page)

    // Sent
    await page.getByRole('button', { name: copy.send }).click()

    // The reader is told it worked
    await expect(page.getByText(copy.sent)).toBeVisible()

    // And the modal is gone
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })

  test('shows the coded copy when the route names what it refused on', async ({ page }) => {
    // The route refusing with the code its email step raises
    await refuseSend(page, 502, { errorCode: 'SERVER_ERROR' })

    // A filled form
    await openAndFillForm(page)

    // Sent
    await page.getByRole('button', { name: copy.send }).click()

    // The code's own central copy, which only reaches the reader if the code survived the call
    await expect(page.getByText(copy.serverError)).toBeVisible()

    // And the modal stays open so they can try again
    await expect(page.getByRole('dialog')).toHaveCount(1)
  })

  test('falls back to the generic copy when a refusal carries no code', async ({ page }) => {
    // A refusal with nothing in it to name
    await refuseSend(page, 500, {})

    // A filled form
    await openAndFillForm(page)

    // Sent
    await page.getByRole('button', { name: copy.send }).click()

    // The modal's own fallback, since there was no code to resolve
    await expect(page.getByText(copy.failed, { exact: true })).toBeVisible()
  })

  test('asks a message that never reached the server to be tried again later', async ({ page }) => {
    // The route dropped, which is what being offline looks like from the browser
    await page.route(CONTACT_PATH, (route) => route.abort('connectionrefused'))

    // A filled form
    await openAndFillForm(page)

    // Sent
    await page.getByRole('button', { name: copy.send }).click()

    // This case reads differently from a refusal, and telling them apart is what the missing status
    // is for: a refusal carries one, a call that never arrived does not
    await expect(page.getByText(copy.failedRetry)).toBeVisible()
  })
})
