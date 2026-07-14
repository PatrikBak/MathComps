import { circle, defineFigure, type GeometryFigure, polygon, segment, segments } from './figure'
import {
  centroid,
  circleThrough,
  foot,
  lerp,
  midpoint,
  onUnitCircle,
  orthocenter,
  otherIntersection,
  type Point,
  pointToward,
} from './geometry'

/** Side length of a right-angle marker, in the unit-circle scale the figures are authored in. */
const RIGHT_ANGLE_SIZE = 0.07

/**
 * The two short segments of a right-angle marker at `corner`: the standard little square showing that
 * the lines toward the two given points meet there perpendicularly.
 *
 * @param corner - The right angle's vertex.
 * @param along - A point setting the first side's direction; the square opens toward it.
 * @param toward - A point setting the second side's direction; the square opens toward it too.
 *
 * @returns The marker's segment pairs, ready to spread into a {@link segments} stroke.
 */
function rightAngleMark(corner: Point, along: Point, toward: Point): [Point, Point][] {
  // One marker-sized step from the corner toward each reference point
  const first = pointToward(corner, along, RIGHT_ANGLE_SIZE)
  const second = pointToward(corner, toward, RIGHT_ANGLE_SIZE)
  // The square's outer corner, one step in both directions
  const outer = { x: first.x + second.x - corner.x, y: first.y + second.y - corner.y }
  // The square's two free sides
  return [
    [first, outer],
    [outer, second],
  ]
}

/**
 * The Euler-line construction, told center by center: the medians locate the centroid, the altitudes
 * the orthocenter, the perpendicular bisectors the circumcenter — each batch of scaffolding draws,
 * plants its point, and recedes before the next begins. The finale strings the three centers on the
 * Euler line, all three kept at equal weight with no accent.
 *
 * The triangle is markedly scalene — the closer to isosceles, the closer the three centers crowd
 * together and the line vanishes. The base vertices sit symmetric about south so the bottom side is
 * horizontal, with the apex off-center carrying the asymmetry.
 */
export const eulerLineFigure = defineFigure((scene) => {
  // A scalene triangle on the unit circle: a level base, the apex leaning well off-center
  const a = onUnitCircle(60)
  const b = onUnitCircle(215)
  const c = onUnitCircle(325)
  // The triangle
  scene.draw(polygon(a, b, c))
  scene.mark(a, b, c)
  // The three centers the theorem strings together
  const o = circleThrough(a, b, c).center
  const g = centroid(a, b, c)
  const h = orthocenter(a, b, c)
  // The altitude feet, where the right angles sit
  const footA = foot(a, b, c)
  const footB = foot(b, c, a)
  const footC = foot(c, a, b)
  // The side midpoints, where the perpendicular bisectors are erected
  const mBc = midpoint(b, c)
  const mCa = midpoint(c, a)
  const mAb = midpoint(a, b)
  // First batch: the medians plant the centroid, then recede
  scene.draw(segments([a, mBc], [b, mCa], [c, mAb]), { transient: true })
  scene.mark(g)
  // Second batch: the altitudes, right angles at their feet, plant the orthocenter, then recede
  scene.draw(
    segments(
      [a, footA],
      [b, footB],
      [c, footC],
      ...rightAngleMark(footA, c, a),
      ...rightAngleMark(footB, a, b),
      ...rightAngleMark(footC, b, c)
    ),
    { transient: true }
  )
  scene.mark(h)
  // Third batch: the perpendicular bisectors, each erected just outside its side midpoint and run
  // past their common point, plant the circumcenter, then recede
  scene.draw(
    segments(
      [lerp(mBc, o, -0.2), lerp(mBc, o, 1.35)],
      [lerp(mCa, o, -0.2), lerp(mCa, o, 1.35)],
      [lerp(mAb, o, -0.2), lerp(mAb, o, 1.35)],
      ...rightAngleMark(mBc, c, o),
      ...rightAngleMark(mCa, a, o),
      ...rightAngleMark(mAb, b, o)
    ),
    { transient: true }
  )
  scene.mark(o)
  // The finale: the Euler line, run a touch past the circumcenter and orthocenter on both ends
  scene.draw(segment(lerp(o, h, -0.12), lerp(o, h, 1.12)))
})

/**
 * The nine-point-circle construction, told in batches: the side midpoints pop, the altitudes plant
 * their feet and the vertex-to-orthocenter midpoints riding them, then recede, and the finale threads
 * a single circle through all nine points.
 *
 * The triangle is kept acute so every altitude foot lands on its side rather than an extension, with
 * the base vertices symmetric about south so the bottom side is horizontal.
 */
