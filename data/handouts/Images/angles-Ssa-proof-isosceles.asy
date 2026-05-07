import _common;

// Isosceles BCA with |CB| = |CA| = base; angle ABC = alpha. Apex angle at C
// equals 180 − 2α, so from C (with B at direction 180°) point A sits at
// direction 2α (CCW from +x).
real base = 50, alpha = 40, farExtra = 35;
pair B = (0, 0);
pair C = (base, 0);
real swingR = base;
pair A = Polar(C, 2 * alpha, swingR);
pair Bfar = ExtendPast(B, A, farExtra);

AngleMark(C, B, A, LightRed, "\beta", labelPen = Red);

Circle(C, swingR, Red);
Draw(B, C, Blue);
Draw(C, A, Red);
Draw(B, Bfar);

LabeledDot(B, "B", SW);
LabeledDot(C, "C", SE);
LabeledDot(A, "A", N, Red);

EdgeLabel(B, C, "a", S, color = Blue);
EdgeLabel(C, A, "b", E, color = Red);
