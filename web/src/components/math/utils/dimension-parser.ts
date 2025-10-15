/**
 * Parses CSS dimension strings (like "100px", "50pt", "2em") to numeric pixel values
 */
export function parseDimensionToPixels(dimension: string | undefined): number | undefined {
  if (!dimension || typeof dimension !== 'string') {
    return undefined
  }

  // Remove whitespace and convert to lowercase
  const cleaned = dimension.trim().toLowerCase()

  // Extract numeric value and unit
  const match = cleaned.match(/^([+-]?(?:\d+\.?\d*|\.\d+))([a-z%]*)$/)
  if (!match) {
    return undefined
  }

  const value = parseFloat(match[1])
  const unit = match[2] || 'px'

  if (isNaN(value)) {
    return undefined
  }

  // Convert different units to pixels
  // Note: Some conversions are approximate since they depend on context
  switch (unit) {
    case 'px':
      return Math.round(value)
    case 'pt':
      // 1pt = 1/72 inch, 1 inch = 96px (CSS reference)
      return Math.round(value * (96 / 72))
    case 'pc':
      // 1pc = 12pt
      return Math.round(value * 12 * (96 / 72))
    case 'in':
      // 1 inch = 96px (CSS reference)
      return Math.round(value * 96)
    case 'cm':
      // 1cm = 96px/2.54
      return Math.round(value * (96 / 2.54))
    case 'mm':
      // 1mm = 96px/25.4
      return Math.round(value * (96 / 25.4))
    case 'em':
    case 'rem':
      // Assume 16px base font size
      return Math.round(value * 16)
    case '%':
      // Can't convert percentage without context, return undefined
      return undefined
    default:
      // For unknown units, assume pixels
      return Math.round(value)
  }
}

/**
 * Parses CSS dimension strings and returns both the numeric pixel value and original string
 */
export function parseDimensions(width?: string, height?: string) {
  const widthPx = parseDimensionToPixels(width)
  const heightPx = parseDimensionToPixels(height)

  return {
    widthPx,
    heightPx,
    hasDimensions: Boolean(widthPx && heightPx),
    originalWidth: width,
    originalHeight: height,
  }
}
