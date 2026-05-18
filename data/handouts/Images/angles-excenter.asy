import _common;

real apexX = 10;
real apexY = 75;
real leftX = -30;
real rightX = 35;
real baseY = -20;
real extensionLength = 55;

pair A = (apexX, apexY);
pair B = (leftX, baseY);
pair C = (rightX, baseY);

pair Y = ExtendPast(A, B, extensionLength);
pair X = ExtendPast(A, C, extensionLength);

pair dirA = unit(B - A) + unit(C - A);
pair dirBext = unit(B - A) + unit(C - B);

pair Ia = extension(A, A + dirA, B, B + dirBext);
real ra = abs(Ia - Foot(Ia, B, C));

Circle(Ia, ra, LightBlue);

Draw(A, Ia, Red + dashedPen);
Draw(B, Ia, Green + dashedPen);
Draw(C, Ia, Green + dashedPen);

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
