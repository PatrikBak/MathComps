import _common;

real leg = 65;
real half = leg / sqrt(2);
pair A = (0, half);
pair B = (-half, 0);
pair C = ( half, 0);

RightAngleMark(B, A, C);

AngleMark(A, C, B, LightBlue, "\beta");
AngleMark(C, B, A, LightBlue, "\beta");

Draw(A, B);
Draw(C, B);
Draw(C, A);

LabeledDot(A, "A", N);
LabeledDot(B, "B", SW);
LabeledDot(C, "C", SE);
