import _common;

// Triangle angles in degrees (sum to 180): acute and clearly scalene.
real alphaDeg = 60;
real betaDeg = 70;
real gammaDeg = 50;

real lenBC = 175;

pair B = (0, 0);
pair C = (lenBC, 0);
pair A = extension(B, B + dir(betaDeg), C, C + dir(180 - gammaDeg));

pair D = Foot(A, B, C);
pair E = Foot(B, C, A);
pair F = Foot(C, A, B);

pair I1 = Incenter(B, F, D);
pair I2 = Incenter(C, E, D);

pair circleCenter = Circumcenter(B, C, I1);

// Right-angle fills for the three altitude feet.
RightAngleMark(A, D, B, radius = Radius1);
RightAngleMark(C, F, A, radius = Radius2);
RightAngleMark(A, E, B, radius = Radius2);

// This circle is centred well below BC, on the far side from A, so its full
// extent would dwarf the triangle. Only the near arc (through I1 and I2)
// carries the concyclicity, so that is the part we draw.
Arc(circleCenter, B, I1, C, color = LightBlue);
Circle(I1, abs(I1 - Foot(I1, B, D)), LightPink);
Circle(I2, abs(I2 - Foot(I2, C, D)), LightPink);

DashedDraw(D, F, Purple);
DashedDraw(D, E, Purple);
DashedDraw(D, I1, Purple);
DashedDraw(D, I2, Purple);

Draw(B, E, Green);
Draw(I1, I2, Red);

Draw(A, B);
Draw(B, C);
Draw(C, A);
Draw(A, D);
Draw(C, F);
Draw(B, I1, vertexPen);
Draw(C, I2, vertexPen);

LabeledDot(A, "A", N);
LabeledDot(B, "B", SW, 1);
LabeledDot(C, "C", SE, 1);
LabeledDot(D, "D", S);
LabeledDot(E, "E", NE, 1);
LabeledDot(F, "F", NW, 1);
LabeledDot(I1, "I_1", N, distanceOffset = 3, halo = true, haloPad = 0.8, offset = (-0.4, 2.2));
LabeledDot(I2, "I_2", N, distanceOffset = 3, halo = true, offset = (0.8, 0));
