import _common;

real r = 45;
real apartness = 110;

pair O = (0, 0);
pair M = (apartness, 0);

pair[] tangents = TangentPointsFromExternal(M, O, r);
pair T = tangents[0];

RightAngleMark(M, T, O, radius = Radius1);

Circle(O, r, LightBlue);

Draw(M, T, Green);

Draw(O, T, vertexPen);
Draw(O, M, vertexPen);

LabeledDot(O, "O", W);
LabeledDot(M, "M", E);
LabeledDot(T, "T", NE);
