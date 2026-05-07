// Shared setup for handout figures: imported with `import _common;`.

// Latin Modern for label text so figures match the surrounding handout body
texpreamble("\usepackage{lmodern}\usepackage[T1]{fontenc}");

// Basic units
unitsize(1pt);
defaultpen(fontsize(13pt));

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

//
// Line-width tiers. NormalWidth is the default for edges and circles.
//
real ThinWidth = 0.5;
real NormalWidth = 1.0;
real ThickWidth = 1.5;

//
// Standard pens reused by every figure.
//
pen edgePen = black + linewidth(NormalWidth);
pen vertexPen = black + linewidth(ThinWidth);

//
// Dashed linetype for auxiliary segments — combine with a colour, e.g. `Draw(A, B, black + dashedPen)`.
//
pen dashedPen = linetype("3 3", offset=0, scale=false);

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
// Default vertex dot radius
//
real vertexDotRadius = 2.95;

//
// Default shift along alignDir for point labels
//
real pointLabelDistance = 3;

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
// (e.g. Blue) to tint; linewidth is added automatically. To keep extra pen
// attributes such as a linetype, pass a fully-formed pen (e.g. `black + dashedPen`).
//
// Used global variables: NormalWidth
//
void Draw(
    pair A,
    pair B,
    pen color = black)
{
    draw(A -- B, color + linewidth(NormalWidth));
}

//
// Draws a circle with the same edge styling as Draw — same colour-only convention.
//
// Used global variables: NormalWidth
//
void Circle(
    pair center,
    real radius,
    pen color = black)
{
    draw(circle(center, radius), color + linewidth(NormalWidth));
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
// absolute coords for the rare case the compass directions aren't enough.
//
// Used global variables: pointLabelDistance
//
void PointLabel(
    pair P,
    string name,
    pair alignDir = (0, 0),
    real distanceOffset = pointLabelDistance,
    pair offset = (0, 0),
    pen color = Blue)
{
    // Start from the anchor with the absolute offset applied
    pair pos = P + offset;

    // Push outward along the compass direction, if one was given
    if (alignDir != (0, 0)) pos += distanceOffset * unit(alignDir);

    // Render the LaTeX-wrapped name at that position
    label("$" + name + "$", pos, alignDir, color);
}

//
// Draws a vertex dot at P plus its "$name$" label, both in the same colour.
// Replaces the VertexDot + PointLabel pair that appears for every named point.
//
// Used global variables: pointLabelDistance
//
void LabeledDot(
    pair P,
    string name,
    pair alignDir = (0, 0),
    real distanceOffset = pointLabelDistance,
    pair offset = (0, 0),
    pen color = Blue)
{
    // Draw the dot, then the label, using the same colour for both
    VertexDot(P, color);
    PointLabel(P, name, alignDir, distanceOffset, offset, color);
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
// away from the midpoint as a parametric position in 0..1.
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
    pen color = black)
{
    // Start from the parametric position along AB
    pair pos = A + placement * (B - A);

    // Push perpendicular off the segment if a compass direction was given
    if (alignDir != (0, 0)) pos += distanceOffset * unit(alignDir);

    // Render the LaTeX-wrapped name there
    label("$" + name + "$", pos, alignDir, color);
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
