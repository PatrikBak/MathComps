import { assertNever } from '@/components/shared/utils/assert-never'
import { roundTo } from '@/components/shared/utils/number-utils'

import type { Circle, Point } from './geometry'

/** A full circle to stroke. */
type CircleShape = {
  /** Discriminates a circle shape. */
  kind: 'circle'
  /** The circle to stroke. */
  circle: Circle
}

/** A closed polygon through its vertices in order. */
type PolygonShape = {
  /** Discriminates a polygon shape. */
  kind: 'polygon'
  /** The vertices, in order. */
  points: Point[]
}

/** One or more straight segments drawn as a single stroke. */
type SegmentsShape = {
  /** Discriminates a segments shape. */
  kind: 'segments'
  /** The endpoint pairs, one per segment. */
  pairs: [Point, Point][]
}

/** A drawable authored in the y-up plane, before normalization to SVG coordinates. */
type Shape = CircleShape | PolygonShape | SegmentsShape

/**
 * Builds a {@link CircleShape}.
 *
 * @param circle - The circle to stroke.
 *
 * @returns The shape.
 */
export function circle(circle: Circle): CircleShape {
  // Wrap the circle as a drawable
  return { kind: 'circle', circle }
}

/**
 * Builds a closed {@link PolygonShape} through the given vertices.
 *
 * @param points - The vertices, in order.
 *
 * @returns The shape.
 */
export function polygon(...points: Point[]): PolygonShape {
  // Wrap the vertices as a drawable
  return { kind: 'polygon', points }
}

/**
 * Builds a single-segment {@link SegmentsShape}.
 *
 * @param p - One endpoint.
 * @param q - The other endpoint.
 *
 * @returns The shape.
 */
export function segment(p: Point, q: Point): SegmentsShape {
  // A lone segment is just a one-pair segments shape
  return { kind: 'segments', pairs: [[p, q]] }
}

/**
 * Builds a {@link SegmentsShape} of several segments that draw in as one stroke.
 *
 * @param pairs - The endpoint pairs, one per segment.
 *
 * @returns The shape.
 */
export function segments(...pairs: [Point, Point][]): SegmentsShape {
  // Wrap the pairs as a single-stroke drawable
  return { kind: 'segments', pairs }
}

/** Per-stroke styling overrides. */
type DrawOptions = {
  /** Override the default stroke width for the shape's kind. */
  weight?: number
  /** Draw the stroke in, then fade it to a ghost so scaffolding recedes behind the payload. */
  transient?: boolean
}

/**
 * The authoring surface handed to a figure's build callback. Each `draw` is one stroke step, in the
 * order called; that order drives the staggered draw-in timing.
 */
export type SceneBuilder = {
  /** Add a stroke step for the shape. */
  draw(shape: Shape, opts?: DrawOptions): void
  /** Add plain dots at the given points. */
  mark(...points: Point[]): void
  /** Set the highlighted point of a construction whose star is a point. */
  accent(point: Point): void
}

/** A circle in final SVG coordinates. */
type CircleElement = {
  /** Discriminates a circle element. */
  kind: 'circle'
  /** Center x in SVG coordinates. */
  cx: number
  /** Center y in SVG coordinates. */
  cy: number
  /** Radius in SVG coordinates. */
  r: number
  /** Stroke width. */
  weight: number
  /** Draw-in delay in seconds. */
  delay: number
  /** Delay in seconds at which the stroke fades to a ghost, or undefined when it stays solid. */
  vanishDelay?: number
}

/** A stroked path (polygon outline or a set of segments) in final SVG coordinates. */
type PathElement = {
  /** Discriminates a path element. */
  kind: 'path'
  /** SVG path `d` data. */
  d: string
  /** Stroke width. */
  weight: number
  /** Draw-in delay in seconds. */
  delay: number
  /** Delay in seconds at which the stroke fades to a ghost, or undefined when it stays solid. */
  vanishDelay?: number
}

/** A filled dot (plain vertex or the accent point) in final SVG coordinates. */
type DotElement = {
  /** Discriminates a dot element. */
  kind: 'dot'
  /** Center x in SVG coordinates. */
  cx: number
  /** Center y in SVG coordinates. */
  cy: number
  /** Dot radius in SVG coordinates. */
  r: number
  /** Fade-in delay in seconds. */
  delay: number
}

/** One renderable primitive of a normalized figure, already in the 300x300 SVG coordinate box. */
export type RenderElement = CircleElement | PathElement | DotElement

/** A construction normalized into SVG coordinates. */
export type GeometryFigure = {
  /** The renderable primitives, in draw order. */
  elements: RenderElement[]
}

