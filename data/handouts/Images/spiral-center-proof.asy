import _common;

// Same configuration as the statement figure.
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
pair O = ReflectAcross(X, O1, O2);

// The inscribed angles on chord OX: equal at A and C (circle XAOC), equal at
// B and D (circle XBOD). Together they make OAB and OCD similar, and the
// yellow wedges are the equal angles at O that similarity yields.
AngleMark(B, A, O, LightGreen, "", Radius2);
AngleMark(D, C, O, LightGreen, "", Radius2);
AngleMark(O, B, A, LightPurple, "", Radius2);
AngleMark(O, D, C, LightPurple, "", Radius2);
AngleMark(A, O, B, LightYellow, "", Radius2);
AngleMark(C, O, D, LightYellow, "", Radius2);

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

LabeledDot(X, "X", NE, 1, offset = (-5.1, 2.2), halo = true);
LabeledDot(A, "A", NW, 1, offset = (3.1, 1.4));
LabeledDot(B, "B", SW, 1, offset = (-2.7, 9.6));
LabeledDot(D, "D", E, offset = (-2.7, 5.1));
LabeledDot(C, "C", SE, 1, offset = (0, 2.4));
LabeledDot(O, "O", S, offset = (-3.6, 2.8));
