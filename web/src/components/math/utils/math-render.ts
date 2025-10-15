import katex from 'katex'

/**
 * Renders a string containing inline ($...$) and display ($$...$$) LaTeX to HTML using KaTeX.
 *
 * - Inline math is rendered with displayMode=false
 * - Display math is rendered with displayMode=true
 * - Plain text is HTML-escaped to avoid XSS
 */
export function renderMathContentToHtml(content: string): string {
  if (!content || typeof content !== 'string') {
    return ''
  }

  try {
    const regex = /(\$\$[\s\S]*?\$\$|\$[^$\n]*?\$)/g
    const parts = content.split(regex)

    const escapeHtml = (text: string) =>
      text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')

    const options: katex.KatexOptions = {
      throwOnError: false,
      displayMode: false,
      strict: 'warn',
      trust: false,
      output: 'htmlAndMathml',
      macros: {},
    }

    const rendered: string[] = []
    for (const part of parts) {
      if (!part) continue
      const isDisplay = part.startsWith('$$') && part.endsWith('$$')
      const isInline = !isDisplay && part.startsWith('$') && part.endsWith('$')
      if (isDisplay) {
        const body = part.slice(2, -2).trim()
        try {
          rendered.push(katex.renderToString(body, { ...options, displayMode: true }))
        } catch (error) {
          console.warn('KaTeX display math rendering error:', error)
          rendered.push(escapeHtml(part))
        }
      } else if (isInline) {
        const body = part.slice(1, -1)
        try {
          rendered.push(katex.renderToString(body, options))
        } catch (error) {
          console.warn('KaTeX inline math rendering error:', error)
          rendered.push(escapeHtml(part))
        }
      } else {
        rendered.push(escapeHtml(part))
      }
    }

    return rendered.join('')
  } catch (error) {
    console.error('Math rendering error:', error)
    return content // Return original content if rendering fails
  }
}
