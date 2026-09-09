include "spiral-isosceles-on-sides-shared.asy";

DashedDraw(X, M, Purple);
DashedDraw(M, Y, Purple);
DashedDraw(Y, N, Purple);
DashedDraw(N, X, Purple);

BaseEdges();

BaseDots();
LabeledDot(X, "X", NE);
LabeledDot(M, "M", NW);
LabeledDot(Y, "Y", (0.57, 0.82), distanceOffset = 5);
LabeledDot(N, "N", SE, (-2,3));

ParallelMark(X, M, count = 1);
ParallelMark(M, Y, count = 1);
ParallelMark(Y, N, count = 1);
ParallelMark(N, X, count = 1);
