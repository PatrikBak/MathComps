include "spiral-miquel-shared.asy";

pair X = Midpoint(A, D);
pair Y = Midpoint(B, C);
pair centerOR = Midpoint(O, R);

BaseFills();
RightAngleMark(O, X, R, Radius1, LightBlue);
RightAngleMark(O, Y, R, Radius1, LightBlue);
RightAngleMark(O, M, Q, Radius1, LightBlue);
// The circle with diameter OR: it holds X and Y by the right angles there, and
// M by the centre construction for XD -> YC.
Circle(centerOR, abs(R - centerOR), LightGreen);
Circle(O, circumRadius, LightBlue);
Draw(A, Q);
Draw(D, Q);
Draw(A, X);
Draw(X, D, Green);
Draw(D, R);
Draw(B, Y);
Draw(Y, C, Red);
Draw(C, R);
Draw(Q, R);
Draw(O, X);
Draw(O, Y);
Draw(O, M);
BaseDots();
LabelO();
LabeledDot(M, "M", NE, 1);
LabeledDot(X, "X", NW, 1, halo = true);
LabeledDot(Y, "Y", E, halo = true);
