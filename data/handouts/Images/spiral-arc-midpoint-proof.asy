import _common;

// Same configuration as the statement figure.
real R = 72;
real alpha = 36;
real angleA = 129;
real cutLength = 62;

pair O = (0, 0);
pair A = Polar(O, angleA, R);
pair B = Polar(O, 180 + alpha, R);
pair C = Polar(O, 360 - alpha, R);
pair D = B + cutLength * unit(A - B);
pair E = C + cutLength * unit(A - C);
pair N = Polar(O, 90, R);
pair centerADE = Circumcenter(A, D, E);
real radiusADE = abs(A - centerADE);

// N sees BC under the same angle as A: the rotation about N taking DB to EC
// turns by that angle.
AngleMark(B, A, C, LightGreen, "", Radius2);
AngleMark(B, N, C, LightGreen, "", Radius2);
Circle(O, R, LightBlue);
Circle(centerADE, radiusADE, LightBlue);
Draw(A, B);
Draw(B, C);
Draw(C, A);
Draw(B, D, Red);
Draw(C, E, Red);
Draw(N, D);
Draw(N, B);
Draw(N, E);
Draw(N, C);
ParallelMark(B, D, count = 1, color = Red);
ParallelMark(C, E, count = 1, color = Red);
LabeledDot(A, "A", NW, 1);
LabeledDot(B, "B", SW, 1);
LabeledDot(C, "C", SE, 1);
LabeledDot(D, "D", W);
LabeledDot(E, "E", (1, 0));
LabeledDot(N, "N", (0, 1));
