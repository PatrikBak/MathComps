import _common;

real R = 42;
real angleA = 160;
real angleB = 320;
real angleC = 230;
real angleD = 60;

pair O = (0, 0);
pair A = Polar(O, angleA, R);
pair B = Polar(O, angleB, R);
pair C = Polar(O, angleC, R);
pair D = Polar(O, angleD, R);
pair P = extension(A, B, C, D);

Circle(O, R, LightBlue);

Draw(A, B, Green);
Draw(C, D, Green);

LabeledDot(P, "P", N);
LabeledDot(A, "A", W);
LabeledDot(B, "B", SE);
LabeledDot(C, "C", SW);
LabeledDot(D, "D", NE);
