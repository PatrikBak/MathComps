/**
 * Reads the pixel density a PNG is stamped with, from its `pHYs` chunk.
 *
 * @param bytes - The file's bytes.
 *
 * @returns The horizontal density in dots per inch, rounded to the whole number tools stamp it as. Null for
 *   bytes that are no PNG or end too early, a PNG stamped with no density, and one whose density gives only
 *   an aspect ratio.
 */
export function readPngDpi(bytes: ArrayBuffer): number | null {
  // The eight bytes every PNG file opens with
  const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

  // The bytes, read with PNG's big-endian numbers
  const view = new DataView(bytes)

  // Whether the bytes open with the signature
  const isPng = PNG_SIGNATURE.every(
    (signatureByte, index) => index < view.byteLength && view.getUint8(index) === signatureByte
  )

  // Bytes opening with anything else are no PNG
  if (!isPng) return null

  // How a chunk is laid out, in bytes: the length of its data, its four-letter type, the data, a checksum
  const CHUNK_LENGTH_BYTES = 4
  const CHUNK_TYPE_BYTES = 4
  const CHUNK_HEADER_BYTES = CHUNK_LENGTH_BYTES + CHUNK_TYPE_BYTES
  const CHUNK_CHECKSUM_BYTES = 4

  // The chunk holding the density, and how its data is laid out: a four-byte horizontal density, a four-byte
  // vertical one, and a unit byte, which is 1 for pixels per metre and leaves only an aspect ratio otherwise
  const DENSITY_CHUNK = 'pHYs'
  const DENSITY_DATA_BYTES = 9
  const DENSITY_UNIT_OFFSET = 8
  const PIXELS_PER_METRE_UNIT = 1

  // Metres in an inch
  const METRES_PER_INCH = 0.0254

  // The chunks follow the signature, each one's header saying where the next one starts
  let chunkOffset = PNG_SIGNATURE.length

  // Every chunk whose header is all there
  while (chunkOffset + CHUNK_HEADER_BYTES <= view.byteLength) {
    // How long the chunk's data runs
    const dataLength = view.getUint32(chunkOffset)

    // The chunk's four-letter type, right after that length
    const type = String.fromCharCode(
      ...new Uint8Array(bytes, chunkOffset + CHUNK_LENGTH_BYTES, CHUNK_TYPE_BYTES)
    )

    // The density, read off the chunk holding it
    if (type === DENSITY_CHUNK) {
      // Where the chunk's data starts
      const dataOffset = chunkOffset + CHUNK_HEADER_BYTES

      // A density chunk cut short says nothing
      if (dataLength < DENSITY_DATA_BYTES || dataOffset + DENSITY_DATA_BYTES > view.byteLength) {
        return null
      }

      // The unit the densities count in
      const unit = view.getUint8(dataOffset + DENSITY_UNIT_OFFSET)

      // Densities counting anything but pixels per metre give only an aspect ratio
      if (unit !== PIXELS_PER_METRE_UNIT) return null

      // The horizontal density, in dots per inch
      return Math.round(view.getUint32(dataOffset) * METRES_PER_INCH)
    }

    // On to the chunk after this one's data and checksum
    chunkOffset += CHUNK_HEADER_BYTES + dataLength + CHUNK_CHECKSUM_BYTES
  }

  // The chunks ran out with no density among them
  return null
}

/**
 * Decodes an image to read how many pixels wide it shows, turned the way its own orientation says.
 *
 * @param image - The image's file.
 *
 * @returns The width in pixels, or null for a file the browser cannot decode as an image.
 */
export async function pixelWidthOf(image: Blob): Promise<number | null> {
  // The image decoded, where it decodes as one
  try {
    // Its pixels, turned the way it shows by default. Chrome and Edge before 112, still among the
    // browsers the app supports, throw on the imageOrientation option asking for that
    const bitmap = await createImageBitmap(image)

    // How many of them it is wide
    const { width } = bitmap

    // The pixels, let go of
    bitmap.close()

    // The width
    return width
  } catch {
    // A file that decodes as no image has no width to read
    return null
  }
}

/**
 * A size in pixels.
 */
export type PixelSize = {
  /** How many pixels across. */
  width: number
  /** How many pixels down. */
  height: number
}

/**
 * The size an image takes once its longer side is brought down to a given length, keeping its shape.
 *
 * @param size - The image's size.
 * @param longEdge - The most pixels the longer side may keep.
 *
 * @returns The smaller size, each side at least a pixel, or null for an image whose longer side already fits.
 */
export function shrunkSize(size: PixelSize, longEdge: number): PixelSize | null {
  // How far the image is scaled to bring its longer side to the edge
  const scale = longEdge / Math.max(size.width, size.height)

  // An image already within the edge keeps its size
  if (scale >= 1) return null

  // Both sides scaled alike to whole pixels, a sliver kept at least a pixel thick
  return {
    width: Math.max(1, Math.round(size.width * scale)),
    height: Math.max(1, Math.round(size.height * scale)),
  }
}

/**
 * Shrinks an image so its longer side keeps at most a given length, as a JPEG turned the way its own
 * orientation says.
 *
 * @param image - The image's file.
 * @param longEdge - The most pixels the longer side may keep.
 *
 * @returns The shrunk JPEG, or null for an image whose longer side already fits and for one the browser
 *   cannot decode or encode.
 */
export async function shrinkToLongEdge(image: Blob, longEdge: number): Promise<Blob | null> {
  // The quality the shrunk image is encoded at, from 0 to 1
  const JPEG_QUALITY = 0.9

  // The image's pixels, turned the way it shows by default (Chrome and Edge before 112 throw on the option
  // asking for that), or none for a file the browser cannot decode (HEIC outside Safari)
  const bitmap = await createImageBitmap(image).catch(() => null)

  // Nothing to shrink in a file that decodes as no image
  if (bitmap === null) return null

  // The image shrunk, its pixels let go of however that goes
  try {
    // The size its longer side brings it down to
    const size = shrunkSize(bitmap, longEdge)

    // An image already within the edge goes as it is
    if (size === null) return null

    // The canvas the shrunk image is drawn on
    const canvas = new OffscreenCanvas(size.width, size.height)

    // Its 2D drawing context
    const context = canvas.getContext('2d')

    // Nothing to draw with where the context is unavailable
    if (context === null) return null

    // A JPEG holds no transparency, so a see-through pixel lands on white like the paper, never on black
    context.fillStyle = 'white'
    context.fillRect(0, 0, size.width, size.height)

    // The image drawn at its new size, smoothed so thin pen strokes survive the shrink
    context.imageSmoothingQuality = 'high'
    context.drawImage(bitmap, 0, 0, size.width, size.height)

    // The drawing as a JPEG
    return await canvas.convertToBlob({ type: 'image/jpeg', quality: JPEG_QUALITY })
  } catch {
    // A drawing the browser fails to encode leaves no shrunk image
    return null
  } finally {
    // The decoded pixels, let go of
    bitmap.close()
  }
}
