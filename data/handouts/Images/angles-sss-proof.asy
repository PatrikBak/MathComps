import _common;

real base = 65, rB = 60, rC = 55;
pair B = (0, 0);
pair C = (base, 0);
// A and A' are the two intersections of circle(B, rB) and circle(C, rC); pick
// the upper one for A and reflect across BC for A'.
pair[] meets = intersectionpoints(circle(B, rB), circle(C, rC));
pair A = meets[0].y > meets[1].y ? meets[0] : meets[1];
pair Ap = ReflectAcross(A, B, C);

Circle(B, rB, Blue);
Circle(C, rC, Red);

Draw(B, C, Green);
Draw(A, B, Blue);
Draw(C, A, Red);

LabeledDot(B, "B", W, Blue);
LabeledDot(C, "C", E, Red);
LabeledDot(A, "A", N, Green);
LabeledDot(Ap, "A'", S, Green);

EdgeLabel(B, A, "c", W, color = Blue, distanceOffset = 8);
EdgeLabel(C, A, "b", E, color = Red, distanceOffset = 8);
EdgeLabel(B, C, "a", S, distanceOffset = 4, color = Green);
