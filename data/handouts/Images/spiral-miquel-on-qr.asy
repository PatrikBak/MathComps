include "spiral-miquel-shared.asy";

real figureScale = 0.81;
transform rescale = scale(figureScale);
A = rescale * A;
B = rescale * B;
C = rescale * C;
D = rescale * D;
O = rescale * O;
P = rescale * P;
Q = rescale * Q;
R = rescale * R;
M = rescale * M;
circumRadius = figureScale * circumRadius;

BaseFills();

MiquelCircles();
Draw(Q, R);

BaseEdges();

LabeledDot(A, "A", W, 5);
LabeledDot(B, "B", (0.3, -0.35), 2, halo=true);
LabeledDot(D, "D", NW, 5);
LabeledDot(Q, "Q", (0.99, -0.16), 5);
LabeledDot(R, "R", N, 4);
LabeledDot(C, "C", SW, 8);
LabeledDot(M, "M", (0.3, 0.87), 5);
