import type { Page } from '@playwright/test'

/**
 * The address's query parameters, as Playwright's own copy of the address holds them.
 *
 * @param page - The page whose URL to read.
 *
 * @returns The URL's query parameters.
 */
export function addressParams(page: Page): URLSearchParams {
  // The query half of wherever the reader currently is
  return new URL(page.url()).searchParams
}

/**
 * One query parameter of the address this instant, read off the page itself, since a step the page pushes onto
 * history reaches Playwright's own copy of the address only later.
 *
 * @param page - The page.
 * @param param - The parameter.
 *
 * @returns Its value, or null while the address has none.
 */
export function locationParam(page: Page, param: string): Promise<string | null> {
  // Read off the page's own address
  return page.evaluate((name) => new URLSearchParams(window.location.search).get(name), param)
}

/**
 * Where the address stands in Playwright's own copy of it, its path and query without the origin.
 *
 * @param page - The page.
 *
 * @returns The path and the query, the query with its question mark.
 */
export function addressOf(page: Page): string {
  // The address as Playwright's own copy holds it
  const address = new URL(page.url())

  // Everything past the origin
  return `${address.pathname}${address.search}`
}
