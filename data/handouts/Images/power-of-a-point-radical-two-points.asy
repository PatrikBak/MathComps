import _common;

real halfSeparation = 52;
real axisOverhang = 38;

pair P1 = (-halfSeparation, 0);
pair P2 = (halfSeparation, 0);
pair M = Midpoint(P1, P2);
pair axisTop = Polar(M, 90, axisOverhang);
pair axisBottom = Polar(M, 270, axisOverhang);

RightAngleMark(P2, M, axisTop, radius = Radius1, color = LightRed);

Draw(axisBottom, axisTop, Red);

Draw(P1, P2, vertexPen);

ParallelMark(P1, M, count = 1);
ParallelMark(M, P2, count = 1);

VertexDot(P1);
VertexDot(P2);

PointLabel(axisTop, "m", NE, color = Red);
