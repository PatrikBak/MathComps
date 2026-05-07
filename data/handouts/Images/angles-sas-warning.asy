import _common;

real base = 70, leg = 40, beta = 40, gap = 65;
pair B = (0, 0);
pair C = (base, 0);
pair A = Polar(B, beta, leg);

// A' is the OTHER intersection of ray B'A' with the swing circle around C' of
// radius |C'A'| = |CA|, giving a non-congruent triangle.
pair shift = (base + gap, 0);
pair Bp = B + shift;
pair Cp = C + shift;
real BAp = 2 * base * cos(radians(beta)) - leg;
pair Ap = Polar(Bp, beta, BAp);

AngleMark(C, B, A, LightRed);
AngleMark(Cp, Bp, Ap, LightRed);

Draw(B, C, Green);
Draw(A, C, Red);
Draw(B, A);
Draw(Bp, Cp, Green);
Draw(Ap, Cp, Red);
Draw(Bp, Ap);

LabeledDot(B, "B", SW);
LabeledDot(C, "C", SE);
LabeledDot(A, "A", N);
LabeledDot(Bp, "B'", SW);
LabeledDot(Cp, "C'", SE);
LabeledDot(Ap, "A'", N);
