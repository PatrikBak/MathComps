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

BaseDots(labelC = false);
LabeledDot(M, "M", NE, 1, halo = true);
LabeledDot(C, "C", NE, 1, offset = (0.1, -3.1), halo = true);
