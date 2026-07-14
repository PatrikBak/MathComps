/**
 * Pure math kernel for authoring geometry constructions in a y-up plane (0° = east, angles grow
 * counter-clockwise, y increases upward). Everything here is coordinate-system agnostic and unaware of
 * SVG; the flip to screen coordinates happens later in the normalizer.
 */

/** A point in the y-up construction plane. */
export type Point = {
  /** Horizontal coordinate. */
  x: number
  /** Vertical coordinate (increases upward). */
  y: number
}

/** A circle in the y-up construction plane. */
export type Circle = {
  /** The center point. */
  center: Point
  /** The radius. */
  r: number
}

/**
 * The point on the unit circle at the given angle, measured in degrees from east, counter-clockwise.
 *
 * @param angleDeg - Angle from the positive x-axis, in degrees.
 *
 * @returns The point `(cos, sin)` on the unit circle.
 */
export function onUnitCircle(angleDeg: number): Point {
  // Degrees are nicer to author with; the trig wants radians
  const radians = (angleDeg * Math.PI) / 180
  // Walk out to the unit circle at that angle
  return { x: Math.cos(radians), y: Math.sin(radians) }
}

/**
 * The midpoint of the segment between two points.
 *
 * @param p - One endpoint.
 * @param q - The other endpoint.
 *
 * @returns The point halfway between `p` and `q`.
 */
export function midpoint(p: Point, q: Point): Point {
  // Average each coordinate
  return { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 }
}

/**
 * Linear interpolation from `p` to `q`: `t = 0` gives `p`, `t = 1` gives `q`.
 *
 * @param p - Start point (`t = 0`).
 * @param q - End point (`t = 1`).
 * @param t - Fraction along the segment.
 *
 * @returns The interpolated point.
 */
export function lerp(p: Point, q: Point, t: number): Point {
  // Slide from p toward q by fraction t on each axis
  return { x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t }
}

/**
 * The centroid (average) of a triangle's three vertices — where its medians concur.
 *
 * @param a - First vertex.
 * @param b - Second vertex.
 * @param c - Third vertex.
 *
 * @returns The centroid point.
 */
export function centroid(a: Point, b: Point, c: Point): Point {
  // Average the three vertices
  return { x: (a.x + b.x + c.x) / 3, y: (a.y + b.y + c.y) / 3 }
}

/**
 * Euclidean distance between two points.
 *
 * @param p - First point.
 * @param q - Second point.
 *
 * @returns The straight-line distance.
 */
export function dist(p: Point, q: Point): number {
  // Difference vector along each axis
  const dx = q.x - p.x
  const dy = q.y - p.y
  // Pythagoras
  return Math.hypot(dx, dy)
}

/**
 * The circle through three non-collinear points (their circumcircle).
 *
 * Solves for the center as the intersection of two perpendicular bisectors via the standard
 * determinant formula, then takes the radius as its distance to any vertex.
 *
 * @param a - First point on the circle.
 * @param b - Second point on the circle.
 * @param c - Third point on the circle.
 *
 * @returns The unique circle passing through all three points.
 *
 * @throws If the points are collinear (no finite circle exists).
 */
export function circleThrough(a: Point, b: Point, c: Point): Circle {
  // Twice the signed area of the triangle; zero means the points line up
  const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y))
  // Collinear points have no circumcircle
  if (d === 0) {
    throw new Error('circleThrough: the three points are collinear')
  }
  // Squared magnitudes reused across both center coordinates
  const aSq = a.x * a.x + a.y * a.y
  const bSq = b.x * b.x + b.y * b.y
  const cSq = c.x * c.x + c.y * c.y
  // Center from the perpendicular-bisector determinant
  const ux = (aSq * (b.y - c.y) + bSq * (c.y - a.y) + cSq * (a.y - b.y)) / d
  const uy = (aSq * (c.x - b.x) + bSq * (a.x - c.x) + cSq * (b.x - a.x)) / d
  // Pin down the center, then measure out to a vertex for the radius
  const center = { x: ux, y: uy }
  return { center, r: dist(center, a) }
}

/**
 * The intersection points of two circles: the two crossing points, or none.
 *
 * Uses the radical-line method — the two circles' equations subtract to a line, and the intersections
 * are where that line meets either circle.
 *
 * @param c1 - First circle.
 * @param c2 - Second circle.
 *
 * @returns Both intersection points, or an empty array when the circles miss each other, are nested,
 *   or coincide.
 */
