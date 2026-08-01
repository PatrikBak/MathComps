import _common;

real halfHypotenuse = 60;
real apexAngle = 63;

pair O = (0, 0);
pair B = (-halfHypotenuse, 0);
pair C = (halfHypotenuse, 0);
pair A = Polar(O, apexAngle, halfHypotenuse);
pair D = Foot(A, B, C);

RightAngleMark(B, A, C, radius = Radius1);
RightAngleMark(A, D, C, radius = Radius1);

Draw(A, D, Green);

Draw(A, B);
Draw(B, C);
Draw(C, A);

LabeledDot(A, "A", N);
LabeledDot(B, "B", SW);
LabeledDot(C, "C", SE);
LabeledDot(D, "D", S);
