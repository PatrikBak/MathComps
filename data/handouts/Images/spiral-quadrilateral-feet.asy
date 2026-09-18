include "spiral-quadrilateral-feet-shared.asy";

Circle(Oamn, Ramn, LightBlue);
Circle(Oabd, Rabd, LightBlue);
Draw(B, M, Green);
Draw(D, N, Red);

BaseEdges();
Draw(C, M, vertexPen);
Draw(C, N, vertexPen);

BaseDots();
LabeledDot(B, "B", SE, 1, color = ptPen);
LabeledDot(D, "D", SW, 1, color = ptPen);
LabeledDot(M, "M", E, 1, color = ptPen);
LabeledDot(N, "N", NW, 1, color = ptPen);
