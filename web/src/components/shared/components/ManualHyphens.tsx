import React from 'react'

import { parseTexHyphens } from '@/components/shared/utils/string-utils'

/**
 * Wraps text with manual hyphenation control.
 * Use this component to specify exact hyphenation points using TeX-style syntax
 * while allowing the rest of the page to use automatic hyphenation.
 *
 * This disables automatic hyphenation for the wrapped text so that only
 * explicit soft hyphens will cause line breaks.
 *
 * @param text - Text with TeX-style hyphenation marks (\-)
 * @returns A span with manual hyphenation enabled
 *
 * @example
 * <ManualHyphens text="kľú\-čo\-vých" />
 *
 * @example
 * <p>
 *   Text with <ManualHyphens text="kľú\-čo\-vých" /> word.
 * </p>
 */
export function ManualHyphens({ text }: { text: string }) {
  return <span className="hyphens-manual">{parseTexHyphens(text)}</span>
}
