include "spiral-definition-shared.asy";

real phi = 60;

// The same layout turn as spiral-definition.asy, so the series shares one orientation.
transform layout = rotate(30);
pair A = layout * A;
pair B = layout * B;

pair Ap = SpiralImage(A, phi, 1);
pair Bp = SpiralImage(B, phi, 1);

AngleMark(A, O, Ap, LightBlue, radius = Radius3);
AngleMark(B, O, Bp, LightPurple, radius = Radius2);

// The paths A and B travel under the rotation: arcs about O through the
// midway direction.
Arc(O, A, SpiralImage(A, phi / 2, 1), Ap, 0, LightBlue, true);
Arc(O, B, SpiralImage(B, phi / 2, 1), Bp, 0, LightBlue, true);

Draw(A, B, Green);
Draw(Ap, Bp, Red);

DashedDraw(O, A);
DashedDraw(O, B);
DashedDraw(O, Ap);
DashedDraw(O, Bp);

LabeledDot(O, "O", S, 4);
LabeledDot(A, "A", S);
LabeledDot(B, "B", E);
LabeledDot(Ap, "A'", N);
LabeledDot(Bp, "B'", NW);
