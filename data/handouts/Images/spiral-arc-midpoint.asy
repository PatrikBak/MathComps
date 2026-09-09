import _common;

real R = 72;
real alpha = 36;

// A sits well left of the apex so |AB| is visibly shorter than |AC| and the
// equal cuts |BD| = |CE| land at different fractions of their sides.
real angleA = 129;
real cutLength = 62;

pair O = (0, 0);
pair A = Polar(O, angleA, R);
pair B = Polar(O, 180 + alpha, R);
pair C = Polar(O, 360 - alpha, R);
pair D = B + cutLength * unit(A - B);
pair E = C + cutLength * unit(A - C);

// The midpoint of arc BAC is the top of the circumcircle: BC is horizontal
// and below the centre, so the perpendicular bisector of BC meets the circle
// above BC at dir(90).
pair N = Polar(O, 90, R);

pair centerADE = Circumcenter(A, D, E);
real radiusADE = abs(A - centerADE);

Circle(O, R, LightBlue);
Circle(centerADE, radiusADE, LightBlue);

Draw(A, B);
Draw(B, C);
Draw(C, A);
Draw(B, D, Red);
Draw(C, E, Red);
ParallelMark(B, D, count = 1, color = Red);
ParallelMark(C, E, count = 1, color = Red);

LabeledDot(A, "A", NW);
LabeledDot(B, "B", SW);
LabeledDot(C, "C", SE);
LabeledDot(D, "D", W);
LabeledDot(E, "E", (1, 0));
LabeledDot(N, "N", (0, 1));
