include "spiral-definition-shared.asy";

real phi = 60;
real k = 1.1;

transform layout = rotate(30);
pair A = layout * A;
pair B = layout * B;

pair Ap = SpiralImage(A, phi, k);
pair Bp = SpiralImage(B, phi, k);

AngleMark(A, O, Ap, LightBlue, radius = Radius3);
AngleMark(B, O, Bp, LightPurple, radius = Radius2);

Draw(A, B, Green);
Draw(Ap, Bp, Red);

DashedDraw(O, A);
DashedDraw(O, B);
DashedDraw(O, Ap);
DashedDraw(O, Bp);

LabeledDot(O, "O", S, 4);
LabeledDot(A, "A", E);
LabeledDot(B, "B", N);
LabeledDot(Ap, "A'", N);
LabeledDot(Bp, "B'", NW);
