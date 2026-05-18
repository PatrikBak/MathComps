import _common;

real rayLength = 90;
real bisectorLength = 75;
real extensionLength = 50;

pair A = (0, 0);
pair X = rayLength * dir(130);
pair Y = rayLength * dir(50);

pair Xprime = extensionLength * dir(310);
pair Yprime = extensionLength * dir(230);

pair bisectorRight = bisectorLength * dir(0);
pair bisectorLeft = bisectorLength * dir(180);

AngleMark(X, A, bisectorLeft, LightPink, radius = Radius2);
AngleMark(bisectorLeft, A, Yprime, LightPink, radius = Radius2Nudged);
AngleMark(Xprime, A, bisectorRight, LightPink, radius = Radius2Nudged);
AngleMark(bisectorRight, A, Y, LightPink, radius = Radius2);

Draw(A, X);
Draw(A, Y);
Draw(bisectorLeft, bisectorRight, black + dashedPen);
draw(A -- Xprime, vertexPen);
draw(A -- Yprime, vertexPen);

LabeledDot(A, "A", S);
LabeledDot(X, "X", NW);
LabeledDot(Y, "Y", NE);
