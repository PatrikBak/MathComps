// Shared setup for handout figures: imported with `import _common;`.

// Pattern fills (e.g. hatching) — pulled in here so `HatchedFill` below is usable.
import patterns;

// Latin Modern for label text so figures match the surrounding handout body
texpreamble("\usepackage{lmodern}\usepackage[T1]{fontenc}");

// Basic units
unitsize(1pt);

//
// Line-width tiers. NormalWidth is the default for edges and circles, baked
// into `defaultpen` below so any pen without its own `linewidth(...)` renders
// at NormalWidth. Pens that DO specify their own linewidth (e.g. `vertexPen`'s
// `ThinWidth`) override the default at draw time, so `Draw(A, B, vertexPen)`
// renders thin without raw-`draw` workarounds.
//
real ThinWidth = 0.5;
real NormalWidth = 1.0;
real ThickWidth = 1.5;

defaultpen(fontsize(13pt) + linewidth(NormalWidth));

//
// Palette: 5 hue families × Light/Normal/Dark. Pick the closest hue and shade.
// AngleMark / RightAngleMark fills want a `Light*` pen so the sector reads softly.
//
pen LightBlue = rgb(0.5, 0.5, 1);
pen Blue = rgb(0, 0, 1);
pen DarkBlue = rgb(0, 0, 0.5);

pen LightRed = rgb(1, 0.5, 0.5);
pen Red = rgb(1, 0, 0);
pen DarkRed = rgb(0.5, 0, 0);

pen LightGreen = rgb(0.5, 1, 0.5);
pen Green = rgb(0, 0.5, 0);
pen DarkGreen = rgb(0, 0.25, 0);

pen LightPurple = rgb(1, 0.5, 1);
pen Purple = rgb(0.5, 0, 0.5);
pen DarkPurple = rgb(0.25, 0, 0.25);

pen LightPink = rgb(1, 0.75, 0.85);
pen Pink = rgb(1, 0.5, 0.75);
pen DarkPink = rgb(0.75, 0.25, 0.5);

pen LightYellow = rgb(1, 1, 0.5);
pen Yellow = rgb(0.5, 0.5, 0);
pen DarkYellow = rgb(0.25, 0.25, 0);

//
// Diagonal-hatch fill pattern. Use as `fill(path, HatchedFill)` to shade a
// region with NE-slanting 45° lines spaced 3mm apart in medium gray.
// Reassign per file via `add("name", hatch(...)); HatchedFill = pattern("name");`
// when a figure needs a denser, finer, or tinted variant.
//
add("hatched45", hatch(3mm, dir(45), gray(0.6)));
pen HatchedFill = pattern("hatched45");

//
// Standard pens reused by every figure.
//
pen edgePen = black + linewidth(NormalWidth);
pen vertexPen = black + linewidth(ThinWidth);

//
// Arc-radius presets for AngleMark. Radius3 is the default; pick a different
// preset (or pass a literal) per call when a figure needs more variety.
// Reassign any of these per file if the figure scale calls for it.
//
real Radius1 = 10;
real Radius2 = 15;
real Radius3 = 20;
real Radius4 = 25;
real Radius5 = 30;

//
// Multiplier for the outer of two equal-angle wedges that share a vertex and
// a bisector ray. Call sites use the pre-multiplied `Radius*Nudged` tier
// below — pass `radius = Radius2Nudged` rather than `Radius2 * WedgeNudge`.
//
real WedgeNudge = 1.2;

//
// Pre-multiplied counterparts of Radius1..5 for the outer wedge of a pair.
// In a "two equal angles meeting at a bisector" pair, give the first AngleMark
// a plain `Radius*` and the second the matching `Radius*Nudged`: the second
// wedge sits slightly outside the first so the pair stair-steps at the
// bisector instead of merging into one arc cut by the bisector line.
//
real Radius1Nudged = Radius1 * WedgeNudge;
real Radius2Nudged = Radius2 * WedgeNudge;
real Radius3Nudged = Radius3 * WedgeNudge;
real Radius4Nudged = Radius4 * WedgeNudge;
real Radius5Nudged = Radius5 * WedgeNudge;

//
// Font-size tiers for figure text, paralleling Radius1..Radius5. Font3 matches
// the 13pt default set by defaultpen; pick lower for dense figures or narrow
// angle sectors, higher for emphasis. Pass as `labelPen` to AngleMark /
// RightAngleMark, or directly to label().
//
pen Font1 = fontsize(8pt);
pen Font2 = fontsize(10pt);
pen Font3 = fontsize(13pt);
pen Font4 = fontsize(16pt);
pen Font5 = fontsize(20pt);

