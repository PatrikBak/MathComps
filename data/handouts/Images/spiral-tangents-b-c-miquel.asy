include "spiral-tangents-b-c-shared.asy";

// X is where lines B1B and C1C meet again, past B and past C.
pair X = extension(B1, B, C1, C);

pair deltaCenter = Midpoint(T, S);
real deltaRadius = abs(T - S) / 2;

BaseFills();

BaseEdges();
Circle(T, r, LightBlue);
Circle(deltaCenter, deltaRadius, LightBlue);
DashedDraw(S, X, Purple);
Draw(B1, C1, Green);
Draw(B, C, Red);

Draw(T, B);
Draw(T, C);
Draw(A, B);
Draw(A, C);
Draw(B1, X);
Draw(C1, X);

BaseDots();
LabeledDot(C, "C", (0,-1), distanceOffset = 3, offset = (-2.3, -0.4));
LabeledDot(X, "X", N);
