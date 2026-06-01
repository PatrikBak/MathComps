/**
 * Shared parser for image URL query parameters used by problem-content images:
 * `?width=`, `?height=`, `?inline=`, `?scale=`. Used by both the renderer
 * (best-effort, degrades gracefully) and the validator (strict, reports errors).
 *
 * Recognised params are stripped from the returned `cleanUrl`, so callers can
 * pass it directly to `next/image`.
 */

/** The set of query parameters this module recognises and consumes. */
const RECOGNIZED_PARAMS = ['width', 'height', 'inline', 'scale'] as const

/** A placeholder origin used when the input URL is relative. */
const PLACEHOLDER_BASE = 'http://__rendererplaceholder__/'

/** Bare hostname extracted from `PLACEHOLDER_BASE` for relative-URL detection. */
const PLACEHOLDER_HOST = '__rendererplaceholder__'

/** Best-effort parsed image parameter values. Errors do not block successful values. */
type ImageParams = {
  /** Intrinsic width in pixels when both width and height are present and valid */
  width?: number
  /** Intrinsic height in pixels when both width and height are present and valid */
  height?: number
  /** Whether the image should render inline with surrounding text */
  inline: boolean
  /** Zoom factor (e.g. 0.5 for ?scale=50) when present and valid */
  scale?: number
}

/** A single validation error discovered while parsing an image URL. */
type ImageParamError = {
  /** Human-readable description of what went wrong */
  message: string
}

/** Result of parsing an image URL — best-effort values, validation errors, and a cleaned URL. */
type ParsedImageUrl = {
  /** Best-effort parsed parameter values (each field independently set when valid) */
  params: ImageParams
  /** Validation errors discovered during parsing */
  errors: ImageParamError[]
  /** The original URL with all recognised parameters removed — safe to pass to `next/image` */
  cleanUrl: string
}

/**
 * Attempts to parse a URL with a placeholder base for relative URLs. Returns
 * `null` when the input is unparseable.
 *
 * @param rawUrl - The URL to parse, possibly relative.
 * @returns The parsed `URL` object, or `null` if parsing failed.
 */
function tryParseUrl(rawUrl: string): URL | null {
  try {
    return new URL(rawUrl, PLACEHOLDER_BASE)
  } catch {
    // Unparseable input
    return null
  }
}

/**
 * Reconstructs a clean URL string after recognised params have been stripped,
 * preserving whether the original URL was absolute or relative.
 *
 * @param url - The mutated `URL` object with recognised params removed.
 * @param rawUrl - The original input URL string (used to detect relative shape).
 * @returns The cleaned URL in the same shape as the input (absolute or relative).
 */
function reconstructUrl(url: URL, rawUrl: string): string {
  // If the parsed URL still uses the placeholder host, the input was relative
  if (url.hostname === PLACEHOLDER_HOST) {
    // Drop the placeholder origin and reproduce the original relative shape
    let pathname = url.pathname
    if (!rawUrl.startsWith('/') && pathname.startsWith('/')) {
      pathname = pathname.slice(1)
    }
    return pathname + url.search + url.hash
  }

  // Absolute URL — `toString()` already preserves the original scheme
  return url.toString()
}

/**
 * Parses a single URL search parameter as a positive integer. Pushes a
 * validation error to `errors` when the param is present but malformed.
 *
 * @param searchParams - The URL's search params, queried by name.
 * @param paramName - The query key to read (e.g. "width" or "height").
 * @param errors - Mutable error list — a malformed value appends one entry.
 * @returns The parsed integer when present and valid, otherwise `undefined`.
 */
function parsePositiveIntegerParam(
  searchParams: URLSearchParams,
  paramName: string,
  errors: ImageParamError[]
): number | undefined {
  // Missing param — nothing to parse, no error
  const raw = searchParams.get(paramName)
  if (raw === null) return undefined

  // Validate as a positive integer; record an error for any malformed shape
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0) {
    errors.push({
      message: `Image URL has invalid ${paramName}="${raw}" (expected a positive integer)`,
    })
    return undefined
  } else {
    return parsed
  }
}

/**
 * Parses the recognised image URL query parameters and reports validation
 * errors for malformed values, partial dimensions, and unknown params.
 *
 * @param rawUrl - The image URL (absolute or relative, with optional query string).
 * @returns Best-effort parsed values, validation errors, and the URL with recognised params removed.
 */
export function parseImageUrl(rawUrl: string): ParsedImageUrl {
  // Accumulate validation errors as we scan
  const errors: ImageParamError[] = []

  // Default-valued params (only inline is non-undefined by default)
  const params: ImageParams = { inline: false }

  // Try to parse the URL
  const url = tryParseUrl(rawUrl)

  // Unparseable input — return defaults; renderer will reject the image upstream
  if (url === null) {
    return { params, errors, cleanUrl: rawUrl }
  }

  // Detect unknown params first (typo guard, e.g. "widht=400") so a misspelled
  // key doesn't get diagnosed as a partial-dimension or missing-value error
  for (const paramName of url.searchParams.keys()) {
    if (!RECOGNIZED_PARAMS.includes(paramName as (typeof RECOGNIZED_PARAMS)[number])) {
      errors.push({ message: `Image URL has unknown parameter "${paramName}"` })
    }
  }

  // Width and height — each must be a positive integer; assigned only when valid
  params.width = parsePositiveIntegerParam(url.searchParams, 'width', errors)
  params.height = parsePositiveIntegerParam(url.searchParams, 'height', errors)

  // Partial dimensions — exactly one of width/height present is an error
  // (presence checked on the raw query, so a malformed value still counts as "present")
  const hasWidth = url.searchParams.has('width')
  const hasHeight = url.searchParams.has('height')
  if (hasWidth !== hasHeight) {
    errors.push({
      message: 'Image URL has only one of width/height — both must be specified together',
    })
  }

  // Inline param — boolean-like, only "true" or "false" accepted
  const inlineParam = url.searchParams.get('inline')
  if (inlineParam !== null) {
    if (inlineParam !== 'true' && inlineParam !== 'false') {
      errors.push({
        message: `Image URL has invalid inline="${inlineParam}" (expected "true" or "false")`,
      })
    } else {
      params.inline = inlineParam === 'true'
    }
  }

  // Scale param — positive number expressed as percent (e.g. 50 → 0.5)
  const scaleParam = url.searchParams.get('scale')
  if (scaleParam !== null) {
    const parsed = parseFloat(scaleParam)
    if (!Number.isFinite(parsed) || parsed <= 0) {
      errors.push({
        message: `Image URL has invalid scale="${scaleParam}" (expected a positive number)`,
      })
    } else {
      params.scale = parsed / 100
    }
  }

  // Strip recognised params before reconstructing — unknown params are kept verbatim
  for (const recognizedParam of RECOGNIZED_PARAMS) {
    url.searchParams.delete(recognizedParam)
  }

  // Reconstruct preserving absolute/relative shape of the input
  const cleanUrl = reconstructUrl(url, rawUrl)

  // Bundle the best-effort params, accumulated errors, and cleaned URL for the caller
  return { params, errors, cleanUrl }
}
