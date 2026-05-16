import _common;

real base = 75;
pair B = (0, 0);
pair C = (base, 0);
pair A = (base / 2, base * sqrt(3) / 2);

Draw(B, C);
Draw(B, A);
Draw(A, C);

LabeledDot(B, "B", SW);
LabeledDot(A, "A", N);
LabeledDot(C, "C", SE);
