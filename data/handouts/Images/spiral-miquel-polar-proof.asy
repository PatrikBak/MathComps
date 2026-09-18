include "spiral-miquel-shared.asy";

// The circle through A, O, M, C is too wide for the frame, so only its arc
// carrying the four points is drawn.
real arcBuffer = 12;
pair centerAOMC = Circumcenter(A, O, C);

BaseFills();
RightAngleMark(O, M, Q, Radius1, LightBlue);
Arc(centerAOMC, A, O, M, arcBuffer, LightGreen);
BaseEdges();
Draw(A, C);
Draw(O, M);
Draw(Q, R);
BaseDots();
LabelO();
LabelP();
LabeledDot(M, "M", NE, 1);
