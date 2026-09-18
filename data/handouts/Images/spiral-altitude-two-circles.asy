import _common;

real lenBC = 160;
real angleB = 64;
real angleC = 33;

// The secant through D leaves each circle on the side where that circle's
// centre projects, so X and Y land on opposite sides of D exactly when the
// direction lies between the normals of DO1 and DO2.
real secantAngleDeg = 136;

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
RightAngleMark(A, D, C, Radius1, LightBlue);

Draw(X, B, Green);
Draw(Y, C, Red);

Draw(A, D);
Draw(A, B);
Draw(A, C);
Draw(X, Y);
Draw(B, C);
Draw(A, Mp);
Draw(A, M);
Draw(M, Mp);

LabeledDot(A, "A", N, offset = (-3.4, -0.8));
LabeledDot(B, "B", SW, 1, offset = (-1.8, 2.7));
LabeledDot(C, "C", SE, 1, offset = (-1.9, 0));
LabeledDot(D, "D", S, offset = (-5.8, 1.6));
LabeledDot(X, "X", W, offset = (7.1, 8.9));
LabeledDot(Y, "Y", SE, 1, offset = (-12.2, -2.6));
LabeledDot(M, "M", S, offset = (3, 3.3));
LabeledDot(Mp, "M'", S, offset = (-7.3, 2.2));
