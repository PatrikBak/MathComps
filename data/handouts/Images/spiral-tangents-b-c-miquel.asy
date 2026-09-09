include "spiral-tangents-b-c-shared.asy";

// X is where lines B1B and C1C meet again, past B and past C.
pair X = extension(B1, B, C1, C);

pair deltaCenter = Midpoint(T, S);
real deltaRadius = abs(T - S) / 2;

BaseFills();

BaseEdges();
Circle(deltaCenter, deltaRadius, LightBlue);
DashedDraw(S, X, Purple);
Draw(B1, C1, Green);
Draw(B, C, Red);
Draw(C, S, vertexPen);

Draw(B1, X);
Draw(C1, X);

BaseDots();
LabeledDot(C, "C", N, (1,0), 3);
LabeledDot(X, "X", N);