//
// Default vertex dot radius
//
real vertexDotRadius = 2.95;

//
// Default shift along alignDir for point labels
//
real pointLabelDistance = 3;

//
// Default `haloPad` for PointLabel / LabeledDot when `halo = true`: scales
// the white ellipse relative to the text's bbox (1.0 ≈ inscribed in bbox,
// ~1.3 clears the letter's corners cleanly, ~sqrt(2) ≈ circumscribed).
//
real pointLabelHaloPad = 1.1;

//
// Default shift along alignDir for edge labels
//
real edgeLabelDistance = 0;

//
// Default fraction of AngleMark's radius at which its label is placed.
//
real angleMarkLabelFraction = 1.5;

//
// Length of each tick segment in the parallel-lines mark.
//
real parallelMarkLength = 7.5;

//
// Distance between adjacent ticks in the parallel-lines mark.
//
real parallelMarkSpacing = 3;

//
// Rotation angle of each tick relative to the segment direction.
//
real parallelMarkAngle = 80;

//
// Geometric point constructors
//

//
// Returns the midpoint of segment AB.
//
pair Midpoint(
    pair A,
    pair B)
{
    return (A + B) / 2;
}

//
// Returns the point at distance r from O along the ray at angle angleDeg
// (measured CCW from +x).
//
pair Polar(
    pair O,
    real angleDeg,
    real r)
{
    return O + r * dir(angleDeg);
}

//
// Extends ray AB past B by `length` units. The returned point lies on line AB,
// on the far side of B from A, at distance `length` from B.
//
pair ExtendPast(
    pair A,
    pair B,
    real length)
{
    return B + length * unit(B - A);
}

//
// Returns the perpendicular projection of P onto the line through A and B.
//
pair Foot(
    pair P,
    pair A,
    pair B)
{
    pair d = B - A;
    return A + dot(P - A, d) / dot(d, d) * d;
}

//
// Returns the reflection of P across the line through A and B.
//
pair ReflectAcross(
    pair P,
    pair A,
    pair B)
{
    return 2 * Foot(P, A, B) - P;
}

//
// Returns the apex C of the equilateral triangle ABC, placed "above" AB —
// i.e. on the left of the directed segment A → B (CCW rotation by 60°).
// For the apex on the other side, pass the points in reverse order.
//
pair EquilateralTriangle(
    pair A,
    pair B)
{
    return A + rotate(60) * (B - A);
}

//
// Returns the two points where line AB meets the circle (O, r), ordered along
// the direction A -> B. Requires the line to actually cut the circle, i.e. the
// distance from O to line AB to be smaller than r.
//
pair[] LineCircleIntersections(
    pair A,
    pair B,
    pair O,
    real r)
{
    // The chord is centred on the foot of O, and Pythagoras on the right
    // triangle (r, distance from O to the line) gives its half-length.
    pair F = Foot(O, A, B);
    real centerDistance = abs(O - F);
    real halfChord = sqrt(r * r - centerDistance * centerDistance);

    // The direction the two points come out ordered along
    pair u = unit(B - A);

    // Step off the half-chord either way from the foot
    return new pair[] { F - halfChord * u, F + halfChord * u };
}

//
// Returns two points on the radical axis of the non-concentric circles
// (O1, r1) and (O2, r2), placed symmetrically about the line O1O2 at distance
// `halfLength` on either side of it.
//
pair[] RadicalAxis(
    pair O1,
    real r1,
    pair O2,
    real r2,
    real halfLength = 1)
{
    // The axis is perpendicular to O1O2, and its foot sits at signed distance
    // (D^2 + r1^2 - r2^2) / (2D) from O1 along O1 -> O2. That drops out of
    // equating the two powers at the centerline point x away from O1:
    // x^2 - r1^2 = (D - x)^2 - r2^2, i.e. 2Dx = D^2 + r1^2 - r2^2.
    pair d = O2 - O1;
    real D = abs(d);
    pair dHat = d / D;
    pair F = O1 + (D * D + r1 * r1 - r2 * r2) / (2 * D) * dHat;

    // The axis itself runs perpendicular to the centerline through that foot
    pair dPerp = (-dHat.y, dHat.x);

    // Step off `halfLength` either way from the foot
    return new pair[] { F + halfLength * dPerp, F - halfLength * dPerp };
}

