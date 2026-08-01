import _common;

real R = 42;
real angleA = 172;
real angleB = 58;
real angleC = 206;
real angleD = 310;

pair O = (0, 0);
pair A = Polar(O, angleA, R);
pair B = Polar(O, angleB, R);
pair C = Polar(O, angleC, R);
pair D = Polar(O, angleD, R);
pair P = extension(A, B, C, D);

Circle(O, R, LightBlue);

Draw(P, B, Green);
Draw(P, D, Green);

LabeledDot(P, "P", W);
LabeledDot(A, "A", NW);
LabeledDot(B, "B", NE);
LabeledDot(C, "C", SW);
LabeledDot(D, "D", SE);
