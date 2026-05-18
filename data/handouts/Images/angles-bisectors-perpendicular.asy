import _common;

real rayLength = 90;
real bisectorLength = 80;
real extensionLength = 50;

pair A = (0, 0);
pair X = rayLength * dir(130);
pair Y = rayLength * dir(50);
pair Z = bisectorLength * dir(90);
pair Ze = bisectorLength * dir(180);

pair Yp = extensionLength * dir(230);

AngleMark(Z, A, X, LightGreen, "\beta", radius = Radius2, labelPen = Green);
AngleMark(Y, A, Z, LightGreen, "\beta", radius = Radius2Nudged, labelPen = Green);
AngleMark(X, A, Ze, LightPink, "\alpha", radius = Radius2, labelPen = Pink);
AngleMark(Ze, A, Yp, LightPink, "\alpha", radius = Radius2Nudged, labelPen = Pink);

Draw(A, X);
Draw(A, Y);
DashDotDraw(A, Z);
DashDotDraw(A, Ze);
Draw(A, Yp, vertexPen);

LabeledDot(A, "A", SE);
LabeledDot(X, "X", NW);
LabeledDot(Y, "Y", NE);
