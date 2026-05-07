import _common;

real a = 55;
pair B = (0, 0);
pair A = (a, 0);
pair Bp = (2 * a, 0);
pair C = (a, a * sqrt(3));

AngleMark(A, B, C, LightBlue);
RightAngleMark(B, A, C);

Draw(B, A);
Draw(B, C);
Draw(C, A);
Draw(A, Bp);
Draw(Bp, C);

LabeledDot(B, "B", SW);
LabeledDot(C, "C", N);
LabeledDot(Bp, "B'", SE);
LabeledDot(A, "A", S);

EdgeLabel(B, C, "2a", W, distanceOffset = 8);
EdgeLabel(C, Bp, "2a", E, distanceOffset = 8);
EdgeLabel(B, A, "a", S, distanceOffset = 8);
EdgeLabel(A, Bp, "a", S, distanceOffset = 8);
