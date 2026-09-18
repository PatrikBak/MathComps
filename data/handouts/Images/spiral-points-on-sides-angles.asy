include "spiral-points-on-sides-shared.asy";

// Circle (BC1A1) meets omega again at B2; circle (CA1B1) meets omega again at
// C2 -- same reflection-in-the-centre-line trick as A2 in the shared module.
pair O3 = Circumcenter(B, C1, A1);
real r3 = abs(O3 - B);
pair B2 = ReflectAcross(B, O, O3);

pair O4 = Circumcenter(C, A1, B1);
real r4 = abs(O4 - C);
pair C2 = ReflectAcross(C, O, O4);

// A3: reflection of A1 in the midpoint of BC.
pair A3 = 2 * Midpoint(B, C) - A1;

AngleMark(B2, A2, C2, LightPurple, radius = Radius3);
AngleMark(B3, A3, C3, LightPurple, radius = Radius3);

Draw(A2, B2, Green);
Draw(B2, C2, Green);
Draw(C2, A2, Green);

Draw(A3, B3, Red);
Draw(B3, C3, Red);
Draw(C3, A3, Red);

Circle(O2, r2, LightBlue);
Circle(O3, r3, LightBlue);
Circle(O4, r4, LightBlue);

BaseEdges();
Draw(C, B2, vertexPen);
Draw(B, C2, vertexPen);
Draw(A, B2, vertexPen);
Draw(A, C2, vertexPen);

BaseDots();
LabeledDot(A1, "A_1", NW, 4, offset = (5.3, -1.2));
LabeledDot(B1, "B_1", NE, 5, offset = (0, -11.8));
LabeledDot(C1, "C_1", E, distanceOffset = 5, offset = (-27.1, 4.1), halo = true, haloPad = 0.8);
LabeledDot(A2, "A_2", NE, 3, offset = (-1.1, -3.9));
LabeledDot(B2, "B_2", NW, 3, offset = (2, -1.4));
LabeledDot(C2, "C_2", SW, 4, offset = (5.3, 2.6));
LabeledDot(A3, "A_3", S, offset = (2.7, 1.4));
LabeledDot(B3, "B_3", NE, 3, offset = (-3.4, -3.1));
LabeledDot(C3, "C_3", dir(190), 10, offset = (13, 12.8), halo = true, haloPad = 0.9);
