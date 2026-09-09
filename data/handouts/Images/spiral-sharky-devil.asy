import _common;

// A sits well left of the top so the triangle is clearly scalene: the
// Sharky-Devil point S lands on the arc near A, and only a large gap between
// |AB| and |AC| pushes it away from A.
real R = 78;
real alpha = 35;
real angleA = 118;

pair O = (0, 0);
pair A = Polar(O, angleA, R);
pair B = Polar(O, 180 + alpha, R);
pair C = Polar(O, 360 - alpha, R);

pair I = Incenter(A, B, C);
pair D = Foot(I, B, C);
pair E = Foot(I, C, A);
pair F = Foot(I, A, B);
real inradius = abs(I - D);

// Circle (AEF) has diameter AI, since the tangency points see AI at a right
// angle. Its other common point with the circumcircle is the mirror image of
// A across the line of centres.
pair AIcenter = Midpoint(A, I);
pair S = ReflectAcross(A, O, AIcenter);

// The midpoint of arc BC not containing A: the bisector from A leaves the
// circumcircle again there, i.e. the far hit when walking from A through I.
pair N = LineCircleIntersections(A, I, O, R)[1];

Circle(O, R, LightBlue);
Circle(I, inradius, LightBlue);
Circle(AIcenter, abs(A - I) / 2, LightBlue);

Draw(A, B);
Draw(B, C);
Draw(C, A);
Draw(S, N);

LabeledDot(A, "A", NW);
LabeledDot(B, "B", SW);
LabeledDot(C, "C", SE);
LabeledDot(D, "D", SW);
LabeledDot(E, "E", NE);
LabeledDot(F, "F", W);
LabeledDot(S, "S", W);
LabeledDot(N, "N", (0, -1));
