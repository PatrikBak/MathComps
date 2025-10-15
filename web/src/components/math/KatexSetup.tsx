'use client'

import { useEffect } from 'react'

// Initializes KaTeX's copy-tex plugin on the client so users can copy LaTeX source from rendered math.

export default function KatexSetup() {
  useEffect(() => {
    async function enableCopyTex() {
      try {
        if (typeof window === 'undefined') return
        // Load the KaTeX copy-tex plugin (no CSS since 0.16+)
        await import('katex/dist/contrib/copy-tex.min.js')
      } catch (error) {
        // Non-fatal: math still renders without copy-tex
        // Useful during development if the import path changes
        console.warn('KaTeX copy-tex failed to load:', error)
      }
    }

    enableCopyTex()
    return () => {}
  }, [])

  return null
}
