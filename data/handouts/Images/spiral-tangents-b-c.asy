include "spiral-tangents-b-c-shared.asy";

BaseFills();

BaseEdges();
Circle(T, r, LightBlue);
DashedDraw(A, S, Purple);
Draw(B1, C1, Green);
Draw(B, C, Red);
Draw(C, S, vertexPen);

Draw(T, B);
Draw(T, C);
Draw(A, B);
Draw(A, C);

BaseDots();
LabeledDot(C, "C", (0, -1));
