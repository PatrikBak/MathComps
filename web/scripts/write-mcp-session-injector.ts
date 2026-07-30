import type { BrowserContext } from '@playwright/test'
import fs from 'fs'
import path from 'path'

import { storageStatePath } from '../playwright.config'

/** A signed-in browser's cookies and per-origin local storage, as Playwright serialises them. */
type StorageState = Awaited<ReturnType<BrowserContext['storageState']>>

// The MCP server only loads snippets from inside the repo, and this directory is git-ignored.
const injectorPath = path.join('..', '.playwright-mcp', 'inject-session.mjs')

/**
 * Builds the Playwright snippet that replays a saved session into a live browser context.
 *
 * @param state - The storage state captured by the sign-in run.
 *
 * @returns The snippet's source.
 */
function buildInjector(state: StorageState): string {
  return `async (page) => {
  const cookies = ${JSON.stringify(state.cookies)}
  const origins = ${JSON.stringify(state.origins)}

  await page.context().addCookies(cookies)

  for (const origin of origins) {
    await page.goto(origin.origin)
    await page.evaluate((entries) => {
      for (const entry of entries) localStorage.setItem(entry.name, entry.value)
    }, origin.localStorage)
  }

  return { cookies: cookies.length, origins: origins.map((origin) => origin.origin) }
}
`
}

// The sign-in run has to have happened first, and saying so beats an ENOENT.
if (!fs.existsSync(storageStatePath)) {
  throw new Error(`No session at ${storageStatePath}. Run \`npx playwright test\` first.`)
}

// Read back what the sign-in run captured.
const state = JSON.parse(fs.readFileSync(storageStatePath, 'utf8')) as StorageState

// The MCP directory is only there once something has written to it.
fs.mkdirSync(path.dirname(injectorPath), { recursive: true })

// Park the snippet where the MCP server can load it by filename.
fs.writeFileSync(injectorPath, buildInjector(state))

// Say where it went and what it carries, so a stale session is recognisable.
console.log(`Wrote ${path.resolve(injectorPath)}`)
console.log(`${state.cookies.length} cookies, ${state.origins.length} origin(s)`)
