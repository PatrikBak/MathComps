import _common;

real leg = 65;
pair A = (0, 0);
pair B = (leg, 0);
pair C = (0, leg);

RightAngleMark(B, A, C);

AngleMark(A, C, B, LightBlue, "\beta");
AngleMark(C, B, A, LightBlue, "\beta");

Draw(A, B);
Draw(C, B);
Draw(C, A);

LabeledDot(A, "A", SW);
LabeledDot(B, "B", SE);
LabeledDot(C, "C", NW);
