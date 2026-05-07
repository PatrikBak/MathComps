import _common;

// A on ray from B at angle alpha at the unique forward intersection with
// circle(C, swingR). Law of cosines on triangle BCA gives:
// |BA|² − 2·base·cos(α)·|BA| + (base² − swingR²) = 0.
// Since swingR > base, B is inside the circle and only the positive root
// corresponds to a forward intersection.
real base = 40, swingR = 58, alpha = 45;
pair B = (0, 0);
pair C = (base, 0);
real cA = cos(radians(alpha));
real BA = base * cA + sqrt((base * cA)^2 - (base^2 - swingR^2));
pair A = Polar(B, alpha, BA);

AngleMark(C, B, A, LightRed, "\beta", labelPen = Red);

Circle(C, swingR, Red);
Draw(B, C, Blue);
Draw(C, A, Red);
Draw(B, A);

LabeledDot(B, "B", SW);
LabeledDot(C, "C", SE);
LabeledDot(A, "A", NE, Red);

EdgeLabel(B, C, "a", S, color = Blue);
EdgeLabel(C, A, "b", E, color = Red);
