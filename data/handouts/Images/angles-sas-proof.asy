import _common;

real base = 100, legC = 72, alpha = 65;
pair A = (0, 0);
pair B = (base, 0);
pair C = Polar(A, alpha, legC);
pair Cp = Polar(A, -alpha, legC);

Circle(A, legC, Blue);

AngleMark(B, A, C, LightRed);
AngleMark(Cp, A, B, Red);

Draw(A, B, Green);
Draw(A, C, Blue);
Draw(A, Cp, Blue);
Draw(C, B, black + dashedPen);

LabeledDot(A, "A", W, Blue);
LabeledDot(B, "B", E, Red);
LabeledDot(C, "C", N, Green);
LabeledDot(Cp, "C'", S, Green);

EdgeLabel(A, C, "c", W, color = Blue, distanceOffset = 8);
EdgeLabel(A, Cp, "c", W, color = Blue, distanceOffset = 8);
