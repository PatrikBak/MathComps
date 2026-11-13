import { switchLanguage } from './support/interaction'
import { expect, test } from './support/test'

test.describe('the language switch', () => {
  test('remembers the new language before it asks for the page in it', async ({ page }) => {
    // The English about page
    await page.goto('/en/about')

    // The first request the switch sends for the Slovak about page
    const request = page.waitForRequest(
      (candidate) => new URL(candidate.url()).pathname === '/sk/o-projekte'
    )

    // Switch to Slovak
    await switchLanguage(page, 'sk')

    // The cookies the switch's request for the Slovak page carried
    const cookies = await (await request).headerValue('cookie')

    // The language cookie names Slovak already, so it holds when Next serves the page from its cache
    expect(cookies).toContain('NEXT_LOCALE=sk')
  })
})