//
// Returns the centre of the circle through the non-collinear points A, B, C,
// as the intersection of the perpendicular bisectors of AB and AC.
//
pair Circumcenter(
    pair A,
    pair B,
    pair C)
{
    // The midpoints the two bisectors run through
    pair Mab = Midpoint(A, B);
    pair Mac = Midpoint(A, C);

    // Each bisector leaves its midpoint perpendicular to its own chord
    return extension(
        Mab, Mab + rotate(90) * (B - A),
        Mac, Mac + rotate(90) * (C - A));
}

//
// Returns the two tangent points {T1, T2} of one external common tangent line
// to circles (P1, r1) and (P2, r2): T1 sits on circle 1, T2 on circle 2, and
// the segment T1T2 lies along the tangent. The two circles have two external
// common tangents (one on each side); `side` ∈ {+1, -1} selects which.
//
// Caller picks `side` based on which side of the line P1P2 the tangent should
// lie. Requires the circles to not enclose one another, i.e. |r2 - r1| < |P2 - P1|.
//
pair[] CommonExternalTangent(
    pair P1,
    real r1,
    pair P2,
    real r2,
    int side)
{
    // Unit vector from circle 1 toward circle 2 and its CCW-perpendicular
    pair d = P2 - P1;
    real D = abs(d);
    pair dHat = d / D;
    pair dPerp = (-dHat.y, dHat.x);

    // Normal direction `n` to the tangent line, parameterised by an angle whose
    // cosine is forced by the radius difference along the centerline.
    real cosA = (r2 - r1) / D;
    real sinA = side * sqrt(1 - cosA * cosA);
    pair n = cosA * dHat + sinA * dPerp;

    // Tangent points: step from each center one radius opposite `n`.
    return new pair[] { P1 - r1 * n, P2 - r2 * n };
}

//
// Of the two external common tangents to circles (P1, r1) and (P2, r2),
// returns the tangent points {T1, T2} of the one whose tangent line lies
// FARTHER from `refPoint`. The disambiguator wanted whenever one external
// tangent would cross toward `refPoint` (an interior reference) and the
// other forms the outer boundary on the far side from it.
//
pair[] CommonExternalTangentAwayFrom(
    pair P1,
    real r1,
    pair P2,
    real r2,
    pair refPoint)
{
    // Compute both side choices, keep whichever tangent line is farther from refPoint.
    pair[] candPlus = CommonExternalTangent(P1, r1, P2, r2, +1);
    pair[] candMinus = CommonExternalTangent(P1, r1, P2, r2, -1);
    real distPlus = abs(refPoint - Foot(refPoint, candPlus[0], candPlus[1]));
    real distMinus = abs(refPoint - Foot(refPoint, candMinus[0], candMinus[1]));
    return distPlus > distMinus ? candPlus : candMinus;
}

//
// Returns the two tangent points {T1, T2} on circle (O, r) from external point P.
// Requires |P - O| > r. By Thales, the tangent points lie on the circle with
// diameter PO, so they're the two intersections of that Thales circle with the
// original circle. T1 is the CCW tangent point from ray O -> P (the "left" one
// when standing at O facing P); T2 is the CW / "right" one.
//
pair[] TangentPointsFromExternal(
    pair P,
    pair O,
    real r)
{
    // Center of the Thales circle (midpoint of PO) and its radius.
    pair M = (P + O) / 2;
    real D = abs(P - O);
    real R = D / 2;

    // Distance from O along OM to the chord shared by the two circles, and the
    // half-chord length perpendicular to OM. Solve r^2 - x^2 = R^2 - (D - x)^2.
    real x = (r * r) / D;
    real h = sqrt(r * r - x * x);

    // Unit vector from O toward P, and its CCW-perpendicular.
    pair u = (P - O) / D;
    pair uPerp = (-u.y, u.x);

    // Two tangent points: step x along u from O, then ±h along uPerp.
    return new pair[] { O + x * u + h * uPerp, O + x * u - h * uPerp };
}

