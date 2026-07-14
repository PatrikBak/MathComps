import { describe, expect, it } from 'vitest'

import {
  centroid,
  circleIntersections,
  circleThrough,
  dist,
  foot,
  lerp,
  midpoint,
  onUnitCircle,
  orthocenter,
  otherIntersection,
  pointToward,
} from '../geometry'

describe('onUnitCircle', () => {
  it('maps cardinal angles to the expected unit-circle points', () => {
    // East, north, west, south on the unit circle
    expect(onUnitCircle(0)).toMatchObject({ x: expect.closeTo(1, 12), y: expect.closeTo(0, 12) })
    expect(onUnitCircle(90)).toMatchObject({ x: expect.closeTo(0, 12), y: expect.closeTo(1, 12) })
    expect(onUnitCircle(180)).toMatchObject({ x: expect.closeTo(-1, 12), y: expect.closeTo(0, 12) })
    expect(onUnitCircle(270)).toMatchObject({ x: expect.closeTo(0, 12), y: expect.closeTo(-1, 12) })
  })
})

describe('midpoint', () => {
  it('returns the point halfway between two points', () => {
    // Halfway between two arbitrary points
    expect(midpoint({ x: -2, y: 4 }, { x: 6, y: -2 })).toEqual({ x: 2, y: 1 })
  })
})

describe('lerp', () => {
  it('returns the endpoints at t=0 and t=1', () => {
    // Fixed endpoints to interpolate between
    const p = { x: 0, y: 0 }
    const q = { x: 10, y: 4 }
    // t=0 lands on p, t=1 lands on q
    expect(lerp(p, q, 0)).toEqual(p)
    expect(lerp(p, q, 1)).toEqual(q)
  })

  it('interpolates linearly for fractional t', () => {
    // A quarter of the way from p to q
    expect(lerp({ x: 0, y: 0 }, { x: 8, y: 4 }, 0.25)).toEqual({ x: 2, y: 1 })
  })
})

describe('centroid', () => {
  it('averages the three vertices', () => {
    // Centroid of a simple right triangle
    expect(centroid({ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 0, y: 3 })).toEqual({ x: 1, y: 1 })
  })
})

describe('circleThrough', () => {
  it('recovers the unit circle from three unit-circle points', () => {
    // Three well-spread points on the unit circle
    const result = circleThrough(onUnitCircle(90), onUnitCircle(200), onUnitCircle(350))
    // The circumcircle is the unit circle itself
    expect(result.center.x).toBeCloseTo(0, 10)
    expect(result.center.y).toBeCloseTo(0, 10)
    expect(result.r).toBeCloseTo(1, 10)
  })

  it('throws on collinear points', () => {
    // Three points on a horizontal line have no circumcircle
    expect(() => circleThrough({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 })).toThrow()
  })
})

describe('circleIntersections', () => {
  it('returns two points that lie on both circles', () => {
    // Two overlapping unit circles offset along x
    const c1 = { center: { x: 0, y: 0 }, r: 1 }
    const c2 = { center: { x: 1, y: 0 }, r: 1 }
    // Cross the two circles
    const points = circleIntersections(c1, c2)
    // Both crossings exist
    expect(points).toHaveLength(2)
    // Each crossing sits on both circles
    points.forEach((point) => {
      expect(dist(point, c1.center)).toBeCloseTo(c1.r, 10)
      expect(dist(point, c2.center)).toBeCloseTo(c2.r, 10)
    })
  })

  it('returns no points when the circles are separate', () => {
    // Two far-apart unit circles never meet
    const points = circleIntersections(
      { center: { x: 0, y: 0 }, r: 1 },
      { center: { x: 5, y: 0 }, r: 1 }
    )
    // No crossings
    expect(points).toEqual([])
  })

  it('returns no points for concentric circles', () => {
    // Coincident centers have no isolated crossings
    const points = circleIntersections(
      { center: { x: 0, y: 0 }, r: 1 },
      { center: { x: 0, y: 0 }, r: 2 }
    )
    // No isolated crossings
    expect(points).toEqual([])
  })
})

describe('pointToward', () => {
  it('walks the requested distance along the direction', () => {
    // From the origin toward the north pole, one unit up
    expect(pointToward({ x: 0, y: 0 }, { x: 0, y: 4 }, 1)).toMatchObject({
      x: expect.closeTo(0, 10),
      y: expect.closeTo(1, 10),
    })
  })

  it('overshoots past the direction point when the distance exceeds it', () => {
    // Two units apart, but walk five — lands past the target
    expect(pointToward({ x: 0, y: 0 }, { x: 2, y: 0 }, 5)).toMatchObject({
      x: expect.closeTo(5, 10),
      y: expect.closeTo(0, 10),
    })
  })

  it('walks backward for a negative distance', () => {
    // A negative distance steps away from the direction point
    expect(pointToward({ x: 0, y: 0 }, { x: 0, y: 4 }, -2)).toMatchObject({
      x: expect.closeTo(0, 10),
      y: expect.closeTo(-2, 10),
    })
  })

  it('throws when the two points coincide', () => {
    // Coincident points define no direction to walk in
    expect(() => pointToward({ x: 1, y: 1 }, { x: 1, y: 1 }, 1)).toThrow()
  })
})

describe('foot', () => {
  it('drops a perpendicular onto a horizontal line', () => {
    // Foot from a point above the x-axis lands straight below it
    expect(foot({ x: 3, y: 2 }, { x: -1, y: 0 }, { x: 5, y: 0 })).toMatchObject({
      x: expect.closeTo(3, 10),
      y: expect.closeTo(0, 10),
    })
  })

  it('projects onto a diagonal line', () => {
    // Foot from (0, 2) onto the line y = x lands at (1, 1)
    const result = foot({ x: 0, y: 2 }, { x: 0, y: 0 }, { x: 3, y: 3 })
    expect(result.x).toBeCloseTo(1, 10)
    expect(result.y).toBeCloseTo(1, 10)
  })

  it('throws when the two line points coincide', () => {
    // Two identical points define no line to project onto
    expect(() => foot({ x: 1, y: 1 }, { x: 0, y: 0 }, { x: 0, y: 0 })).toThrow()
  })
})

describe('orthocenter', () => {
  it('lands on the right-angle vertex of a right triangle', () => {
    // A right triangle's altitudes concur at its right angle, here the origin
    const result = orthocenter({ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 0, y: 3 })
    expect(result.x).toBeCloseTo(0, 10)
    expect(result.y).toBeCloseTo(0, 10)
  })
})

describe('otherIntersection', () => {
  it('picks the crossing farther from the known point', () => {
    // Two overlapping unit circles cross at (0.5, ±√0.75)
    const c1 = { center: { x: 0, y: 0 }, r: 1 }
    const c2 = { center: { x: 1, y: 0 }, r: 1 }
    // Steer away from the lower crossing
    const known = { x: 0.5, y: -Math.sqrt(0.75) }
    // Take the crossing away from the known one
    const result = otherIntersection(c1, c2, known)
    // It's the upper crossing
    expect(result.x).toBeCloseTo(0.5, 10)
    expect(result.y).toBeCloseTo(Math.sqrt(0.75), 10)
  })

  it('throws when the circles do not intersect', () => {
    // Two separate circles have no crossings
    expect(() =>
      otherIntersection(
        { center: { x: 0, y: 0 }, r: 1 },
        { center: { x: 5, y: 0 }, r: 1 },
        { x: 0, y: 0 }
      )
    ).toThrow()
  })
})
