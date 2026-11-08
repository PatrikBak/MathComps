import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { describe, expect, it } from 'vitest'

import { readPngDpi, shrunkSize } from '../image-utils'

/** The folder this test file sits in */
const TEST_DIR = path.dirname(fileURLToPath(import.meta.url))

/**
 * A macOS Retina screenshot shrunk to 4x4 by `sips`, macOS's own encoder, which keeps the screenshot's chunks
 * in the order macOS writes them: a colour profile, colour info and EXIF ahead of the density.
 */
const RETINA_SCREENSHOT = path.join(TEST_DIR, 'fixtures', 'macos-retina-screenshot.png')

/** The eight bytes every PNG file opens with */
const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

/**
 * One chunk of a PNG built for a test.
 */
type TestChunk = {
  /** The chunk's four-letter type */
  type: string
  /** The chunk's data */
  data: number[]
}

/**
 * Builds the bytes of a PNG from its chunks, each with a zeroed checksum, which the reader never checks.
 *
 * @param chunks - The chunks after the signature, in file order.
 *
 * @returns The file's bytes.
 */
function pngOf(chunks: TestChunk[]): ArrayBuffer {
  // Each chunk as its length, its type, its data and its checksum
  const chunkBytes = chunks.flatMap(({ type, data }) => [
    ...bigEndian(data.length),
    ...Array.from(type, (letter) => letter.charCodeAt(0)),
    ...data,
    ...bigEndian(0),
  ])

  // The signature, then the chunks
  return new Uint8Array([...SIGNATURE, ...chunkBytes]).buffer
}

/**
 * Writes a number as four big-endian bytes, the way PNG writes its numbers.
 *
 * @param value - The number to write.
 *
 * @returns Its four bytes, most significant first.
 */
function bigEndian(value: number): number[] {
  // The number's bytes, most significant first
  return [value >>> 24, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff]
}

/**
 * A density chunk with the same density across and down.
 *
 * @param density - The density, in the chunk's unit.
 * @param unit - The unit byte: 1 for pixels per metre, 0 for an aspect ratio alone.
 *
 * @returns The chunk.
 */
function densityChunk(density: number, unit: number): TestChunk {
  // The horizontal density, the vertical one, and the unit they count in
  return { type: 'pHYs', data: [...bigEndian(density), ...bigEndian(density), unit] }
}

/** A header chunk for a 1x1 image, as every PNG opens with */
const HEADER_CHUNK: TestChunk = {
  type: 'IHDR',
  data: [...bigEndian(1), ...bigEndian(1), 8, 6, 0, 0, 0],
}

/** A chunk of pixel data, whose bytes the reader never looks at */
const PIXEL_DATA_CHUNK: TestChunk = { type: 'IDAT', data: [0, 0, 0] }

describe('readPngDpi', () => {
  it('reads the density of a macOS screenshot, past the chunks macOS writes ahead of it', () => {
    // The screenshot's bytes
    const bytes = new Uint8Array(fs.readFileSync(RETINA_SCREENSHOT)).buffer

    // A Retina screen's density
    expect(readPngDpi(bytes)).toBe(144)
  })

  it('rounds a density stored per metre to the whole DPI it was stamped as', () => {
    // 8504 pixels per metre, which is 216.0016 to the inch
    const bytes = pngOf([HEADER_CHUNK, densityChunk(8504, 1), PIXEL_DATA_CHUNK])

    // Read as the 216 it was written from
    expect(readPngDpi(bytes)).toBe(216)
  })

  it('reads no density off a chunk giving only an aspect ratio', () => {
    // A density chunk in the unit that names no length
    const bytes = pngOf([HEADER_CHUNK, densityChunk(5669, 0), PIXEL_DATA_CHUNK])

    // Nothing to read a DPI off
    expect(readPngDpi(bytes)).toBeNull()
  })

  it('reads no density off a PNG stamped with none', () => {
    // A header, the pixel data and the end, with no density among them
    const bytes = pngOf([HEADER_CHUNK, PIXEL_DATA_CHUNK, { type: 'IEND', data: [] }])

    // Nothing stamped
    expect(readPngDpi(bytes)).toBeNull()
  })

  it('reads no density off bytes that end before their chunks do', () => {
    // A bare signature
    const bareSignature = new Uint8Array(SIGNATURE).buffer

    // A density chunk cut off halfway through its data
    const cutShort = pngOf([HEADER_CHUNK, densityChunk(5669, 1)]).slice(0, -8)

    // The bare signature read as no density, with nothing thrown
    expect(readPngDpi(bareSignature)).toBeNull()

    // And the chunk cut short read the same way
    expect(readPngDpi(cutShort)).toBeNull()
  })
})

describe('shrunkSize', () => {
  it('brings a landscape photo down to the edge across, keeping its shape', () => {
    // A 48 MP phone photo held sideways
    expect(shrunkSize({ width: 8000, height: 6000 }, 2000)).toEqual({ width: 2000, height: 1500 })
  })

  it('brings a portrait photo down to the edge along its height', () => {
    // The same photo held upright
    expect(shrunkSize({ width: 6000, height: 8000 }, 2000)).toEqual({ width: 1500, height: 2000 })
  })

  it('leaves an image whose longer side already fits, at the edge exactly or under it', () => {
    // At the edge
    expect(shrunkSize({ width: 2000, height: 1200 }, 2000)).toBeNull()

    // Under it
    expect(shrunkSize({ width: 800, height: 600 }, 2000)).toBeNull()
  })
})
