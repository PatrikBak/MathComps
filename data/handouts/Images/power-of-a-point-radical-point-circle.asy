import _common;

real r = 38;
real apartness = 92;
real axisOverhang = 29;

pair O = (0, 0);
pair P = (apartness, 0);

pair[] tangents = TangentPointsFromExternal(P, O, r);
pair T1 = tangents[0];
pair T2 = tangents[1];

pair M1 = Midpoint(P, T1);
pair M2 = Midpoint(P, T2);
pair F = Midpoint(M1, M2);

RightAngleMark(M1, F, O, radius = Radius1, color = LightRed);

Circle(O, r, LightBlue);

Draw(P, T1, Green);
Draw(P, T2, Green);
Draw(ExtendPast(M2, M1, axisOverhang), ExtendPast(M1, M2, axisOverhang), Red);

Draw(O, P, vertexPen);

LabeledDot(O, "O", W);
LabeledDot(P, "P", E);
LabeledDot(T1, "T_1", NW);
LabeledDot(T2, "T_2", SW);
LabeledDot(M1, "M_1", NE);
LabeledDot(M2, "M_2", SE);
