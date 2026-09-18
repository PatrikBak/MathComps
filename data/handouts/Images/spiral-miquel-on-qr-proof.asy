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
// The two wedges at M sit along QR and copy the interior angles of ABCD at D
// (circle QADM) and at B (circle RABM), which sum to a straight angle exactly
// when ABCD is cyclic.
AngleMark(A, M, Q, LightOrange, "", Radius2);
AngleMark(R, M, A, LightPurple, "", Radius2);
AngleMark(A, D, C, LightOrange, "", Radius2);
AngleMark(C, B, A, LightPurple, "", Radius2);
CircleThrough(Q, A, D, LightOrange);
CircleThrough(R, A, B, LightPurple);
Draw(Q, R);
Draw(M, A);
BaseEdges();
BaseDots();
LabeledDot(M, "M", NE, 1, offset = (-1.2, 0.3));
