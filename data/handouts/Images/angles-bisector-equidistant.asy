import _common;

real rayLength = 100;
real bisectorLength = 90;

pair A = (0, 0);
pair X = rayLength * dir(130);
pair Y = rayLength * dir(50);
pair Z = bisectorLength * dir(90);

pair Xp = Foot(Z, A, X);
pair Yp = Foot(Z, A, Y);

AngleMark(Z, A, X, LightGreen, radius = Radius2);
AngleMark(Y, A, Z, LightGreen, radius = Radius2Nudged);

RightAngleMark(A, Xp, Z, radius = Radius2);
RightAngleMark(Z, Yp, A, radius = Radius2);

Draw(Z, Xp, Red);
Draw(Z, Yp, Red);
Draw(A, X);
Draw(A, Y);
DashDotDraw(A, Z);

LabeledDot(A, "A", S);
LabeledDot(X, "X", NW);
LabeledDot(Y, "Y", NE);
LabeledDot(Z, "Z", N);
LabeledDot(Xp, "X'", SW);
LabeledDot(Yp, "Y'", SE);
