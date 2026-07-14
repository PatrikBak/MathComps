'use client'

import { useDocumentVisibility, useReducedMotion } from '@mantine/hooks'
import { useInView } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { useEffect, useRef, useState } from 'react'

import { cn } from '@/components/shared/utils/css-utils'

import { figureDrawDurationMs } from './figure'
import { HERO_FIGURES, nextFigureIndex } from './figures'
import { HeroGeometryFigure } from './HeroGeometryFigure'

/**
 * Milliseconds to rest on a finished construction before the next starts drawing, on top of the
 * figure's own draw-in time.
 */
const ADMIRE_MS = 1670

/**
 * Props for the {@link HeroConstruction} component.
 */
type HeroConstructionProps = {
  /** Index of the construction shown first. */
  initialFigureIndex?: number
  /** Extra classes to size and color the figure. */
  className?: string
}

/**
 * The hero figure that quietly cycles through the constructions: each draws itself in, holds a short
 * admire beat, then the next begins, on and on while it's on screen. Clicking the figure skips to the
 * next early; hovering or keyboard-focusing it pauses the cycle and reveals the construction's name.
 * The cycle also pauses when the tab is hidden or the hero scrolls out of view, and a reduced-motion
 * preference gets a single static figure with no cycling.
 */
export function HeroConstruction({ initialFigureIndex = 0, className }: HeroConstructionProps) {
  // Hero translations
  const t = useTranslations('home.hero')
  // Localized construction names
  const tFigure = useTranslations('home.hero.figures')
  // Which construction is showing
  const [figureIndex, setFigureIndex] = useState(initialFigureIndex)
  // Whether the visitor is hovering or focusing the figure
  const [held, setHeld] = useState(false)
  // Whether the current construction has finished drawing in
  const [settled, setSettled] = useState(false)

  // The figure's button
  const containerRef = useRef<HTMLButtonElement>(null)
  // Whether the figure is in the viewport
  const inView = useInView(containerRef, { amount: 0.4 })
  // Whether the visitor asked for reduced motion
  const reducedMotion = useReducedMotion()
  // Whether the browser tab is currently foregrounded
  const documentVisibility = useDocumentVisibility()

  // A function which advances to the next construction
  const advance = () => {
    // Move to the next construction
    setFigureIndex((current) => nextFigureIndex(current, HERO_FIGURES.length))
    // Hide its name at once so it never flashes before the redraw
    setSettled(false)
  }

  // Advance to the next construction a beat after the current one finishes drawing in
  useEffect(() => {
    // Don't advance while motion is unwelcome, off-screen, in a hidden tab, or held under pointer/focus
    if (reducedMotion || !inView || documentVisibility === 'hidden' || held) return

    // Wait out this figure's own draw-in plus the admire beat before moving on
    const hold = figureDrawDurationMs(HERO_FIGURES[figureIndex].figure) + ADMIRE_MS

    // Schedule the next construction
    const timer = setTimeout(
      () => setFigureIndex((current) => nextFigureIndex(current, HERO_FIGURES.length)),
      hold
    )

    // Clear the pending advance if anything changes first
    return () => clearTimeout(timer)
  }, [figureIndex, inView, documentVisibility, reducedMotion, held])

  // Settle the construction once its draw-in finishes, so its name only shows on a finished figure
  useEffect(() => {
    // A reduced-motion figure has no draw-in, so its name is available at once
    if (reducedMotion) {
      setSettled(true)
      return
    }
    // Start this figure unsettled
    setSettled(false)
    // Settle it once its own draw-in completes
    const timer = setTimeout(
      () => setSettled(true),
      figureDrawDurationMs(HERO_FIGURES[figureIndex].figure)
    )

    // Drop the pending settle if the figure changes first
    return () => clearTimeout(timer)
  }, [figureIndex, reducedMotion])

  // The construction currently on show
  const current = HERO_FIGURES[figureIndex]

  // The figure is the whole (hidden) click target
  return (
    <button
      ref={containerRef}
      type="button"
      onClick={advance}
      onPointerEnter={() => setHeld(true)}
      onPointerLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={() => setHeld(false)}
      aria-label={t('shuffle')}
      className={cn(
        'relative block rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-4 focus-visible:ring-offset-background',
        className
      )}
    >
      {/* The key remounts the figure so the draw-in replays on every change */}
      <HeroGeometryFigure
        key={figureIndex}
        figure={current.figure}
        animated
        className="h-full w-full"
      />

      {/* Construction name */}
      <span
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-x-0 top-full -mt-3 text-center font-serif text-base italic text-brand-light/70 transition-all duration-500 ease-out motion-reduce:transition-none',
          held && settled ? 'translate-y-0 opacity-100' : 'translate-y-1 opacity-0'
        )}
      >
        {settled ? tFigure(current.name) : null}
      </span>
    </button>
  )
}