//
// Returns the two tangent points {T1, T2} of one internal common tangent of
// disjoint circles (P1, r1) and (P2, r2): T1 sits on circle 1, T2 on circle 2,
// and the segment T1T2 crosses between the two circles. Requires the circles
// to be disjoint, i.e. |P1 - P2| > r1 + r2. The two internal tangents lie on
// opposite sides of the centerline; `side` ∈ {+1, -1} selects which.
//
pair[] CommonInternalTangent(
    pair P1,
    real r1,
    pair P2,
    real r2,
    int side)
{
    // Unit vector from circle 1 toward circle 2 and its CCW-perpendicular.
    pair d = P2 - P1;
    real D = abs(d);
    pair dHat = d / D;
    pair dPerp = (-dHat.y, dHat.x);

    // Normal direction `n` to the tangent line, oriented so it points from the
    // line toward circle 2 (cosA > 0). Internal tangents differ from external in
    // that the centers sit on opposite sides of the line — hence cosA uses
    // (r1 + r2) instead of (r2 - r1).
    real cosA = (r1 + r2) / D;
    real sinA = side * sqrt(1 - cosA * cosA);
    pair n = cosA * dHat + sinA * dPerp;

    // Tangent points: P1 sits on the −n side, so A' = P1 + r1*n reaches the line;
    // P2 sits on the +n side, so B' = P2 − r2*n reaches the line.
    return new pair[] { P1 + r1 * n, P2 - r2 * n };
}

//
// Fills the angle sector ∠XYZ with vertex Y, sweeping CCW from ray YX to ray YZ.
// Pass a `Light*` pen for `color` so the filled sector reads softly. When `lab`
// is non-empty, "$lab$" is placed on the angular bisector at distance
// labelFraction * radius + labelOffset from Y.
//
// Used global variables: Radius3, angleMarkLabelFraction
//
void AngleMark(
    pair X,
    pair Y,
    pair Z,
    pen color,
    string lab = "",
    real radius = Radius3,
    real labelFraction = angleMarkLabelFraction,
    real labelOffset = 0,
    pen labelPen = black)
{
    // Compute start/end angles (CCW from +x)
    real d1 = degrees(X - Y);
    real d2 = degrees(Z - Y);

    // Normalise so d2 ≥ d1 — Asymptote's arc() reverses direction (CW) when d2 < d1.
    while (d2 < d1) d2 += 360;

    // Fill the wedge from Y along the arc back to Y
    fill(Y -- arc(Y, radius, d1, d2) -- cycle, color);

    // Place the optional label on the angular bisector
    if (lab != "") {
        real mid = (d1 + d2) / 2;
        real labelR = radius * labelFraction + labelOffset;
        label("$" + lab + "$", Y + labelR * dir(mid), labelPen);
    }
}

//
// Draws the segment AB with the standard edge styling. Pass a solid colour
// (e.g. Blue) to tint; the global `defaultpen` supplies NormalWidth when the
// pen doesn't carry its own `linewidth(...)`. Pass a fully-formed pen
// (e.g. `vertexPen`) to keep extra attributes — the pen's own linewidth,
// if any, wins over the default. For dashed / dash-dotted / dotted strokes
// use `DashedDraw` / `DashDotDraw` / `DottedDraw` instead.
//
void Draw(
    pair A,
    pair B,
    pen color = black)
{
    draw(A -- B, color);
}

//
// Strokes segment AB with a custom alternating on/off pattern. `pattern`
// holds the on/off lengths in pt (the array shape Asymptote's `linetype`
// expects). `shift` advances the pattern's phase along the path in pt;
// tune per call to place gaps over the vertices instead of dashes or dots.
// `color`'s embedded linewidth, if any, wins over `defaultpen`'s NormalWidth,
// so passing `vertexPen` thins the stroke without a separate width param.
//
void PatternDraw(
    pair A,
    pair B,
    pen color,
    real[] pattern,
    real shift = 0)
{
    // Literal (unadjusted) linetype at the requested phase
    pen p = linetype(pattern, offset = shift, scale = false, adjust = false);

    // Compose colour (and its embedded linewidth, if any) with the pattern pen
    draw(A -- B, color + p);
}

//
// Draws segment AB with a dashed pattern: dash, gap, dash, gap, … each of
// length `size` in pt. `shift` advances the phase in pt; tune per call to
// place a gap over the vertex instead of mid-dash.
//
void DashedDraw(
    pair A,
    pair B,
    pen color = black,
    real size = 3,
    real shift = 0)
{
    PatternDraw(A, B, color, new real[] {size, size}, shift);
}

//
// Draws segment AB with a dash-dot pattern: dash (2·size), gap (size), dot,
// gap (size), … Dashes are twice the gap so they read clearly as dashes
// next to the dots, which render as ~linewidth-diameter circles via
// Asymptote's default round linecap on a 0-length "on" segment. `shift`
// advances the phase in pt.
//
void DashDotDraw(
    pair A,
    pair B,
    pen color = black,
    real size = 3,
    real shift = 0)
{
    PatternDraw(A, B, color, new real[] {2 * size, size, 0, size}, shift);
}

