import _common;

real r1 = 34;
real r2 = 23;
real axisOverhang = 14;
real circleLabelAngle = 170;

pair O1 = (0, 0);
pair O2 = Polar(O1, 0, r1 + r2);
pair T = Polar(O1, 0, r1);

pair[] axis = RadicalAxis(O1, r1, O2, r2, r1 + axisOverhang);

Circle(O1, r1, LightBlue);
Circle(O2, r2, LightBlue);

Draw(axis[0], axis[1], Red);

LabeledDot(T, "T", W);

PointLabel(Polar(O1, circleLabelAngle, r1), "\omega_1", NW);
PointLabel(Polar(O2, 180 - circleLabelAngle, r2), "\omega_2", NE);
PointLabel(axis[0], "m", NE, color = Red);
