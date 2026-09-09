import _common;

// D sits on the arc BC below B, so its foot on AB falls past B and the Simson
// line climbs across the whole triangle from X to Y.
real R = 76;
real angleA = 112;
real alpha = 25;
real angleD = 246;
real pastFoot = 12;

pair O = (0, 0);
pair A = Polar(O, angleA, R);
pair B = Polar(O, 180 + alpha, R);
pair C = Polar(O, 360 - alpha, R);
pair D = Polar(O, angleD, R);

pair X = Foot(D, A, B);
pair Y = Foot(D, A, C);
pair Z = Foot(D, B, C);

RightAngleMark(A, X, D, Radius1, LightBlue);
RightAngleMark(C, Y, D, Radius1, LightBlue);
RightAngleMark(C, Z, D, Radius1, LightBlue);

Circle(O, R, LightBlue);

DashedDraw(D, X);
DashedDraw(D, Y);
DashedDraw(D, Z);

Draw(A, ExtendPast(A, X, pastFoot));
Draw(A, C);
Draw(B, C);
Draw(ExtendPast(Z, X, pastFoot), ExtendPast(X, Y, pastFoot));

LabeledDot(A, "A", N);
LabeledDot(B, "B", W);
LabeledDot(C, "C", E);
LabeledDot(D, "D", S);
LabeledDot(X, "X", SW, distanceOffset = pointLabelDistance + 4);
LabeledDot(Y, "Y", N);
LabeledDot(Z, "Z", N);
