import _common;

real lenAD = 131;     // |AD| = |BC|
real angleBC = -40;   // direction of BC off the x-axis, with AD along it
real midBCx = 58;
real midBCy = -116;
real ratioAF = 0.55;

// Built with AD along the x-axis and the quadrilateral hanging below it, which
// lists A, B, C, D counterclockwise; the whole thing is then turned so that AB
// runs horizontally along the bottom.
pair A0 = (0, 0);
pair D0 = (lenAD, 0);
pair bcDir = dir(angleBC);
pair midBC = (midBCx, midBCy);
pair B0 = midBC - (lenAD / 2) * bcDir;
pair C0 = midBC + (lenAD / 2) * bcDir;

real baseAngle = -degrees(B0 - A0);
pair A = rotate(baseAngle) * A0;
pair B = rotate(baseAngle) * B0;
pair C = rotate(baseAngle) * C0;
pair D = rotate(baseAngle) * D0;

pair F = A + ratioAF * (D - A);

// F and E must divide AD and CB by the same ratio from A and from C for
// |DF| = |BE| to hold. Since |AD| = |CB|, that same ratio measured from B
// is 1 - ratioAF, which is what this builds.
real ratioBE = 1 - ratioAF;
pair E = B + ratioBE * (C - B);

pair P = extension(A, C, B, D);
pair Q = extension(B, D, E, F);
pair R = extension(E, F, A, C);

// sigma is the rotation with sigma(A) = C, sigma(D) = B (a pure rotation,
// not a general spiral similarity, since |AD| = |CB|). Its centre S is
// then equidistant from {A, C} and from {B, D}: the intersection of the
// perpendicular bisectors of AC and BD.
pair midAC = Midpoint(A, C);
pair midBD = Midpoint(B, D);
pair S = extension(
    midAC, midAC + rotate(90) * (C - A),
    midBD, midBD + rotate(90) * (D - B));

CircleThrough(A, F, R, LightBlue);
CircleThrough(D, F, Q, LightBlue);
CircleThrough(P, Q, R, LightBlue);

DashedDraw(S, F, Purple);
DashedDraw(S, E, Purple);

Draw(A, D, Green);
Draw(C, B, Red);

Draw(S, R, vertexPen);
Draw(S, Q, vertexPen);

Draw(A, B);
Draw(C, D);
Draw(A, C);
Draw(B, D);
Draw(E, F);

LabeledDot(A, "A", SW);
LabeledDot(B, "B", SE);
LabeledDot(C, "C", NE);
LabeledDot(D, "D", NW);
LabeledDot(E, "E", SE, distanceOffset = 5);
LabeledDot(F, "F", W, distanceOffset = 5);
LabeledDot(P, "P", (-0.4, -1), distanceOffset = 5);
LabeledDot(Q, "Q", SW, distanceOffset = 5);
LabeledDot(R, "R", SE, distanceOffset = 4.5);
LabeledDot(S, "S", (0, 1), distanceOffset = 5);
