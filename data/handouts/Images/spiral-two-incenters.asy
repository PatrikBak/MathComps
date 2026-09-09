import _common;

// Triangle angles in degrees (sum to 180): scalene and acute so D, E, F land
// clear of the vertices and I1, I2 separate from D and from each other.
real alphaDeg = 50;
real betaDeg = 70;
real gammaDeg = 60;

real lenBC = 175;

pair B = (0, 0);
pair C = (lenBC, 0);
pair A = extension(B, B + dir(betaDeg), C, C + dir(180 - gammaDeg));

pair D = Foot(A, B, C);
pair E = Foot(B, C, A);
pair F = Foot(C, A, B);

pair I1 = Incenter(B, F, D);
pair I2 = Incenter(C, E, D);

// The bisectors from B and C in ABC are the same rays as BI1 and CI2, so
// they meet at the incentre of ABC.
pair I = Incenter(A, B, C);

pair circleCenter = Circumcenter(B, C, I1);

// Right-angle fills for the three altitude feet.
RightAngleMark(A, D, B, radius = Radius1);
RightAngleMark(C, F, A, radius = Radius2);
RightAngleMark(A, E, B, radius = Radius2);

// This circle is centred well below BC, on the far side from A, so its full
// extent would dwarf the triangle. Only the near arc (through I1 and I2)
// carries the concyclicity, so that is the part we draw.
Arc(circleCenter, B, I1, C, color = LightBlue);

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
Draw(B, I, vertexPen);
Draw(C, I, vertexPen);
Draw(B, I2, vertexPen);

LabeledDot(A, "A", N);
LabeledDot(B, "B", SW);
LabeledDot(C, "C", SE);
LabeledDot(D, "D", S);
LabeledDot(E, "E", NE);
LabeledDot(F, "F", NW);
LabeledDot(I1, "I_1", N, distanceOffset = 5);
LabeledDot(I2, "I_2", N, distanceOffset = 5);
LabeledDot(I, "I", NE, distanceOffset = 5);
