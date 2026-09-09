import _common;

// B at the origin, C on the positive x-axis, so "perpendicular to BC" below
// is simply "vertical", and "AQ perp BC" is simply "same x-coordinate as A".
real lenBC = 110;
real footFracA = 0.18;
real heightA = 121;
real ratioBE = 0.35;   // E = B + ratioBE * (A - B)
real axisProbeLength = 60; // arbitrary positive length; only sets a direction below

pair B = (0, 0);
pair C = (lenBC, 0);
pair A = (footFracA * lenBC, heightA);
pair M = Midpoint(B, C);
pair E = B + ratioBE * (A - B);

// Circle (MEF) is tangent to BC at M (M lies on both the circle and the
// line), so its centre sits on the perpendicular to BC at M -- here just
// the vertical through M -- and, being a centre, it is also equidistant
// from M and E, i.e. on ME's perpendicular bisector.
pair O = extension(M, M + N, Midpoint(M, E), Midpoint(M, E) + rotate(90) * (E - M));
real rMEF = abs(O - M);

// F is the second point where this circle meets line AC; the nearer root
// sits just off A, on the sliver the circle barely clips there, and isn't
// the intended construction.
pair[] Fcands = LineCircleIntersections(A, C, O, rMEF);
pair F = abs(Fcands[0] - A) > abs(Fcands[1] - A) ? Fcands[0] : Fcands[1];

pair D = Midpoint(E, F);
pair R = extension(E, F, B, C);

pair Oaef = Circumcenter(A, E, F);
real rAEF = abs(Oaef - A);
pair Oabc = Circumcenter(A, B, C);
real rABC = abs(Oabc - A);

// P is the second intersection of (AEF) and (ABC) -- the problem's own
// definition -- found by meeting (AEF) with the radical axis, the line
// through both circles' intersection points.
real centerDist = abs(Oabc - Oaef);
pair centerDir = (Oabc - Oaef) / centerDist;
real radAxisFootDist = (rAEF * rAEF - rABC * rABC + centerDist * centerDist) / (2 * centerDist);
pair radAxisFoot = Oaef + radAxisFootDist * centerDir;
pair radAxisDir = rotate(90) * centerDir;
pair[] Pcands = LineCircleIntersections(
    radAxisFoot - axisProbeLength * radAxisDir,
    radAxisFoot + axisProbeLength * radAxisDir,
    Oaef, rAEF);
pair P = OtherIntersection(Pcands, A);

// Q is the second point where the vertical through A (AQ perp BC) meets (AEF).
pair[] Qcands = LineCircleIntersections(A, A + N, Oaef, rAEF);
pair Q = OtherIntersection(Qcands, A);

// D and M see OR at a right angle (the two RightAngleMarks below), so by
// Thales they lie on the circle with diameter OR; the solution's point is
// that P lies on it as well.
pair centerOR = Midpoint(O, R);
real radiusOR = abs(O - R) / 2;

RightAngleMark(O, M, R, radius = Radius1);
RightAngleMark(O, D, E, radius = Radius1);
RightAngleMark(O, P, R, radius = Radius1);

Circle(Oabc, rABC, LightBlue);
Circle(Oaef, rAEF, LightBlue);
Circle(O, rMEF, LightBlue);
Circle(centerOR, radiusOR, LightPurple);

DashedDraw(P, Q, Purple);
Draw(E, F, Green);
Draw(B, C, Red);

Draw(A, B);
Draw(A, C);
Draw(F, R);
Draw(C, R);
Draw(O, M);
Draw(O, D);
Draw(A, Q);
Draw(P, E, vertexPen);
Draw(P, R, vertexPen);

// Point E shadows the compass constant; no label below needs east.
LabeledDot(A, "A", N);
LabeledDot(B, "B", SW);
LabeledDot(C, "C", S);
LabeledDot(M, "M", SW);
LabeledDot(R, "R", S);
LabeledDot(E, "E", W);
LabeledDot(F, "F", N, distanceOffset = 5);
LabeledDot(O, "O", NW, (-3,-3),distanceOffset=-2);
LabeledDot(D, "D", (-1, -0.35), distanceOffset = 4);
LabeledDot(P, "P", (1, 0.6), distanceOffset = 5);
LabeledDot(Q, "Q", S, (1,0), halo = true);
