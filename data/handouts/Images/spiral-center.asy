import _common;

// X sits at the origin, on line AB (direction angleAB) and on line CD
// (direction angleCD); A is closer to X than B, D closer than C. angleCD is
// far from angleAB so the two circles cross well clear of X.
real angleAB = 194;
real angleCD = 284;
real distXA = 62;
real distXB = 122;
real distXD = 65;
real distXC = 125;

pair X = (0, 0);
pair A = Polar(X, angleAB, distXA);
pair B = Polar(X, angleAB, distXB);
pair D = Polar(X, angleCD, distXD);
pair C = Polar(X, angleCD, distXC);

pair O1 = Circumcenter(X, A, C);
pair O2 = Circumcenter(X, B, D);

// Both circles pass through X, so their other common point is the mirror
// image of X across the line of centres.
pair O = ReflectAcross(X, O1, O2);

Circle(O1, abs(A - O1), LightBlue);
Circle(O2, abs(B - O2), LightBlue);

Draw(X, A);
Draw(A, B, Green);
Draw(X, D);
Draw(D, C, Red);

DashedDraw(O, A);
DashedDraw(O, B);
DashedDraw(O, C);
DashedDraw(O, D);

LabeledDot(X, "X", NE);
LabeledDot(A, "A", NW);
LabeledDot(B, "B", SW);
LabeledDot(D, "D", E);
LabeledDot(C, "C", SE);
LabeledDot(O, "O", S);
