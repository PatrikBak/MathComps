import _common;

real s = 240;
real angleA = 30;
real angleB = 45;
real factorC = 2;

pair A = (0, 0);
pair B = (s, 0);

pair T = extension(A, A + dir(angleA), B, B + dir(180 - angleB));
pair C = A + factorC * (T - A);
pair Z = Foot(C, B, T);
pair M = extension(C, Z, A, B);
pair R = Polar(A, angleA, length(M - A));
pair D = extension(M, R, B, B + dir(180 - angleB));

real r = Radius3;
pen p = Font2;

AngleMark(B, A, C, LightRed, "30^\circ", radius = r, labelFraction = 1.5, labelPen = p);
AngleMark(D, B, A, LightBlue, "45^\circ", radius = r, labelFraction = 1.5, labelPen = p);
AngleMark(D, T, R, LightPurple, "75^\circ", radius = r, labelFraction = 1.5, labelPen = p);
AngleMark(A, R, M, LightPurple, "75^\circ", radius = r, labelFraction = 1.5, labelPen = p);
AngleMark(R, D, T, LightPink, "30^\circ", radius = Radius4, labelFraction = 1.5, labelPen = p);
RightAngleMark(C, Z, B, color = LightGreen, radius = Radius2);

Draw(A, B);
Draw(B, C);
Draw(C, D);
Draw(D, A);
Draw(A, C);
Draw(B, D);
Draw(C, M);
Draw(M, D);

LabeledDot(A, "A", SW);
LabeledDot(B, "B", SE);
LabeledDot(C, "C", NE);
LabeledDot(D, "D", NW);
LabeledDot(T, "T", N);
LabeledDot(R, "R", W, offset=(-2,3));
LabeledDot(M, "M", S);
LabeledDot(Z, "Z", N);
