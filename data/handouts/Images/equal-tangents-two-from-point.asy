import _common;

real r = 35;
real apartness = 90;

pair O = (0, 0);
pair A = (apartness, 0);

pair[] tangents = TangentPointsFromExternal(A, O, r);
pair X = tangents[0];
pair Y = tangents[1];

RightAngleMark(A, X, O, radius = Radius1);
RightAngleMark(O, Y, A, radius = Radius1);

Circle(O, r, LightBlue);
Draw(A, X, Green);
Draw(A, Y, Green);

Draw(O, X, vertexPen);
Draw(O, Y, vertexPen);

LabeledDot(A, "A", E);
LabeledDot(X, "X", NW);
LabeledDot(Y, "Y", SW);
LabeledDot(O, "O", W);
