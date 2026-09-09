include "spiral-miquel-shared.asy";

BaseFills();
RightAngleMark(O, M, Q, Radius1, LightBlue);

BaseEdges();
Draw(Q, R);
Draw(O, M);

BaseDots();
LabeledDot(C, "C", (0.74, 0.67), 2);
LabeledDot(O, "O", W);
LabeledDot(M, "M", NE);