//
// Draws segment AB with a dotted pattern: dot, gap (size), dot, gap (size),
// … Dots render as ~linewidth-diameter circles via Asymptote's default
// round linecap on a 0-length "on" segment. `shift` advances the phase in pt.
//
void DottedDraw(
    pair A,
    pair B,
    pen color = black,
    real size = 3,
    real shift = 0)
{
    PatternDraw(A, B, color, new real[] {0, size}, shift);
}

//
// Draws a circle with the same edge styling as Draw — same colour-only convention.
//
void Circle(
    pair center,
    real radius,
    pen color = black)
{
    draw(circle(center, radius), color);
}

//
// Draws an arc of the circle centered at `center` (radius taken from
// |start - center|) running from near `start`, through `through`, to near
// `end`. The arc direction is chosen so it actually passes through `through`.
// `bufferDeg` extends the arc past `start` and `end` by that many degrees,
// away from `through` on both ends — useful when the visual cue is the
// tangent/anchor points and a tail past them keeps the arc from looking
// truncated.
//
void Arc(
    pair center,
    pair start,
    pair through,
    pair end,
    real bufferDeg = 0,
    pen color = black)
{
    real r = abs(start - center);
    real a0 = degrees(start - center);
    real a1 = degrees(through - center);
    real a2 = degrees(end - center);

    // Normalise a1 and a2 into the CCW interval starting at a0 so we can
    // compare which of `through` and `end` we'd hit first walking CCW from `start`.
    while (a1 < a0) a1 += 360;
    while (a2 < a0) a2 += 360;

    if (a1 < a2) {
        // CCW from start hits through, then end — draw CCW with buffer on both ends.
        draw(arc(center, r, a0 - bufferDeg, a2 + bufferDeg), color);
    } else {
        // CCW from start would hit end first, so the path through `through` is the
        // CW one. Swap the endpoint roles: redraw CCW starting from `end`, which
        // now reaches `through` before reaching `start`.
        real b0 = degrees(end - center);
        real b2 = degrees(start - center);
        while (b2 < b0) b2 += 360;
        draw(arc(center, r, b0 - bufferDeg, b2 + bufferDeg), color);
    }
}

//
// Draws a single coloured-fill black-outlined dot at point P.
//
// Used global variables: vertexDotRadius, vertexPen
//
void VertexDot(
    pair P,
    pen fillColor = Blue,
    real radius = vertexDotRadius)
{
    // Fill the disc, then outline it
    fill(circle(P, radius), fillColor);
    draw(circle(P, radius), vertexPen);
}

//
// Draws the same dot at every given point. Pass `fillColor` to recolour all of them.
//
// Used global variables: vertexDotRadius
//
void VertexDots(
    pair[] points,
    pen fillColor = Blue,
    real radius = vertexDotRadius)
{
    for (pair P : points) VertexDot(P, fillColor, radius);
}

//
// Places "$name$" near point P with an optional compass alignment (e.g. N, SE).
// `distanceOffset` shifts the label outward along alignDir; `offset` nudges in
// absolute coords for the rare case the compass directions aren't enough. Pass
// `halo = true` to paint a white ellipse behind the text so it stays readable
// when it overlaps a circle, line, or hatched fill; `haloPad` scales the
// ellipse relative to the text's bounding box (1.0 ≈ inscribed in bbox, ~1.3
// clears the letter's corners cleanly, ~sqrt(2) ≈ circumscribed).
//
// Used global variables: pointLabelDistance
//
void PointLabel(
    pair P,
    string name,
    pair alignDir = (0, 0),
    real distanceOffset = pointLabelDistance,
    pair offset = (0, 0),
    pen color = Blue,
    bool halo = false,
    real haloPad = pointLabelHaloPad)
{
    // Start from the anchor with the absolute offset applied
    pair pos = P + offset;

    // Push outward along the compass direction, if one was given
    if (alignDir != (0, 0)) pos += distanceOffset * unit(alignDir);

    // Pre-render the label into a throwaway picture/frame at the origin with
    // the SAME align — `lpic.fit()` returns a frame whose min/max are in PT
    // (true size), so the halo sizes itself against the label's actual bbox
    // regardless of the figure's unitsize. Compose the white ellipse and the
    // label into one frame, then place that frame at the user position `pos`
    // so both render in true size together — using min/max(lpic) directly
    // would mix user-coord scales between lpic and currentpicture.
    if (halo) {
        picture lpic;
        label(lpic, "$" + name + "$", (0, 0), alignDir, color);
        frame lframe = lpic.fit();
        pair fmin = min(lframe);
        pair fmax = max(lframe);
        pair haloCenter = (fmin + fmax) / 2;
        pair haloAxes = (fmax - fmin) / 2 * haloPad;

        frame composite;
        fill(composite, shift(haloCenter) * scale(haloAxes.x, haloAxes.y) * unitcircle, white);
        add(composite, lframe);
        add(currentpicture, composite, pos);
    } else {
        // Render the LaTeX-wrapped name at that position
        label("$" + name + "$", pos, alignDir, color);
    }
}

