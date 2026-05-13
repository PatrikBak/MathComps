import _common;

real a = 55;
pair B  = (0, 0);
pair C  = (a, 0);
pair Bp = (2 * a, 0);
pair A  = (a, a * sqrt(3));

AngleMark(C, B, A, LightBlue);
RightAngleMark(A, C, B);

Draw(B, C);
Draw(B, A);
Draw(A, C);
Draw(C, Bp);
Draw(Bp, A);

LabeledDot(B,  "B",  SW);
LabeledDot(A,  "A",  N);
LabeledDot(Bp, "B'", SE);
LabeledDot(C,  "C",  S);

EdgeLabel(B, A, "2a", W, distanceOffset = 8);
EdgeLabel(A, Bp, "2a", E, distanceOffset = 8);
EdgeLabel(B, C, "a",  S, distanceOffset = 8);
EdgeLabel(C, Bp, "a", S, distanceOffset = 8);
