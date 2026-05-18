import _common;

pair A = (10, 75);
pair B = (-30, -20);
pair C = (35, -20);

pair Y = ExtendPast(A, B, 55);
pair X = ExtendPast(A, C, 55);

pair dirA = unit(B - A) + unit(C - A);
pair dirBext = unit(B - A) + unit(C - B);

pair Ia = extension(A, A + dirA, B, B + dirBext);
real ra = abs(Ia - Foot(Ia, B, C));

Circle(Ia, ra, LightBlue);

DashDotDraw(A, Ia, Red);
DashDotDraw(B, Ia, Green);
DashDotDraw(C, Ia, Green);

Draw(A, B);
Draw(B, C);
Draw(C, A);

Draw(B, Y, vertexPen);
Draw(C, X, vertexPen);

LabeledDot(A, "A", N);
LabeledDot(B, "B", NW);
LabeledDot(C, "C", NE);
LabeledDot(Y, "Y", SW);
LabeledDot(X, "X", SE);
LabeledDot(Ia, "I_a", W);
