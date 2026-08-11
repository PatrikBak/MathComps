/**
 * Regenerates the defense-content blobs the AI examiner is served from, from the current handout content
 * files.
 *
 * Run with: tsx scripts/generate-handout-defense-content.ts
 */

import { pathToFileURL } from 'url'

import { collectAllDefenseContentBlobs, writeDefenseContentBlobs } from './handout-defense-content'

/**
 * Collects and writes every blob, then reports how much of it there is.
 */
function generate(): void {
  // Every published handout variant that has something to defend
  const blobs = collectAllDefenseContentBlobs()

  // Replace the output directory's contents with them
  writeDefenseContentBlobs(blobs)

  // How many environments landed, across how many variants
  const environmentCount = blobs.reduce(
    (total, blob) => total + Object.keys(blob.content).length,
    0
  )

  // Report it
  console.log(
    `✅ Wrote ${environmentCount} defendable environments across ${blobs.length} handout variants`
  )
}

// Run only when this file is the process entry point, never on import (e.g. from tests)
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    generate()
  } catch (error: unknown) {
    console.error(error)
    process.exit(1)
  }
}
