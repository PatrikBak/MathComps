import _common;

// Convex ABCD with AB horizontal. CD is steep on purpose: the closer CD is to
// parallel with AB, the closer the spiral centre O sits to Y.
real lenAB = 105;
real xC = 158;
real yC = 60;
real xD = 144;
real yD = 121;

pair A = (0, 0);
pair B = (lenAB, 0);
pair C = (xC, yC);
pair D = (xD, yD);

pair Y = extension(A, C, B, D);

pair O1 = Circumcenter(A, B, Y);
pair O2 = Circumcenter(C, D, Y);

// Both circles pass through Y, so their other common point is the mirror image
// of Y across the line of centres.
pair O = ReflectAcross(Y, O1, O2);

Circle(O1, abs(A - O1), LightBlue);
Circle(O2, abs(C - O2), LightBlue);

Draw(A, B, Green);
Draw(C, D, Red);

DashedDraw(O, A);
DashedDraw(O, B);
DashedDraw(O, C);
DashedDraw(O, D);

Draw(A, C);
Draw(B, D);

LabeledDot(A, "A", SW);
LabeledDot(B, "B", SE);
LabeledDot(C, "C", SE);
LabeledDot(D, "D", NE);
LabeledDot(Y, "Y", SE);
LabeledDot(O, "O", N);
