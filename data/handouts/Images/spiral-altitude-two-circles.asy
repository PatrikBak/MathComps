import _common;

real lenBC = 146;
real angleB = 64;
real angleC = 33;

// The secant through D leaves each circle on the side where that circle's
// centre projects, so X and Y land on opposite sides of D exactly when the
// direction lies between the normals of DO1 and DO2, at 180 - angleB + 90
// and angleC + 90. This direction sits near the steep end of that wedge, so
// |DX| and |DY| differ and the midpoint M' of XY lands above BC, clear of
// both D and M.
real secantAngleDeg = 135;

pair B = (0, 0);
pair C = (lenBC, 0);

// |BD| tan(angleB) = |DC| tan(angleC) = altitude, with |BD| + |DC| = lenBC.
real footFromB = lenBC * tan(radians(angleC)) / (tan(radians(angleB)) + tan(radians(angleC)));
real altitude = footFromB * tan(radians(angleB));

pair D = (footFromB, 0);
pair A = (footFromB, altitude);

// D lies on BC and AD perp BC, so angle ADB = angle ADC = 90 deg; by Thales,
// D sits on the circle with diameter AB (resp. AC) -- that circle IS (ABD)
// (resp. (ACD)), so no separate circumcenter computation is needed.
pair O1 = Midpoint(A, B);
real r1 = abs(A - B) / 2;
pair O2 = Midpoint(A, C);
real r2 = abs(A - C) / 2;

pair secantDir = dir(secantAngleDeg);

// D already lies on both circles, so the secant's second intersection with
// each one is the point-reflection of D through the foot of that circle's
// center on the line -- the foot of a chord's perpendicular bisects it.
pair X = 2 * Foot(O1, D, D + secantDir) - D;
pair Y = 2 * Foot(O2, D, D + secantDir) - D;

pair M = Midpoint(B, C);
pair Mp = Midpoint(X, Y);

Circle(O1, r1, LightBlue);
Circle(O2, r2, LightBlue);
CircleThrough(A, D, M, LightBlue);

RightAngleMark(A, Mp, M, Radius1, LightBlue);

Draw(X, Y, Green);
Draw(B, C, Red);

Draw(A, D);
Draw(A, B);
Draw(A, C);
Draw(A, X);
Draw(A, Y);
Draw(A, Mp);
Draw(M, Mp);

LabeledDot(A, "A", N);
LabeledDot(B, "B", SW);
LabeledDot(C, "C", SE);
LabeledDot(D, "D", (-0.3, -1));
LabeledDot(X, "X", W);
LabeledDot(Y, "Y", S);
LabeledDot(M, "M", S);
LabeledDot(Mp, "M'", S, (-5,2));
