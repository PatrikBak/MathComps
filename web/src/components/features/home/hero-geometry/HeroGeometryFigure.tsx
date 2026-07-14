import type { CSSProperties } from 'react'

import { assertNever } from '@/components/shared/utils/assert-never'

import {
  DOT_FADE_SECONDS,
  type GeometryFigure,
  type RenderElement,
  STROKE_DRAW_SECONDS,
  VANISH_FADE_SECONDS,
  VANISH_OPACITY,
} from './figure'

/**
 * Props for the {@link HeroGeometryFigure} component.
 */
type HeroGeometryFigureProps = {
  /** The normalized construction to render, already in SVG coordinates. */
  figure: GeometryFigure
  /** Extra classes to size and color the figure. */
  className?: string
  /** Draw the figure in on load with a staggered stroke animation. */
  animated?: boolean
}

/**
 * Renders a normalized geometry construction as inline SVG. Strokes use currentColor so the caller sets
 * the tone; when animated, each element draws or fades in on the delay baked into the figure.
 */
export function HeroGeometryFigure({
  figure,
  className,
  animated = false,
}: HeroGeometryFigureProps) {
  return (
    <svg
      viewBox="0 0 300 300"
      fill="none"
      stroke="currentColor"
      className={className}
      aria-hidden="true"
    >
      {/* Draw-in choreography, only emitted when animating */}
      {animated && (
        <style>{`
          @keyframes heroFigDraw {
            to { stroke-dashoffset: 0; }
          }
          @keyframes heroFigDot {
            from { opacity: 0; transform: scale(0); }
            to { opacity: 1; transform: scale(1); }
          }
          @keyframes heroFigVanish {
            to { stroke-opacity: ${VANISH_OPACITY}; }
          }

          .hero-fig-stroke {
            stroke-dasharray: 1;
            stroke-dashoffset: 1;
            animation: heroFigDraw ${STROKE_DRAW_SECONDS}s cubic-bezier(0.22, 1, 0.36, 1) forwards;
          }
          .hero-fig-stroke-vanish {
            stroke-dasharray: 1;
            stroke-dashoffset: 1;
            animation:
              heroFigDraw ${STROKE_DRAW_SECONDS}s cubic-bezier(0.22, 1, 0.36, 1) forwards,
              heroFigVanish ${VANISH_FADE_SECONDS}s ease-out forwards;
          }
          .hero-fig-dot {
            opacity: 0;
            transform-box: fill-box;
            transform-origin: center;
            animation: heroFigDot ${DOT_FADE_SECONDS}s ease-out forwards;
          }

          @media (prefers-reduced-motion: reduce) {
            .hero-fig-stroke {
              animation: none;
              stroke-dashoffset: 0;
            }
            .hero-fig-stroke-vanish {
              animation: none;
              stroke-dashoffset: 0;
              stroke-opacity: ${VANISH_OPACITY};
            }
            .hero-fig-dot {
              animation: none;
              opacity: 1;
            }
          }
        `}</style>
      )}

      {/* Each normalized element as its SVG primitive */}
      {figure.elements.map((element, index) => renderElement(element, index, animated))}
    </svg>
  )
}

/**
 * The draw-in class for a stroke element: the vanishing variant when the stroke fades to a ghost.
 *
 * @param vanishDelay - The stroke's vanish delay, or undefined when it stays solid.
 *
 * @returns The CSS class name for the stroke's animation.
 */
function strokeClassName(vanishDelay: number | undefined): string {
  // A solid stroke only draws in; a transient one also fades to its ghost
  return vanishDelay === undefined ? 'hero-fig-stroke' : 'hero-fig-stroke-vanish'
}

/**
 * The animation-delay style for a stroke: the draw-in delay, plus the vanish delay when it fades.
 *
 * @param delay - The draw-in delay in seconds.
 * @param vanishDelay - The vanish delay in seconds, or undefined when the stroke stays solid.
 *
 * @returns The style carrying the per-animation delays.
 */
function strokeDelayStyle(delay: number, vanishDelay: number | undefined): CSSProperties {
  // One delay for a solid stroke, a second for the vanish animation when transient
  return {
    animationDelay: vanishDelay === undefined ? `${delay}s` : `${delay}s, ${vanishDelay}s`,
  }
}

/**
 * Renders one normalized element as its SVG primitive: circles and paths draw in, dots fade in.
 *
 * @param element - The normalized element in SVG coordinates.
 * @param index - Position in the figure, used as the React key.
 * @param animated - Whether to attach the draw-in classes and delays.
 *
 * @returns The SVG node.
 */
function renderElement(element: RenderElement, index: number, animated: boolean) {
  switch (element.kind) {
    // A stroked circle
    case 'circle':
      return (
        <circle
          key={index}
          cx={element.cx}
          cy={element.cy}
          r={element.r}
          strokeWidth={element.weight}
          pathLength={1}
          className={animated ? strokeClassName(element.vanishDelay) : undefined}
          style={animated ? strokeDelayStyle(element.delay, element.vanishDelay) : undefined}
        />
      )
    // A stroked path
    case 'path':
      return (
        <path
          key={index}
          d={element.d}
          strokeWidth={element.weight}
          pathLength={1}
          className={animated ? strokeClassName(element.vanishDelay) : undefined}
          style={animated ? strokeDelayStyle(element.delay, element.vanishDelay) : undefined}
        />
      )
    // A filled dot
    case 'dot':
      return (
        <circle
          key={index}
          cx={element.cx}
          cy={element.cy}
          r={element.r}
          fill="currentColor"
          stroke="none"
          className={animated ? 'hero-fig-dot' : undefined}
          style={animated ? { animationDelay: `${element.delay}s` } : undefined}
        />
      )
    // A new element kind must declare its rendering
    default:
      return assertNever(element)
  }
}
