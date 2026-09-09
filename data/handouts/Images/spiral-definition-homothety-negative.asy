include "spiral-definition-shared.asy";

real k = 0.7;

pair Ap = SpiralImage(A, 180, k);
pair Bp = SpiralImage(B, 180, k);

Draw(A, B, Green);
Draw(Ap, Bp, Red);

DashedDraw(Ap, A);
DashedDraw(Bp, B);

LabeledDot(O, "O", N, 4);
LabeledDot(A, "A", S);
LabeledDot(B, "B", N);
LabeledDot(Ap, "A'", N);
LabeledDot(Bp, "B'", S);
