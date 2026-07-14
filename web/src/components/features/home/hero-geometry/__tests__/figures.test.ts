import { describe, expect, it } from 'vitest'

import type { RenderElement } from '../figure'
import { eulerLineFigure, miquelFigure, ninePointFigure } from '../figures'

/** Distance a point may sit off its target circle in the projected plane, absorbing 2-decimal coordinate rounding. */
const MAX_PROJECTED_OFFSET = 0.1

/**
 * Narrows a render element to a circle.
 *
 * @param element - The element expected to be a circle.
 *
 * @returns The circle element.
 */
function asCircle(element: RenderElement | undefined) {
  // Guard the discriminator so the caller gets circle fields
  if (element?.kind !== 'circle') {
    throw new Error('expected a circle element')
  }
  return element
}

/**
 * Narrows a render element to a dot.
 *
 * @param element - The element expected to be a dot.
 *
 * @returns The dot element.
 */
function asDot(element: RenderElement | undefined) {
  // Guard the discriminator so the caller gets dot fields
  if (element?.kind !== 'dot') {
    throw new Error('expected a dot element')
  }
  return element
}

/**
 * Narrows a render element to a path and asserts it vanishes after drawing in.
 *
 * @param element - The element expected to be a transient path.
 */
function expectTransientPath(element: RenderElement | undefined): void {
  // Only path elements can be scaffolding strokes
  if (element?.kind !== 'path') {
    throw new Error('expected a path element')
  }
  // A transient stroke carries a vanish delay
  expect(element.vanishDelay).toBeGreaterThan(0)
}

describe('eulerLineFigure strings the three centers on one line', () => {
  it('draws the three scaffolding batches as transient strokes', () => {
    // The medians, altitudes and perpendicular bisectors all fade to a ghost
    expectTransientPath(eulerLineFigure.elements[1])
    expectTransientPath(eulerLineFigure.elements[2])
    expectTransientPath(eulerLineFigure.elements[3])
  })

  it('sequences each scaffolding batch after the previous fade begins', () => {
    // The first two scaffolding batches, in construction order
    const medians = eulerLineFigure.elements[1]
    const altitudes = eulerLineFigure.elements[2]
    // Both are scaffolding paths
    if (medians.kind !== 'path' || altitudes.kind !== 'path') {
      throw new Error('expected path elements')
    }
    // The altitudes start once the medians' vanish is underway
    expect(altitudes.delay).toBeGreaterThanOrEqual(medians.vanishDelay ?? Infinity)
  })

  it('gives every point equal weight, with no accent singled out', () => {
    // Every dot the figure renders — the three vertices and the three centers
    const dots = eulerLineFigure.elements.filter((element) => element.kind === 'dot')
    // An accent would be a larger dot; with none, every dot shares the one plain radius
    dots.forEach((dot) => {
      expect(dot.r).toBe(dots[0].r)
    })
  })
})

describe('ninePointFigure lands nine points on one circle', () => {
  it('draws the altitude scaffolding as a transient stroke', () => {
    // The altitudes (with their right-angle marks) fade to a ghost
    expectTransientPath(ninePointFigure.elements[1])
  })

  it('puts all nine concyclic points on the nine-point circle', () => {
    // The nine-point circle is the final stroke
    const circle = asCircle(ninePointFigure.elements[2])
    // The concyclic points are every dot after the three triangle vertices
    const dots = ninePointFigure.elements.filter((element) => element.kind === 'dot').slice(3)
    // Every one of the nine sits on the circle in the projected plane
    dots.forEach((dot) => {
      // Distance from the point to the circle's center
      const centerDist = Math.hypot(dot.cx - circle.cx, dot.cy - circle.cy)
      // It equals the radius, so the point lies on the circle
      expect(Math.abs(centerDist - circle.r)).toBeLessThan(MAX_PROJECTED_OFFSET)
    })
  })

  it('pops every point before the circle arrives', () => {
    // The circle is the payoff stroke
    const circle = asCircle(ninePointFigure.elements[2])
    // All the figure's dots: the vertices and the nine concyclic points
    const dots = ninePointFigure.elements.filter((element) => element.kind === 'dot')
    // Every point is visible before the circle starts threading them
    dots.forEach((dot) => {
      expect(dot.delay).toBeLessThan(circle.delay)
    })
  })

  it('marks the vertices plus the nine concyclic points', () => {
    // Three vertices, three side midpoints, three altitude feet, three Euler points — no accent
    const dots = ninePointFigure.elements.filter((element) => element.kind === 'dot')
    expect(dots).toHaveLength(12)
  })
})

describe('miquelFigure actually concurs', () => {
  it('keeps the concurrence after normalization to SVG coordinates', () => {
    // The three circle strokes follow the triangle in the draw order
    const circles = [
      asCircle(miquelFigure.elements[1]),
      asCircle(miquelFigure.elements[2]),
      asCircle(miquelFigure.elements[3]),
    ]
    // The Miquel point, the final accent dot
    const accent = asDot(miquelFigure.elements[miquelFigure.elements.length - 1])
    // The accent still sits on every circle in the projected plane (affine transform preserves it)
    circles.forEach((element) => {
      // Distance from the accent to this circle's center
      const centerDist = Math.hypot(accent.cx - element.cx, accent.cy - element.cy)
      // It equals the radius, so the accent lies on the circle
      expect(Math.abs(centerDist - element.r)).toBeLessThan(MAX_PROJECTED_OFFSET)
    })
  })
})
