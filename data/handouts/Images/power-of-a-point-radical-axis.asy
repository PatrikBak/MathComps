import _common;

real r1 = 46;
real r2 = 38;
real separation = 62;
real axisOverhang = 24;
real circleLabelAngle = 165;

pair O1 = (-separation / 2, 0);
pair O2 = (separation / 2, 0);

pair[] axis = RadicalAxis(O1, r1, O2, r2);
pair[] meeting = LineCircleIntersections(axis[0], axis[1], O1, r1);
pair A = meeting[0];
pair B = meeting[1];

Circle(O1, r1, LightBlue);
Circle(O2, r2, LightBlue);

Draw(ExtendPast(B, A, axisOverhang), ExtendPast(A, B, axisOverhang), Red);

LabeledDot(A, "A", E, offset = (0, -2.8), halo = true);
LabeledDot(B, "B", E, offset = (0, 2.8), halo = true);

PointLabel(Polar(O1, circleLabelAngle, r1), "\omega_1", NW);
PointLabel(Polar(O2, 180 - circleLabelAngle, r2), "\omega_2", NE);
PointLabel(ExtendPast(B, A, axisOverhang), "m", NE, color = Red);