export function circleIntersections(c1: Circle, c2: Circle): Point[] {
  // Vector between centers and the distance along it
  const dx = c2.center.x - c1.center.x
  const dy = c2.center.y - c1.center.y
  const centerDist = Math.hypot(dx, dy)
  // Concentric circles never cross at isolated points (coincident or nested)
  if (centerDist === 0) {
    return []
  }
  // Distance from c1's center to the foot of the radical line
  const footDist = (centerDist * centerDist + c1.r * c1.r - c2.r * c2.r) / (2 * centerDist)
  // Squared half-chord from the foot to each intersection
  const halfChordSq = c1.r * c1.r - footDist * footDist
  // Negative means the circles don't reach each other (separate or nested)
  if (halfChordSq < 0) {
    return []
  }
  // Foot of the radical line, on the line between the centers
  const footX = c1.center.x + (footDist * dx) / centerDist
  const footY = c1.center.y + (footDist * dy) / centerDist
  // Half-chord length, stepped perpendicular to the center line
  const halfChord = Math.sqrt(halfChordSq)
  const offsetX = (-dy * halfChord) / centerDist
  const offsetY = (dx * halfChord) / centerDist
  // The two crossings sit symmetrically either side of the foot
  return [
    { x: footX + offsetX, y: footY + offsetY },
    { x: footX - offsetX, y: footY - offsetY },
  ]
}

/**
 * Of two circles' intersection points, the one farther from a known point.
 *
 * Handy when one crossing is already named (a shared vertex) and you want the *other* — pass that
 * vertex as `known` and get back the second intersection.
 *
 * @param c1 - First circle.
 * @param c2 - Second circle.
 * @param known - The already-known intersection to steer away from.
 *
 * @returns The intersection point farther from `known`.
 *
 * @throws If the circles do not intersect.
 */
export function otherIntersection(c1: Circle, c2: Circle, known: Point): Point {
  // Both crossings of the two circles
  const points = circleIntersections(c1, c2)
  // Name the two crossings
  const [first, second] = points
  // No pair means the circles never met
  if (first === undefined || second === undefined) {
    throw new Error('otherIntersection: the circles do not intersect')
  }
  // Keep the crossing that sits farthest from the known one
  return dist(first, known) >= dist(second, known) ? first : second
}

/**
 * The point at a given distance from `from`, walking in the direction of `to`.
 *
 * @param from - The point to walk from.
 * @param to - The point setting the direction.
 * @param distance - How far to walk; may exceed the distance to `to` or be negative.
 *
 * @returns The point `distance` away from `from` along the ray toward `to`.
 *
 * @throws If the two points coincide, so no direction is defined.
 */
export function pointToward(from: Point, to: Point, distance: number): Point {
  // How far apart the two points are
  const separation = dist(from, to)
  // Coincident points define no direction to walk in
  if (separation === 0) {
    throw new Error('pointToward: the two points coincide')
  }
  // Walk the requested distance along the unit direction
  return lerp(from, to, distance / separation)
}

/**
 * The foot of the perpendicular dropped from a point onto the line through two others: the point on
 * that line closest to `point`.
 *
 * @param point - The point the perpendicular drops from.
 * @param a - One point on the line.
 * @param b - Another point on the line.
 *
 * @returns The foot of the perpendicular on line `ab`.
 *
 * @throws If `a` and `b` coincide, so no line is defined.
 */
export function foot(point: Point, a: Point, b: Point): Point {
  // Direction of the line
  const dx = b.x - a.x
  const dy = b.y - a.y
  // Squared length of the direction; zero means the two line points coincide
  const lenSq = dx * dx + dy * dy
  // Two identical points define no line
  if (lenSq === 0) {
    throw new Error('foot: the two line points coincide')
  }
  // How far along the line, from a toward b, the projection lands
  const t = ((point.x - a.x) * dx + (point.y - a.y) * dy) / lenSq
  // Walk that fraction along the line from a
  return { x: a.x + t * dx, y: a.y + t * dy }
}

/**
 * The orthocenter of a triangle — where its three altitudes concur.
 *
 * Derives it from the circumcenter via the vector identity `H = A + B + C − 2·O`, which holds for any
 * triangle.
 *
 * @param a - First vertex.
 * @param b - Second vertex.
 * @param c - Third vertex.
 *
 * @returns The orthocenter point.
 *
 * @throws If the vertices are collinear, so no circumcenter exists.
 */
export function orthocenter(a: Point, b: Point, c: Point): Point {
  // The circumcenter O anchors the identity
  const o = circleThrough(a, b, c).center
  // H = A + B + C − 2·O on each axis
  return { x: a.x + b.x + c.x - 2 * o.x, y: a.y + b.y + c.y - 2 * o.y }
}
