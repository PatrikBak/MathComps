include "spiral-quadrilateral-feet-shared.asy";

// The shared coordinates are sized for the sibling figure, whose two circles
// fill the frame; here the frame is just ABCD plus the circle on AC, so the
// same points are enlarged.
real figureScale = 1.2;
transform enlarge = scale(figureScale);
A = enlarge * A;
B = enlarge * B;
C = enlarge * C;
D = enlarge * D;
K = enlarge * K;
X = enlarge * X;
Y = enlarge * Y;

RightAngleMark(A, K, C, Radius1);
RightAngleMark(A, X, C, Radius1);
RightAngleMark(A, Y, C, Radius1);

pair Oomega = Midpoint(A, C);
real Romega = abs(A - C) / 2;
Circle(Oomega, Romega, LightBlue);
DashedDraw(C, X, Purple);
DashedDraw(C, Y, Purple);
Draw(X, B, Green);
Draw(Y, D, Red);

// A-X, A-Y stop at the feet: the X-B, Y-D stretches are the green/red pair above.
Draw(A, X);
Draw(A, Y);
Draw(A, C);
Draw(A, K);
Draw(K, C);

BaseDots();
LabeledDot(B, "B", SE, labelGap, color = ptPen);
LabeledDot(X, "X", S, labelGap, color = ptPen);
LabeledDot(Y, "Y", NW, labelGap, color = ptPen);
