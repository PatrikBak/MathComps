import _common;

real base = 85, height = 80;
pair B = (0, 0);
pair C = (base, 0);
pair M = Midpoint(B, C);
pair A = (M.x, height);

RightAngleMark(B, M, A, color = LightBlue);

Draw(B, A);
Draw(A, C);
Draw(C, B);
Draw(A, M);

LabeledDot(B, "B", SW);
LabeledDot(A, "A", N);
LabeledDot(C, "C", SE);
LabeledDot(M, "M", S);
