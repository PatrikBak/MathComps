/**
 * Regenerates the committed `handout-env-index.json` from the current handout content files.
 *
 * Run with: tsx scripts/generate-handout-env-index.ts
 */

import fs from 'fs'
import prettier from 'prettier'
import { pathToFileURL } from 'url'

import {
  collectAllHandoutEnvironments,
  ENV_INDEX_PATH,
  toHandoutEnvIndex,
} from './handout-env-index'

/**
 * Collects, collapses, formats, and writes the index, then reports how much of it there is.
 */
async function generate(): Promise<void> {
  // Every environment on the site, collapsed into the shipped shape
  const index = toHandoutEnvIndex(collectAllHandoutEnvironments())

  // Format through prettier's own API, so the output matches what `format:check` expects
  const config = await prettier.resolveConfig(ENV_INDEX_PATH)
  const formatted = await prettier.format(JSON.stringify(index), { ...config, parser: 'json' })

  // Write the committed artifact
  fs.writeFileSync(ENV_INDEX_PATH, formatted)

  // How many environments landed, across how many handouts
  const environmentCount = Object.values(index).reduce(
    (total, handout) => total + Object.keys(handout).length,
    0
  )

  // Report it
  console.log(
    `✅ Wrote ${environmentCount} environments across ${Object.keys(index).length} handouts to handout-env-index.json`
  )
}

// Run only when this file is the process entry point, never on import (e.g. from tests)
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void generate().catch((error: unknown) => {
    console.error(error)
    process.exit(1)
  })
}
