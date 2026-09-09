include "spiral-definition-shared.asy";

real k = 1.35;

pair Ap = SpiralImage(A, 0, k);
pair Bp = SpiralImage(B, 0, k);

Draw(A, B, Green);
Draw(Ap, Bp, Red);

DashedDraw(O, Ap);
DashedDraw(O, Bp);

LabeledDot(O, "O", W, 4);
LabeledDot(A, "A", S);
LabeledDot(B, "B", N);
LabeledDot(Ap, "A'", S);
LabeledDot(Bp, "B'", N);
