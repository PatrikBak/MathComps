import _common;

real R = 42;
real offCenter = 19;
real offCenterAngle = 205;
real chordAngle = 60;

pair O = (0, 0);
pair M = Polar(O, offCenterAngle, offCenter);

pair[] chord = LineCircleIntersections(M, Polar(M, chordAngle, R), O, R);
pair A = chord[0];
pair B = chord[1];

Circle(O, R, LightBlue);

Draw(A, B, Green);

LabeledDot(M, "M", NW);
LabeledDot(A, "A", SW);
LabeledDot(B, "B", N);
