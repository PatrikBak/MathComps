import { describe, expect, it } from 'vitest'

import {
  ACCENT_LAG_SECONDS,
  ACCENT_RADIUS,
  circle,
  defineFigure,
  DOT_RADIUS,
  figureDrawDurationMs,
  MARK_LAG_SECONDS,
  polygon,
  segment,
  segments,
  STAGGER_SECONDS,
  STROKE_DRAW_SECONDS,
  VANISH_FADE_SECONDS,
  VANISH_HOLD_SECONDS,
} from '../figure'

describe('defineFigure normalizer', () => {
  it('centers, scales, and flips y so the unit circle fills the box', () => {
    // A unit circle at the origin, a mark on top, an accent at the center
    const figure = defineFigure((scene) => {
      scene.draw(circle({ center: { x: 0, y: 0 }, r: 1 }))
      scene.draw(segment({ x: -1, y: 0 }, { x: 1, y: 0 }))
      scene.mark({ x: 0, y: 1 })
      scene.accent({ x: 0, y: 0 })
    })
    // The circle fits [-1,1]^2 into the [30,270] box
    expect(figure.elements[0]).toEqual({
      kind: 'circle',
      cx: 150,
      cy: 150,
      r: 120,
      weight: 1.5,
      delay: 0,
    })
    // The segment spans the horizontal diameter, one stagger after the circle
    expect(figure.elements[1]).toEqual({
      kind: 'path',
      d: 'M30 150 L270 150',
      weight: 1,
      delay: STAGGER_SECONDS,
    })
    // The mark projects to the top of the circle and pops a lag into its stroke
    expect(figure.elements[2]).toEqual({
      kind: 'dot',
      cx: 150,
      cy: 30,
      r: DOT_RADIUS,
      delay: STAGGER_SECONDS + MARK_LAG_SECONDS,
    })
    // The accent sits at the center, larger, and lands an accent-lag after the last stroke
    expect(figure.elements[3]).toEqual({
      kind: 'dot',
      cx: 150,
      cy: 150,
      r: ACCENT_RADIUS,
      delay: STAGGER_SECONDS + ACCENT_LAG_SECONDS,
    })
  })

  it('closes a polygon path and honors a weight override', () => {
    // A single triangle with an explicit stroke width
    const figure = defineFigure((scene) => {
      scene.draw(polygon({ x: 0, y: 1 }, { x: -1, y: -1 }, { x: 1, y: -1 }), { weight: 3 })
      scene.accent({ x: 0, y: 0 })
    })
    // The polygon becomes a closed path through its projected vertices
    expect(figure.elements[0]).toEqual({
      kind: 'path',
      d: 'M150 30 L30 270 L270 270 Z',
      weight: 3,
      delay: 0,
    })
  })

  it('draws multiple segments as one path stroke', () => {
    // Two segments in a single segments shape
    const figure = defineFigure((scene) => {
      scene.draw(
        segments(
          [
            { x: -1, y: 1 },
            { x: 1, y: -1 },
          ],
          [
            { x: -1, y: -1 },
            { x: 1, y: 1 },
          ]
        )
      )
      scene.accent({ x: 0, y: 0 })
    })
    // Both segments share one path element with two move-line subpaths
    expect(figure.elements[0]).toMatchObject({
      kind: 'path',
      d: 'M30 30 L270 270 M30 270 L270 30',
    })
  })

  it('renders no accent dot when the build sets none', () => {
    // A stroke and a mark, but no accent
    const figure = defineFigure((scene) => {
      scene.draw(circle({ center: { x: 0, y: 0 }, r: 1 }))
      scene.mark({ x: 0, y: 1 })
    })
    // Just the stroke and the plain dot
    expect(figure.elements).toHaveLength(2)
    // The dot keeps the plain mark radius
    expect(figure.elements[1]).toMatchObject({ kind: 'dot', r: DOT_RADIUS })
  })

  it('throws when the construction collapses to a single point', () => {
    // Nothing but an accent leaves the content with zero extent to fit
    expect(() =>
      defineFigure((scene) => {
        scene.accent({ x: 0, y: 0 })
      })
    ).toThrow()
  })

  it('throws when the construction is empty', () => {
    // A build that draws nothing leaves the content with no extent to fit
    expect(() => defineFigure(() => {})).toThrow()
  })
})

