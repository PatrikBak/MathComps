include "spiral-quadrilateral-feet-shared.asy";

Circle(Oamn, Ramn, LightBlue);
Circle(Oabd, Rabd, LightBlue);
Draw(B, M, Green);
Draw(D, N, Red);

BaseEdges();
Draw(C, M, vertexPen);
Draw(C, N, vertexPen);

BaseDots();
LabeledDot(B, "B", (-0.17, 1), 6, color = ptPen);
LabeledDot(M, "M", S, labelGap, color = ptPen);
LabeledDot(N, "N", NW, labelGap, color = ptPen);
