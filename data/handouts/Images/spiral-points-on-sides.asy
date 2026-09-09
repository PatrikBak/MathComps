include "spiral-points-on-sides-shared.asy";

Circle(O2, r2, LightBlue);

DashedDraw(A2, B, Purple);
DashedDraw(A2, C, Purple);
DashedDraw(A2, B1, Purple);
DashedDraw(A2, C1, Purple);

Draw(C1, B1, Green);

BaseEdges();
Draw(B, C, Red);
Draw(C3, B3);

BaseDots();
LabeledDot(A1, "A_1", S);
LabeledDot(B1, "B_1", (-0.22, -0.97));
LabeledDot(C1, "C_1", W);
LabeledDot(A2, "A_2", E);
LabeledDot(B3, "B_3", NE);
LabeledDot(C3, "C_3", NW);
