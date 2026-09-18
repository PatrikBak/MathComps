include "spiral-miquel-shared.asy";

BaseFills();
RightAngleMark(O, M, Q, Radius1, LightBlue);

BaseEdges();
Draw(Q, R);
Draw(O, M);
Draw(A, C);
Draw(B, D);

BaseDots();
LabelO();
LabelP();
LabeledDot(M, "M", NE, 1);
