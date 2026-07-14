import React from 'react'

import { renderMathContentToHtml } from '@/components/math/utils/math-render'
import { assertNever } from '@/components/shared/utils/assert-never'

import { NEWS_ICONS } from './news-icons'
import { NewsEquationCover } from './NewsEquationCover'
import type { NewsCover } from './types'

/**
 * The shared cover background: a muted graph-paper fill with a faint grid ruling.
 */
const PAPER: React.CSSProperties = {
  backgroundColor: '#d5d2c8',
  backgroundImage:
    'linear-gradient(rgba(20,30,60,.06) 1px, transparent 1px),' +
    'linear-gradient(90deg, rgba(20,30,60,.06) 1px, transparent 1px)',
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
 * The cover art for a news card: a figure, a KaTeX expression, or a line icon on the shared
 * graph-paper background. Fills its container.
 */
export function NewsCardCover({ cover }: NewsCardCoverProps) {
  // Resolve the content per cover kind
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
      // A line icon
      const Icon = NEWS_ICONS[cover.name]
      content = <Icon strokeWidth={0.5} className="size-14 text-slate-800 md:size-20" />
      break
    }

    // A new cover kind must declare its rendering
    default:
      assertNever(cover)
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
