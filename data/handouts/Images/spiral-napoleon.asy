import _common;

// Triangle ABC, scalene, with BC horizontal below A.
real lenAB = 80;
real lenAC = 64;
real angleBAC = 80;

pair A = (0, 0);
pair B0 = Polar(A, 0, lenAB);
pair C0 = Polar(A, angleBAC, lenAC);
real baseAngle = -degrees(C0 - B0);
pair B = rotate(baseAngle) * B0;
pair C = rotate(baseAngle) * C0;

// Apex of each outward equilateral triangle. The reversed argument order
// (relative to the CCW A,B,C cycle) puts each apex on the far side of its
// edge from the triangle's third vertex.
pair D = EquilateralTriangle(C, B);
pair E = EquilateralTriangle(A, C);
pair F = EquilateralTriangle(B, A);

// Centroids: X of CAE, Y of ABF, Z of BCD.
pair X = (C + A + E) / 3;
pair Y = (A + B + F) / 3;
pair Z = (B + C + D) / 3;

AngleMark(C, A, X, LightGreen, radius = Radius2);
AngleMark(F, A, Y, LightGreen, radius = Radius2);

DashedDraw(A, X, Purple);
DashedDraw(A, Y, Purple);
Draw(X, Y, Green);
Draw(C, F, Red);
Draw(X, C, vertexPen);
Draw(Y, F, vertexPen);
Draw(A, D, vertexPen);
Draw(B, E, vertexPen);

Draw(A, B);
Draw(B, C);
Draw(C, A);
Draw(B, D);
Draw(D, C);
Draw(A, E);
Draw(E, C);
Draw(B, F);
Draw(F, A);
Draw(Y, Z);
Draw(Z, X);

LabeledDot(A, "A", N);
LabeledDot(B, "B", SW, 1);
LabeledDot(C, "C", SE, 1);
LabeledDot(D, "D", S);
// Point E shadows the compass constant, so east is spelled out.
LabeledDot(E, "E", (1, 0), offset = (-2.3, 1.2));
LabeledDot(F, "F", W);
LabeledDot(X, "X", (1, 0), offset = (-3, 0));
LabeledDot(Y, "Y", W);
LabeledDot(Z, "Z", S, offset = (-4.1, 0.6));