/** A collected stroke step, before normalization. */
type StrokeStep = {
  /** The shape to stroke. */
  shape: Shape
  /** Stroke-width override, or undefined for the kind's default. */
  weight: number | undefined
  /** Whether the stroke fades to a ghost after drawing in. */
  transient: boolean
}

/** A collected mark, remembering its place in the stroke sequence so its dot pops there. */
type MarkStep = {
  /** The point to dot. */
  point: Point
  /** Index of the last stroke drawn before the mark, or -1 when it precedes every stroke. */
  afterStroke: number
  /** Which mark batch after that stroke the point belongs to, so each batch gets its own beat. */
  batch: number
}

/** Low edge, on both axes, of the box the content is fitted into. */
const BOX_MIN = 30
/** High edge, on both axes, of the box the content is fitted into. */
const BOX_MAX = 270
/** Center of the 300x300 viewBox. */
const VIEWBOX_CENTER = 150
/** Radius of a plain vertex dot. */
export const DOT_RADIUS = 3.5
/** Radius of the highlighted accent dot. */
export const ACCENT_RADIUS = 4.5
/** Seconds a transient stroke holds after drawing in before it begins to vanish. */
export const VANISH_HOLD_SECONDS = 0.4
/** Seconds between consecutive steps — stroke to stroke, or mark batch to the step after it. */
export const STAGGER_SECONDS = 0.5
/** Seconds after its stroke's start that a mark batch pops. */
export const MARK_LAG_SECONDS = 0.4
/** Seconds after the final stroke's start that the accent lands. */
export const ACCENT_LAG_SECONDS = 0.7

/**
 * Default stroke width for a shape kind (circle thinnest, triangle boldest, segments in between).
 *
 * @param kind - The shape's discriminator.
 *
 * @returns The default stroke width.
 */
function defaultWeight(kind: Shape['kind']): number {
  // Weight by shape kind
  switch (kind) {
    // A circle sits behind the construction
    case 'circle':
      return 1.5
    // The triangle outline
    case 'polygon':
      return 1.75
    // Supporting segments (medians, cevians)
    case 'segments':
      return 1.0
    // A new shape kind must declare its weight
    default:
      return assertNever(kind)
  }
}

/**
 * Every point that bounds a shape. A circle contributes its axis extremes.
 *
 * @param shape - The shape to bound.
 *
 * @returns The points to fold into the bounding box.
 */
function extentPoints(shape: Shape): Point[] {
  switch (shape.kind) {
    // A circle's box is its center plus/minus the radius on each axis
    case 'circle': {
      const { center, r } = shape.circle
      return [
        { x: center.x - r, y: center.y },
        { x: center.x + r, y: center.y },
        { x: center.x, y: center.y - r },
        { x: center.x, y: center.y + r },
      ]
    }
    // A polygon is bounded by its vertices
    case 'polygon':
      return shape.points
    // A segments shape is bounded by every endpoint
    case 'segments':
      return shape.pairs.flat()
    // A new shape kind must declare its extent
    default:
      return assertNever(shape)
  }
}

/** Maps a y-up construction point (and lengths) into the final SVG coordinate box. */
type Projector = {
  /** Project a point, flipping y and rounding. */
  point(source: Point): Point
  /** Project a length (radius), scaling and rounding. */
  length(value: number): number
}

/**
 * Builds the projector that fits the content bounding box into `[BOX_MIN, BOX_MAX]`, centered, with y
 * flipped for SVG.
 *
 * @param allPoints - Every point the figure spans (shape extents, marks, accent).
 *
 * @returns The projector.
 */
function buildProjector(allPoints: Point[]): Projector {
  // Every x and y the content spans
  const xs = allPoints.map((point) => point.x)
  const ys = allPoints.map((point) => point.y)
  // The content's bounding extremes on each axis
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  // The content's center, which maps to the middle of the viewBox
  const centerX = (minX + maxX) / 2
  const centerY = (minY + maxY) / 2
  // The longer content side, which the scale fits to the box
  const span = Math.max(maxX - minX, maxY - minY)
  // A construction with nothing drawn (span is -Infinity) or a single point (span is 0) has no extent
  if (span <= 0) {
    throw new Error('buildProjector: the construction has no extent to fit')
  }
  // One square scale so the longer side fills the box and the aspect ratio is preserved
  const scale = (BOX_MAX - BOX_MIN) / span
  // The projector: offset each point from the center, then scale it
  return {
    // Project a point: offset from center, then scale
    point: (source) => ({
      // x keeps its direction
      x: roundTo(VIEWBOX_CENTER + (source.x - centerX) * scale, 2),
      // y flips, since SVG's origin is top-left
      y: roundTo(VIEWBOX_CENTER - (source.y - centerY) * scale, 2),
    }),
    // Project a length: only the scale applies, no offset or flip
    length: (value) => roundTo(value * scale, 2),
  }
}

