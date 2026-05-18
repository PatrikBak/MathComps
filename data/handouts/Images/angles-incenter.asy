import _common;

real R = 80;

pair A = R * dir(100);
pair B = R * dir(215);
pair C = R * dir(325);

pair dirB = unit(A - B) + unit(C - B);
pair dirC = unit(A - C) + unit(B - C);

pair I = extension(B, B + dirB, C, C + dirC);
real r = abs(I - Foot(I, B, C));

Circle(I, r, LightBlue);

DashDotDraw(A, I, Green);
DashDotDraw(B, I, Red);
DashDotDraw(C, I, Red);

Draw(A, B);
Draw(B, C);
Draw(C, A);

LabeledDot(A, "A", N);
LabeledDot(B, "B", SW);
LabeledDot(C, "C", SE);
LabeledDot(I, "I", S);