//
// Draws a vertex dot at P plus its "$name$" label, both in the same colour.
// Replaces the VertexDot + PointLabel pair that appears for every named point.
// `halo` / `haloPad` forward to PointLabel; see its docstring.
//
// Used global variables: pointLabelDistance
//
void LabeledDot(
    pair P,
    string name,
    pair alignDir = (0, 0),
    real distanceOffset = pointLabelDistance,
    pair offset = (0, 0),
    pen color = Blue,
    bool halo = false,
    real haloPad = pointLabelHaloPad)
{
    // Label first, dot second: when halo is on, the ellipse can extend back
    // toward P, and painting the dot last keeps it visible above the halo.
    PointLabel(P, name, alignDir, distanceOffset, offset, color, halo, haloPad);
    VertexDot(P, color);
}

//
// Draws a right-angle indicator at vertex O with perpendicular rays toward A and B.
// `radius` is the distance from O to the outer corner, matching AngleMark's
// `radius` so the two scale together when sharing Radius3. Filled by default
// (pass a `Light*` pen for `color` so the L reads softly); pass filled=false
// for the bare L-shape stroke.
//
// Used global variables: Radius3, edgePen
//
void RightAngleMark(
    pair A,
    pair O,
    pair B,
    real radius = Radius3,
    pen color = LightBlue,
    bool filled = true)
{
    // Leg length so the outer corner sits at distance `radius` from O
    real legLen = radius * sqrt(2) / 2;

    // Three corners of the right-angle quadrilateral (the fourth is O itself)
    pair p1 = O + legLen * unit(A - O);
    pair p2 = p1 + legLen * unit(B - O);
    pair p3 = O + legLen * unit(B - O);

    // Fill the L-shape or just stroke its outline
    if (filled) {
        fill(O -- p1 -- p2 -- p3 -- cycle, color);
    } else {
        draw(p1 -- p2 -- p3, edgePen);
    }
}

//
// Places "$name$" near the midpoint of segment AB. `alignDir` (compass: N, S,
// E, W, …) both nudges the position `distanceOffset` units off the segment AND
// aligns the label box on that side, so it reads cleanly. `placement` shifts
// away from the midpoint as a parametric position in 0..1. `fontScale` picks a
// font tier (Font1..Font5); default matches the 13pt set by defaultpen.
//
// Used global variables: edgeLabelDistance
//
void EdgeLabel(
    pair A,
    pair B,
    string name,
    pair alignDir = (0, 0),
    real distanceOffset = edgeLabelDistance,
    real placement = 0.5,
    pen color = black,
    pen fontScale = Font3)
{
    // Start from the parametric position along AB
    pair pos = A + placement * (B - A);

    // Push perpendicular off the segment if a compass direction was given
    if (alignDir != (0, 0)) pos += distanceOffset * unit(alignDir);

    // Render the LaTeX-wrapped name there
    label("$" + name + "$", pos, alignDir, color + fontScale);
}

//
// Draws `count` short ticks along segment AB centred at parametric position
// `placement`, each rotated `parallelMarkAngle` from the segment direction.
//
// Used global variables: parallelMarkLength, parallelMarkSpacing, parallelMarkAngle
//
void ParallelMark(
    pair A,
    pair B,
    int count = 2,
    real placement = 0.5,
    pen color = edgePen)
{
    // Unit vector along AB and the centre of the tick group
    pair u = unit(B - A);
    pair mid = A + placement * (B - A);

    // Tick direction, plus precomputed half-length and offset start
    pair tickDir = rotate(parallelMarkAngle) * u;
    real half = parallelMarkLength / 2;
    real start = -(count - 1) / 2.0;

    // Draw each tick centred on a point spaced parallelMarkSpacing along AB
    for (int i = 0; i < count; ++i) {
        pair c = mid + (start + i) * parallelMarkSpacing * u;
        draw((c - half * tickDir) -- (c + half * tickDir), color);
    }
}
