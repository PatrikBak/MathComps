include "spiral-quadrilateral-feet-shared.asy";

RightAngleMark(A, K, C, Radius1);
RightAngleMark(A, X, C, Radius1);
RightAngleMark(A, Y, C, Radius1);

pair Oomega = Midpoint(A, C);
real Romega = abs(A - C) / 2;
Circle(Oomega, Romega, LightBlue);
Circle(Oabd, Rabd, LightBlue);
DashedDraw(C, X, Purple);
DashedDraw(C, Y, Purple);
Draw(X, B, Green);
Draw(Y, D, Red);

// A-X, A-Y stop at the feet: the X-B, Y-D stretches are the green/red pair above.
Draw(A, X);
Draw(A, Y);
Draw(B, C);
Draw(C, D);
Draw(A, C);
Draw(A, K);
Draw(K, C);

BaseDots();
LabeledDot(B, "B", E, 1, color = ptPen);
LabeledDot(D, "D", W, 1, color = ptPen);
LabeledDot(X, "X", S, 1, color = ptPen, offset = (8, 2.8), halo = true);
LabeledDot(Y, "Y", S, 1, color = ptPen, offset = (-0.9, 20.3), halo = true, haloPad = 0.9);
