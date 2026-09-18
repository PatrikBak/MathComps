include "spiral-definition-shared.asy";

real phi = 70;
real k = 1.5;

transform layout = rotate(30);
pair A = layout * A;
pair B = layout * B;

pair Ap = SpiralImage(A, phi, k);
pair Bp = SpiralImage(B, phi, k);

AngleMark(A, O, Ap, LightBlue, "\phi", radius = Radius4, labelFraction = 1, labelOffset = 8, labelPen = Blue);
AngleMark(B, O, Bp, Blue, "\phi", radius = Radius2, labelFraction = 1, labelOffset = 8, labelPen = DarkBlue);

Draw(A, B, Green);
Draw(Ap, Bp, Red);

DashedDraw(O, A);
DashedDraw(O, B);
DashedDraw(O, Ap);
DashedDraw(O, Bp);

LabeledDot(O, "O", S, 3);
LabeledDot(A, "A", E, offset = (-6.4, -7.7));
LabeledDot(B, "B", N);
LabeledDot(Ap, "A'", N);
LabeledDot(Bp, "B'", NW, 1, offset = (3.4, -2.1));
