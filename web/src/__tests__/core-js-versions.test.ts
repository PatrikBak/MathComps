import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { describe, expect, it } from 'vitest'

/** The web app's folder. */
const WEB_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

/** One package as the lockfile installs it. */
type LockedPackage = {
  /** The version installed. */
  version: string
}

/** package-lock.json, cut to the packages it installs. */
type Lockfile = {
  /** Each installed package under its path in node_modules. */
  packages: Record<string, LockedPackage>
}

describe('core-js polyfills', () => {
  it('narrow against the core-js release installed, so an update leaves no new built-in out', () => {
    // The Babel config
    const babelConfig = fs.readFileSync(path.join(WEB_DIR, '.babelrc'), 'utf8')

    // The release the Babel plugin narrows core-js/stable against
    const narrowedTo = babelConfig.match(/"version": "([^"]+)"/)?.[1]

    // The lockfile
    const lockfile = fs.readFileSync(path.join(WEB_DIR, 'package-lock.json'), 'utf8')

    // Each package it installs
    const { packages } = JSON.parse(lockfile) as Lockfile

    // The installed core-js, whose modules get imported
    expect(packages['node_modules/core-js'].version).toMatch(`${narrowedTo}.`)

    // The installed core-js-compat, which lists those modules for the plugin
    expect(packages['node_modules/core-js-compat'].version).toMatch(`${narrowedTo}.`)
  })
})
