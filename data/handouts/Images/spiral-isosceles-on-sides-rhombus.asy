include "spiral-isosceles-on-sides-shared.asy";

DashedDraw(X, M, Purple);
DashedDraw(M, Y, Purple);
DashedDraw(Y, N, Purple);
DashedDraw(N, X, Purple);

Draw(A, C, vertexPen);
Draw(B, D, vertexPen);
Draw(X, Y, vertexPen);
Draw(M, N, vertexPen);
BaseEdges();
Draw(P, A);
Draw(P, B);
Draw(R, B);
Draw(R, C);
Draw(Q, C);
Draw(Q, D);
Draw(T, D);
Draw(T, A);

BaseDots();
LabeledDot(X, "X", NE, 1, offset = (-1, -0.1));
LabeledDot(M, "M", NW, 1, offset = (1.5, 0.7));
// Compass S is shadowed by point S, so its align direction is spelled out.
LabeledDot(Y, "Y", (0, -1), offset = (-3.2, 1.2));
LabeledDot(N, "N", SE, 1, (-0.8, 2.4));

EqualMark(X, M);
EqualMark(M, Y);
EqualMark(Y, N);
EqualMark(N, X);
