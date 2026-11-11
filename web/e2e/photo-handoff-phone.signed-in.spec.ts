import {
  HANDOFF_CODE,
  HANDOFF_PAGE_PATH,
  HANDOFF_TARGET,
  installPhotoHandoffBackend,
} from './support/photo-handoff-backend'
import { expect, SETTLE_TIMEOUT_MS, test } from './support/test'

test('a phone signed in to an account still sends the code, not its session, as the credential', async ({
  page,
}) => {
  // A code the backend accepts only as the call's authorization, under the handoff's own scheme
  await installPhotoHandoffBackend(page, HANDOFF_CODE, HANDOFF_TARGET)

  // Opened from the QR on a phone whose browser is signed in
  await page.goto(HANDOFF_PAGE_PATH)

  // The code got through, so the top names the problem
  await expect(page.getByRole('heading', { level: 1 })).toContainText(HANDOFF_TARGET.title, {
    timeout: SETTLE_TIMEOUT_MS,
  })
})
