include "spiral-points-on-sides-shared.asy";

Circle(O2, r2, LightBlue);

DashedDraw(A2, B, Purple);
DashedDraw(A2, C, Purple);
DashedDraw(A2, B1, Purple);
DashedDraw(A2, C1, Purple);

Draw(C1, B1, Green);

BaseEdges();

// The midpoint reflections give |AC3| = |BC1| and |AB3| = |CB1|, which is what
// turns the ratio at A2 into one at A.
Draw(B, C, Red);
Draw(C3, B3, Red);

BaseDots();
LabeledDot(B1, "B_1", S);
LabeledDot(C1, "C_1", W);
LabeledDot(A2, "A_2", E);
LabeledDot(B3, "B_3", NE, 1, offset = (-1.3, -2.1));
LabeledDot(C3, "C_3", NW, 1);
