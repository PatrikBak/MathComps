include "spiral-miquel-shared.asy";

// The circle through A, O, M, C is too wide for the frame, so only its arc
// carrying the four points is drawn.
real arcBuffer = 12;
pair centerAOMC = Circumcenter(A, O, C);
pair centerBOMD = Circumcenter(B, O, D);

BaseFills();
Arc(centerAOMC, A, O, M, arcBuffer, LightGreen);
Circle(centerBOMD, abs(B - centerBOMD), LightRed);
BaseEdges();
Draw(A, C);
Draw(B, D);
Draw(O, M);
Draw(Q, R);
Draw(M, A, vertexPen);
Draw(M, D, vertexPen);
Draw(M, C, vertexPen);
Draw(O, A, vertexPen);
Draw(O, C, vertexPen);
BaseDots();
LabelO();
LabeledDot(P, "P", N, 2, halo = true, haloPad = 0.8, offset = (7, -17.9));
LabeledDot(M, "M", NE, 1);
