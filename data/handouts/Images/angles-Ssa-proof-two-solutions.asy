import _common;

// Both quadratic roots are positive when swingR < base and α is small enough,
// giving the two-solution case.
real base = 110, swingR = 65, alpha = 35, farExtra = 50;
pair B = (0, 0);
pair C = (base, 0);
real cA = cos(radians(alpha));
real disc = sqrt((base * cA)^2 - (base^2 - swingR^2));
real BAfar = base * cA + disc;
real BAnear = base * cA - disc;
pair A = Polar(B, alpha, BAfar);
pair Ap = Polar(B, alpha, BAnear);
pair Bfar = ExtendPast(B, A, farExtra);

AngleMark(C, B, A, LightRed, "\beta", labelPen = Red);

Circle(C, swingR, Red);
Draw(B, C, Blue);
Draw(C, A, Red);
Draw(C, Ap, Red);
Draw(B, A);
Draw(A, Bfar);

LabeledDot(B, "B", SW);
LabeledDot(C, "C", SE);
LabeledDot(A, "A", N);
LabeledDot(Ap, "A'", NW);

EdgeLabel(B, C, "a", S, color = Blue);
EdgeLabel(C, A, "b", NE, color = Red);
EdgeLabel(C, Ap, "b", SW, color = Red);
