import _common;

real rayLength = 100;
real interiorLength = 45;

pair A = (0, 0);
pair X = rayLength * dir(130);
pair Y = rayLength * dir(50);
pair Z = rayLength * dir(90);

pair Xp = interiorLength * dir(310);
pair Yp = interiorLength * dir(230);
pair Zp = interiorLength * dir(270);

AngleMark(Z, A, X, LightGreen, radius = Radius2);
AngleMark(Y, A, Z, LightGreen, radius = Radius2Nudged);

Draw(A, X);
Draw(A, Y);
DashDotDraw(A, Z);
Draw(A, Xp, vertexPen);
Draw(A, Yp, vertexPen);
DashDotDraw(A, Zp, vertexPen);

LabeledDot(A, "A", E);
LabeledDot(X, "X", NW);
LabeledDot(Y, "Y", NE);
LabeledDot(Z, "Z", N);
