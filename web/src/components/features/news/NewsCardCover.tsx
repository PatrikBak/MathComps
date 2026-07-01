import React from 'react'

import { renderMathContentToHtml } from '@/components/math/utils/math-render'

import { NEWS_ICONS } from './news-icons'
import { NewsEquationCover } from './NewsEquationCover'
import type { NewsCover } from './types'

/**
 * The shared cover surface: cream graph paper with faint ruling, echoing the
 * printed handouts. Every cover — figure, equation, or icon — sits on this in
 * dark "ink", so they read as the same kind of object: a notebook clipping.
 */
const PAPER: React.CSSProperties = {
  backgroundColor: '#f4efe2',
  backgroundImage:
    'linear-gradient(rgba(20,30,60,.07) 1px, transparent 1px),' +
    'linear-gradient(90deg, rgba(20,30,60,.07) 1px, transparent 1px)',
  backgroundSize: '18px 18px',
}

/**
 * Props for the {@link NewsCardCover} component.
 */
type NewsCardCoverProps = {
  /** The cover to render. */
  cover: NewsCover
}

/**
 * The cover art for a news card. One material (cream paper), varied content:
 * a hand-drawn handout figure, a KaTeX expression, or a line icon — all in dark
 * ink. Fills its container, which sizes it (a left panel on desktop, a banner on mobile).
 */
export function NewsCardCover({ cover }: NewsCardCoverProps) {
  // Resolve the content per cover kind; the cream-paper frame below is shared by every kind
  let content: React.ReactNode
  switch (cover.kind) {
    case 'figure':
      content = (
        // The figure illustrates the article whose title sits right beside it, so it's decorative
        // eslint-disable-next-line @next/next/no-img-element -- raw SVG line art, no optimization wanted
        <img src={cover.src} alt="" loading="lazy" className="max-h-full max-w-[86%]" />
      )
      break

    case 'equation': {
      // Reuse the app's KaTeX renderer; inline \displaystyle gives an intrinsic-width
      // expression that the cover can measure and scale down to fit the panel
      const html = renderMathContentToHtml(`$\\displaystyle ${cover.latex}$`)
      content = <NewsEquationCover html={html} />
      break
    }

    case 'icon': {
      // A line icon, drawn in the same dark ink as the figures
      const Icon = NEWS_ICONS[cover.name]
      content = <Icon size={84} strokeWidth={0.5} className="text-slate-800" />
      break
    }
  }

  return (
    <div
      className="flex h-full w-full items-center justify-center p-4 text-slate-800"
      style={PAPER}
    >
      {content}
    </div>
  )
}
