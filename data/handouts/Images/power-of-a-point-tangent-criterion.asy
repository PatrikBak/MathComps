import _common;

real lenPA = 56;
real lenAB = 78;
real tangentAngle = 42;
real pastB = 16;
real pastT = 16;

pair P = (0, 0);
pair A = Polar(P, 0, lenPA);
pair B = Polar(P, 0, lenPA + lenAB);

// T is placed so that |PT|^2 = |PA| * |PB| holds by construction, which is
// exactly the hypothesis of the criterion — the circle (TAB) then touches PT
// at T, rather than the figure having to be fitted to a chosen circle.
pair T = Polar(P, tangentAngle, sqrt(lenPA * (lenPA + lenAB)));

pair O = Circumcenter(T, A, B);
real R = abs(A - O);

Circle(O, R, LightBlue);

Draw(P, ExtendPast(A, B, pastB), Green);
Draw(P, ExtendPast(P, T, pastT), Green);

LabeledDot(P, "P", W);
LabeledDot(A, "A", S);
LabeledDot(B, "B", SE);
LabeledDot(T, "T", NW);
