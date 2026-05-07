import _common;

real base = 72, alphaB = 85, gammaC = 55, extra = 65;
pair B = (0, 0);
pair C = (base, 0);
pair A = extension(B, Polar(B, alphaB, 1), C, Polar(C, 180 - gammaC, 1));
pair Bottom_right = ExtendPast(B, C, extra);

AngleMark(B, A, C, LightRed, "\alpha");
AngleMark(C, B, A, LightGreen, "\beta");
AngleMark(Bottom_right, C, A, LightBlue, "?");

Draw(A, B);
Draw(A, C);
Draw(B, Bottom_right);

LabeledDot(A, "A", N);
LabeledDot(B, "B", SW);
LabeledDot(C, "C", SE);
