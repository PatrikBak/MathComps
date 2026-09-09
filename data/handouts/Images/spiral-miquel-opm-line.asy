include "spiral-miquel-shared.asy";

BaseFills();
RightAngleMark(O, M, Q, Radius1, LightBlue);

BaseEdges();
Draw(Q, R);
Draw(O, M);
Draw(A, C);
Draw(B, D);

BaseDots();
LabeledDot(C, "C", (0.74, 0.67), 2);
LabeledDot(O, "O", (-0.87, -0.16), 2);
LabeledDot(P, "P", S, 2);
LabeledDot(M, "M", NE);