/**
 * Turns a stroke step into its SVG element (a `circle` for a circle, a `path` for the rest).
 *
 * @param step - The collected stroke step.
 * @param project - The active projector.
 * @param delay - The draw-in delay in seconds.
 *
 * @returns The circle or path element.
 */
function toStrokeElement(
  step: StrokeStep,
  project: Projector,
  delay: number
): CircleElement | PathElement {
  // Stroke width: the per-shape override, or the default for its kind
  const weight = step.weight ?? defaultWeight(step.shape.kind)
  // A transient stroke fades to its ghost a hold after it finishes drawing in
  const vanishDelay = step.transient ? delay + STROKE_DRAW_SECONDS + VANISH_HOLD_SECONDS : undefined
  // Narrow the shape for the switch
  const shape = step.shape
  switch (shape.kind) {
    // A circle keeps its own SVG primitive
    case 'circle': {
      // Project the center into SVG space
      const center = project.point(shape.circle.center)
      // Emit a circle element, its radius scaled to match
      return {
        kind: 'circle',
        cx: center.x,
        cy: center.y,
        r: project.length(shape.circle.r),
        weight,
        delay,
        vanishDelay,
      }
    }
    // A polygon becomes a closed path through its vertices
    case 'polygon': {
      // Project every vertex into SVG space
      const points = shape.points.map((point) => project.point(point))
      // Move to the first vertex, line to each of the rest
      const d = points
        .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x} ${point.y}`)
        .join(' ')
      // Close the path back to the start
      return { kind: 'path', d: `${d} Z`, weight, delay, vanishDelay }
    }
    // Segments become one path of independent move-line subpaths
    case 'segments': {
      // Each pair is its own move-then-line subpath
      const d = shape.pairs
        .map(([from, to]) => {
          // Project both endpoints into SVG space
          const start = project.point(from)
          const end = project.point(to)
          // Move to the start, line to the end
          return `M${start.x} ${start.y} L${end.x} ${end.y}`
        })
        .join(' ')
      // One path element holding every segment
      return { kind: 'path', d, weight, delay, vanishDelay }
    }
    // A new shape kind must declare its rendering
    default:
      return assertNever(shape)
  }
}

/**
 * When a mark batch pops: a lag into the stroke it follows, plus a stagger per earlier batch after
 * that same stroke.
 *
 * @param strokeDelay - The start of the stroke the batch follows, or 0 when it precedes every stroke.
 * @param batch - Which batch after that stroke the mark belongs to.
 *
 * @returns The batch's pop delay in seconds.
 */
function markBatchDelay(strokeDelay: number, batch: number): number {
  // A lag into the stroke, then one stagger per batch already popped
  return strokeDelay + MARK_LAG_SECONDS + batch * STAGGER_SECONDS
}

/**
 * Runs a construction's build callback and normalizes it into a renderable {@link GeometryFigure}.
 *
 * The builder authors in a y-up math plane (points on circles, midpoints, intersections); this fits the
 * whole thing into the SVG box and assigns the sequential draw-in timing: strokes stagger in, a stroke
 * after a transient one waits for that fade to begin, and each mark batch pops on its own beat after
 * the stroke it follows in the authoring order.
 *
 * @param build - Authors the construction against a {@link SceneBuilder}.
 *
 * @returns The normalized figure in SVG coordinates.
 *
 * @throws If the construction has no extent to fit — nothing drawn at all, or a single point.
 */
export function defineFigure(build: (scene: SceneBuilder) => void): GeometryFigure {
  // Collect the authored construction, preserving draw order
  const strokes: StrokeStep[] = []
  const marks: MarkStep[] = []
  let accentPoint: Point | null = null
  // How many mark batches followed the latest stroke so far
  let batchesAfterStroke = 0
  // The authoring surface the caller draws against
  const scene: SceneBuilder = {
    // Each draw is one ordered stroke step, opening a fresh run of mark batches
    draw: (shape, opts) => {
      strokes.push({
        shape,
        weight: opts?.weight,
        transient: opts?.transient ?? false,
      })
      // Mark batches count anew after each stroke
      batchesAfterStroke = 0
    },
    // Each mark call is one batch of plain dots, remembering its place in the sequence
    mark: (...points) => {
      // The batch this call forms
      const batch = batchesAfterStroke
      // One mark step per point, all in the same batch
      marks.push(...points.map((point) => ({ point, afterStroke: strokes.length - 1, batch })))
      // The next call after this stroke is a later batch
      batchesAfterStroke += 1
    },
    // The accent is the single highlighted point, when the construction has one
    accent: (point) => {
      accentPoint = point
    },
  }
  // Author the figure
  build(scene)
  // Fit the whole construction (shapes, marks, accent) into the SVG box
  const spanPoints = [
    ...strokes.flatMap((step) => extentPoints(step.shape)),
    ...marks.map((mark) => mark.point),
    ...(accentPoint === null ? [] : [accentPoint]),
  ]
  const project = buildProjector(spanPoints)
  // When each stroke starts: a stagger into the previous one — stretched to the previous stroke's
  // fade when it's transient, and pushed past any mark batches riding it, so every step gets its beat
  const strokeDelays = strokes.reduce<number[]>((delays, _, index) => {
    // The first stroke starts at once
    if (index === 0) {
      return [0]
    }
    // When the previous stroke started
    const prevDelay = delays[index - 1]
    // The gap after a transient stroke spans its full draw-in and hold; otherwise the stagger
    const gap = strokes[index - 1].transient
      ? STROKE_DRAW_SECONDS + VANISH_HOLD_SECONDS
      : STAGGER_SECONDS
    // The last mark batch riding the previous stroke, or -1 when none did
    const lastBatch = marks
      .filter((mark) => mark.afterStroke === index - 1)
      .reduce((latest, mark) => Math.max(latest, mark.batch), -1)
    // The earliest start that still gives that batch its own beat
    const afterMarks = lastBatch === -1 ? 0 : markBatchDelay(prevDelay, lastBatch) + STAGGER_SECONDS
    // This stroke starts after both the previous stroke's gap and its mark batches
    return [...delays, Math.max(prevDelay + gap, afterMarks)]
  }, [])
  // The normalized stroke elements, each on its computed delay
  const strokeElements = strokes.map((step, index) =>
    toStrokeElement(step, project, strokeDelays[index])
  )
  // Each plain dot pops on its batch's beat
  const markElements: DotElement[] = marks.map((mark) => {
    // The mark's position in SVG space
    const projected = project.point(mark.point)
    // The dot element, timed to its batch
    return {
      kind: 'dot',
      cx: projected.x,
      cy: projected.y,
      r: DOT_RADIUS,
      delay: markBatchDelay(strokeDelays[mark.afterStroke] ?? 0, mark.batch),
    }
  })
  // The accent, when set, lands last, a touch into the final stroke
  const accentElements: DotElement[] =
    accentPoint === null
      ? []
      : [
          {
            kind: 'dot',
            cx: project.point(accentPoint).x,
            cy: project.point(accentPoint).y,
            r: ACCENT_RADIUS,
            delay: (strokeDelays[strokes.length - 1] ?? 0) + ACCENT_LAG_SECONDS,
          },
        ]
  // Strokes first (drawn behind), then plain dots, then the accent on top
  return { elements: [...strokeElements, ...markElements, ...accentElements] }
}

/** Seconds a stroke takes to draw itself in; matches the `heroFigDraw` keyframe. */
export const STROKE_DRAW_SECONDS = 1.2

/** Seconds a dot takes to fade in; matches the `heroFigDot` keyframe. */
export const DOT_FADE_SECONDS = 0.4

/** Seconds a transient stroke takes to fade to its ghost; matches the `heroFigVanish` keyframe. */
export const VANISH_FADE_SECONDS = 0.6

/** Stroke opacity a transient stroke fades to; matches the `heroFigVanish` keyframe. */
export const VANISH_OPACITY = 0.12

/**
 * When an element finishes animating, in seconds: a dot when it fades in, a transient stroke when it
 * has fully faded to its ghost, and a solid stroke when it finishes drawing in.
 *
 * @param element - The normalized element to time.
 *
 * @returns The second at which the element is done animating.
 */
function elementEndSeconds(element: RenderElement): number {
  // A dot is done once it has faded in
  if (element.kind === 'dot') {
    return element.delay + DOT_FADE_SECONDS
  }
  // A transient stroke is done once it has faded to its ghost
  if (element.vanishDelay !== undefined) {
    return element.vanishDelay + VANISH_FADE_SECONDS
  }
  // A solid stroke is done once it has finished drawing in
  return element.delay + STROKE_DRAW_SECONDS
}

/**
 * How long a figure takes to finish drawing in, in milliseconds: its latest-finishing element's delay
 * plus that element's own animation length. Lets a caller time the beat between constructions off the
 * real draw-in rather than guessing a fixed hold.
 *
 * @param figure - The normalized construction to measure.
 *
 * @returns The full draw-in duration in milliseconds.
 */
export function figureDrawDurationMs(figure: GeometryFigure): number {
  // The figure lands when its latest element finishes, maxed across all of them (the last element to
  // start is not always the last to finish)
  const endSeconds = Math.max(...figure.elements.map(elementEndSeconds))
  // Timers consume milliseconds
  return endSeconds * 1000
}
