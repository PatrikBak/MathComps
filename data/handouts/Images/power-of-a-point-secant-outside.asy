import _common;

real R = 36;
real apartness = 73;
real secantAngle = 13;

pair O = (0, 0);
pair M = (-apartness, 0);

pair[] secant = LineCircleIntersections(M, Polar(M, secantAngle, apartness), O, R);
pair A = secant[0];
pair B = secant[1];

Circle(O, R, LightBlue);

Draw(M, B, Green);

LabeledDot(M, "M", W);
LabeledDot(A, "A", NW);
LabeledDot(B, "B", NE);
