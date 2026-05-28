import _common;

real R = 80;

pair A = R * dir(100);
pair B = R * dir(215);
pair C = R * dir(325);

pair dirB = unit(A - B) + unit(C - B);
pair dirC = unit(A - C) + unit(B - C);

pair I = extension(B, B + dirB, C, C + dirC);
real r = abs(I - Foot(I, B, C));

pair D = Foot(I, B, C);
pair E = Foot(I, C, A);
pair F = Foot(I, A, B);

Circle(I, r, LightBlue);

Draw(A, F, Green);
Draw(A, E, Green);
Draw(B, F, Red);
Draw(B, D, Red);
Draw(C, D, Purple);
Draw(C, E, Purple);

EdgeLabel(A, F, "s - a", W, color = Green, fontScale = Font2);
// Compass `E` is shadowed by the local pair `E` (tangent point), so pass the
// east unit vector explicitly.
EdgeLabel(A, E, "s - a", (1, 0), color = Green, fontScale = Font2);
EdgeLabel(B, F, "s - b", W, color = Red, fontScale = Font2);
EdgeLabel(B, D, "s - b", S, color = Red, fontScale = Font2);
EdgeLabel(C, D, "s - c", S, color = Purple, fontScale = Font2);
EdgeLabel(C, E, "s - c", (1, 0), color = Purple, fontScale = Font2);

LabeledDot(A, "A", N);
LabeledDot(B, "B", SW);
LabeledDot(C, "C", SE);
LabeledDot(D, "D", S);
LabeledDot(E, "E", NE);
LabeledDot(F, "F", NW);
