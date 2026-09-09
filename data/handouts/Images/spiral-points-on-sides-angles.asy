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

BaseEdges();
Draw(C, B2, vertexPen);
Draw(B, C2, vertexPen);
Draw(A, B2, vertexPen);
Draw(A, C2, vertexPen);

BaseDots();
LabeledDot(A2, "A_2", E);
LabeledDot(B2, "B_2", W);
LabeledDot(C2, "C_2", S);
LabeledDot(A3, "A_3", S);
LabeledDot(B3, "B_3", NE);
LabeledDot(C3, "C_3", W);