describe('transient strokes vanish after drawing in', () => {
  it('gives a transient stroke a vanish delay a hold after its draw-in', () => {
    // A single transient segment, drawn then dismissed
    const figure = defineFigure((scene) => {
      scene.draw(segment({ x: -1, y: 0 }, { x: 1, y: 0 }), { transient: true })
      scene.accent({ x: 0, y: 0 })
    })
    // It fades a hold after finishing its draw-in
    expect(figure.elements[0]).toMatchObject({
      kind: 'path',
      delay: 0,
      vanishDelay: STROKE_DRAW_SECONDS + VANISH_HOLD_SECONDS,
    })
  })

  it('leaves a solid stroke without a vanish delay', () => {
    // A single solid segment stays put
    const figure = defineFigure((scene) => {
      scene.draw(segment({ x: -1, y: 0 }, { x: 1, y: 0 }))
      scene.accent({ x: 0, y: 0 })
    })
    // A solid stroke carries no vanish delay
    const stroke = figure.elements[0]
    expect(stroke.kind === 'path' && stroke.vanishDelay).toBeUndefined()
  })

  it('delays the next stroke until a transient stroke begins to fade', () => {
    // A transient stroke followed by a solid one
    const figure = defineFigure((scene) => {
      scene.draw(segment({ x: -1, y: 0 }, { x: 1, y: 0 }), { transient: true })
      scene.draw(segment({ x: 0, y: -1 }, { x: 0, y: 1 }))
      scene.accent({ x: 0, y: 0 })
    })
    // The follower starts exactly when the scaffolding's fade begins
    expect(figure.elements[1]).toMatchObject({
      kind: 'path',
      delay: STROKE_DRAW_SECONDS + VANISH_HOLD_SECONDS,
    })
  })

  it('pops each mark with the stroke it follows and gives batches their own beats', () => {
    // Marks between and after two strokes
    const figure = defineFigure((scene) => {
      scene.draw(segment({ x: -1, y: 0 }, { x: 1, y: 0 }))
      scene.mark({ x: 0, y: 0 })
      scene.draw(segment({ x: 0, y: -1 }, { x: 0, y: 1 }))
      scene.mark({ x: 0, y: 1 })
      scene.accent({ x: 1, y: 0 })
    })
    // The first mark pops a lag into the first stroke
    expect(figure.elements[2]).toMatchObject({ kind: 'dot', delay: MARK_LAG_SECONDS })
    // The second stroke waits out that mark's beat (its lag, plus a stagger) before starting
    expect(figure.elements[1]).toMatchObject({
      kind: 'path',
      delay: MARK_LAG_SECONDS + STAGGER_SECONDS,
    })
    // The second mark pops a lag into that pushed-back second stroke
    expect(figure.elements[3]).toMatchObject({
      kind: 'dot',
      delay: MARK_LAG_SECONDS + STAGGER_SECONDS + MARK_LAG_SECONDS,
    })
  })

  it('staggers consecutive mark batches after the same stroke', () => {
    // Two separate mark calls riding one stroke
    const figure = defineFigure((scene) => {
      scene.draw(segment({ x: -1, y: 0 }, { x: 1, y: 0 }))
      scene.mark({ x: -1, y: 0 })
      scene.mark({ x: 1, y: 0 })
      scene.accent({ x: 0, y: 0 })
    })
    // The first batch pops a lag into the stroke, the second a stagger later
    expect(figure.elements[1]).toMatchObject({ kind: 'dot', delay: MARK_LAG_SECONDS })
    expect(figure.elements[2]).toMatchObject({
      kind: 'dot',
      delay: MARK_LAG_SECONDS + STAGGER_SECONDS,
    })
  })

  it('extends the draw duration to cover the vanish', () => {
    // A lone transient stroke governs the figure's finish
    const figure = defineFigure((scene) => {
      scene.draw(segment({ x: -1, y: 0 }, { x: 1, y: 0 }), { transient: true })
      scene.accent({ x: 0, y: 0 })
    })
    // The figure lands only once the scaffolding has fully faded
    const expectedMs = (STROKE_DRAW_SECONDS + VANISH_HOLD_SECONDS + VANISH_FADE_SECONDS) * 1000
    expect(figureDrawDurationMs(figure)).toBeCloseTo(expectedMs, 5)
  })

  it('measures to the latest-finishing element, not the last one to start', () => {
    // A solid stroke, then a mark riding it: the mark starts later but finishes first
    const figure = defineFigure((scene) => {
      scene.draw(segment({ x: -1, y: 0 }, { x: 1, y: 0 }))
      scene.mark({ x: 0, y: 0 })
    })
    // The stroke draws in past the trailing mark's fade, so its finish governs the duration
    const expectedMs = STROKE_DRAW_SECONDS * 1000
    expect(figureDrawDurationMs(figure)).toBeCloseTo(expectedMs, 5)
  })
})
