import _common;

// Shrink the figure relative to _common's 1pt-per-unit default so it doesn't
// dominate the handout column. Line widths and hatch spacing are absolute,
// so they keep their proportions when the geometry scales down.
unitsize(0.65pt);

// Center-circle radius — sets the overall figure scale.
real rC = 30;

// Tangent-point angles on the center circle (degrees, CCW from +x), one per
// inner segment. Perturbed off the cardinal axes (90/0/270/180) for asymmetry.
real aT = 95;
real aR = -10;
real aB = 268;
real aL = 172;

// Distance from each inner-cell vertex along its outward bisector to the
// corresponding corner circle's center. Top distances stay short and the
// bottom-right stretches the furthest — that's what makes the top edge short,
// the bottom edge long, and the top-left vertex pulled inward.
real dNW = 22;
real dNE = 32;
real dSE = 75;
real dSW = 55;

// Center circle anchored at the origin.
pair OC = (0, 0);

// Tangent point on the center circle for each inner segment.
pair tT = Polar(OC, aT, rC);
pair tR = Polar(OC, aR, rC);
pair tB = Polar(OC, aB, rC);
pair tL = Polar(OC, aL, rC);

// Direction of each inner segment — perpendicular to the radius at the tangent point.
pair vT = dir(aT + 90);
pair vR = dir(aR + 90);
pair vB = dir(aB + 90);
pair vL = dir(aL + 90);

// Inner-cell vertices: pairwise intersections of adjacent inner segments.
pair vNE = extension(tT, tT + vT, tR, tR + vR);
pair vSE = extension(tR, tR + vR, tB, tB + vB);
pair vSW = extension(tB, tB + vB, tL, tL + vL);
pair vNW = extension(tL, tL + vL, tT, tT + vT);

// Outward angle-bisector direction at each inner-cell vertex: sum of the two
// unit vectors along the bounding inner segments pointing AWAY from the
// adjacent inner-cell vertices (i.e. away from the central cell). Any point
// on this ray is equidistant from both bounding inner segments.
pair bisNW = unit(unit(vNW - vNE) + unit(vNW - vSW));
pair bisNE = unit(unit(vNE - vNW) + unit(vNE - vSE));
pair bisSE = unit(unit(vSE - vNE) + unit(vSE - vSW));
pair bisSW = unit(unit(vSW - vSE) + unit(vSW - vNW));

// Corner circle centers, placed along their outward bisectors.
pair ONW = vNW + dNW * bisNW;
pair ONE = vNE + dNE * bisNE;
pair OSE = vSE + dSE * bisSE;
pair OSW = vSW + dSW * bisSW;

// Each corner circle's radius equals its center's perpendicular distance to
// either bounding inner segment — tangency to both is then automatic.
real rNW = abs(ONW - Foot(ONW, tT, tT + vT));
real rNE = abs(ONE - Foot(ONE, tT, tT + vT));
real rSE = abs(OSE - Foot(OSE, tB, tB + vB));
real rSW = abs(OSW - Foot(OSW, tB, tB + vB));

// Outer-boundary edges: each is the common external tangent of the two
// adjacent corner circles, on the outside (away from OC).
pair[] outTop = CommonExternalTangentAwayFrom(ONW, rNW, ONE, rNE, OC);
pair[] outRight = CommonExternalTangentAwayFrom(ONE, rNE, OSE, rSE, OC);
pair[] outBottom = CommonExternalTangentAwayFrom(OSE, rSE, OSW, rSW, OC);
pair[] outLeft = CommonExternalTangentAwayFrom(OSW, rSW, ONW, rNW, OC);

// Outer quadrilateral vertices: intersections of adjacent outer edges.
pair cornerNW = extension(outTop[0], outTop[1], outLeft[0], outLeft[1]);
pair cornerNE = extension(outTop[0], outTop[1], outRight[0], outRight[1]);
pair cornerSE = extension(outBottom[0], outBottom[1], outRight[0], outRight[1]);
pair cornerSW = extension(outBottom[0], outBottom[1], outLeft[0], outLeft[1]);

// Inner-segment endpoints — clipped to where each segment meets the outer
// boundary. Top/bottom inner segments span LEFT outer edge to RIGHT outer edge;
// left/right inner segments span TOP outer edge to BOTTOM outer edge.
pair tTleft = extension(tT, tT + vT, cornerNW, cornerSW);
pair tTright = extension(tT, tT + vT, cornerNE, cornerSE);
pair tBleft = extension(tB, tB + vB, cornerNW, cornerSW);
pair tBright = extension(tB, tB + vB, cornerNE, cornerSE);
pair tLtop = extension(tL, tL + vL, cornerNW, cornerNE);
pair tLbot = extension(tL, tL + vL, cornerSW, cornerSE);
pair tRtop = extension(tR, tR + vR, cornerNW, cornerNE);
pair tRbot = extension(tR, tR + vR, cornerSW, cornerSE);

// Five tangential cells (the "checkerboard" pattern: four corners + center).
path cellNW = cornerNW -- tTleft -- vNW -- tLtop -- cycle;
path cellNE = cornerNE -- tTright -- vNE -- tRtop -- cycle;
path cellSE = cornerSE -- tBright -- vSE -- tRbot -- cycle;
path cellSW = cornerSW -- tBleft -- vSW -- tLbot -- cycle;
path cellC = vNW -- vNE -- vSE -- vSW -- cycle;

// Shade those five cells with diagonal hatching — left running through the
// circle interiors too, so each circle reads as a stroked outline over the
// cell's continuous hatching rather than a white disc.
fill(cellNW, HatchedFill);
fill(cellNE, HatchedFill);
fill(cellSE, HatchedFill);
fill(cellSW, HatchedFill);
fill(cellC, HatchedFill);

// Four inner grid segments running boundary-to-boundary.
Draw(tTleft, tTright);
Draw(tBleft, tBright);
Draw(tLtop, tLbot);
Draw(tRtop, tRbot);

// Outer quadrilateral boundary.
Draw(cornerNW, cornerNE);
Draw(cornerNE, cornerSE);
Draw(cornerSE, cornerSW);
Draw(cornerSW, cornerNW);

// Circle outlines drawn last so the strokes sit cleanly on top of the grid
// segments and outer boundary at each tangent point.
Circle(OC, rC);
Circle(ONW, rNW);
Circle(ONE, rNE);
Circle(OSE, rSE);
Circle(OSW, rSW);