export const ninePointFigure = defineFigure((scene) => {
  // An acute triangle on the unit circle: a level base, the apex off-center
  const a = onUnitCircle(100)
  const b = onUnitCircle(200)
  const c = onUnitCircle(340)
  // The triangle
  scene.draw(polygon(a, b, c))
  scene.mark(a, b, c)
  // First batch: the side midpoints, the first three of the nine points
  const mBc = midpoint(b, c)
  const mCa = midpoint(c, a)
  const mAb = midpoint(a, b)
  scene.mark(mBc, mCa, mAb)
  // The altitude feet, the next three
  const footA = foot(a, b, c)
  const footB = foot(b, c, a)
  const footC = foot(c, a, b)
  // The Euler points — midpoints from each vertex to the orthocenter — the last three, each sitting
  // on its vertex's altitude
  const h = orthocenter(a, b, c)
  const eA = midpoint(a, h)
  const eB = midpoint(b, h)
  const eC = midpoint(c, h)
  // Second batch: the altitudes, right angles at their feet, then recede
  scene.draw(
    segments(
      [a, footA],
      [b, footB],
      [c, footC],
      ...rightAngleMark(footA, c, a),
      ...rightAngleMark(footB, a, b),
      ...rightAngleMark(footC, b, c)
    ),
    { transient: true }
  )
  // The feet pop first, then the Euler points a beat later — all six on the drawn altitudes
  scene.mark(footA, footB, footC)
  scene.mark(eA, eB, eC)
  // The finale: the nine-point circle, fixed by the three side midpoints — the circle itself is the
  // star, so no accent
  scene.draw(circle(circleThrough(mBc, mCa, mAb)))
})

/**
 * The Miquel-point construction: pick one point on each side of a triangle; the three circles, each
 * through a vertex and the chosen points on its two adjacent sides, all pass through a single Miquel
 * point. The three circles carry the figure, and the Miquel point is the accent.
 *
 * The triangle angles and the three {@link lerp} ratios are the only tuning knobs: they place the side
 * points so the three circles stay distinct and the Miquel point lands inside the triangle.
 */
export const miquelFigure = defineFigure((scene) => {
  // Triangle vertices on the unit circle
  const a = onUnitCircle(90)
  const b = onUnitCircle(210)
  const c = onUnitCircle(330)
  // One point on each side, at a chosen fraction along it
  const pBc = lerp(b, c, 0.42)
  const qCa = lerp(c, a, 0.55)
  const rAb = lerp(a, b, 0.38)
  // Each circle passes through a vertex and the two side-points adjacent to it
  const circleA = circleThrough(a, rAb, qCa)
  const circleB = circleThrough(b, pBc, rAb)
  const circleC = circleThrough(c, qCa, pBc)
  // Circles A and B already share the vertex R; their other crossing is the Miquel point
  const miquel = otherIntersection(circleA, circleB, rAb)
  // The triangle
  scene.draw(polygon(a, b, c))
  scene.mark(a, b, c)
  // The three chosen side points pop before any circle arrives
  scene.mark(pBc, qCa, rAb)
  // The three concurring circles
  scene.draw(circle(circleA))
  scene.draw(circle(circleB))
  scene.draw(circle(circleC))
  // The Miquel point where all three circles meet
  scene.accent(miquel)
})

/** Message key of a construction's localized name, under `home.hero.figures`. */
type HeroFigureName = 'miquel' | 'euler' | 'ninePoint'

/** A hero construction paired with the key of its localized name. */
type HeroFigure = {
  /** The normalized construction to draw. */
  figure: GeometryFigure
  /** Key of the construction's localized name. */
  name: HeroFigureName
}

/** The hero constructions, in cycle order — shortest draw-in to longest. */
export const HERO_FIGURES: readonly HeroFigure[] = [
  { figure: miquelFigure, name: 'miquel' },
  { figure: ninePointFigure, name: 'ninePoint' },
  { figure: eulerLineFigure, name: 'euler' },
]

/**
 * The next figure index, advancing in order and wrapping back to the first.
 *
 * @param current - The index currently shown.
 * @param count - How many figures there are.
 *
 * @returns The next index in `[0, count)`.
 */
export function nextFigureIndex(current: number, count: number): number {
  // Step forward, wrapping past the last back to the first
  return (current + 1) % count
}
