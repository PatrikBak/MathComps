include "angles-square-equilateral-shared.asy";

BaseFills();

AngleMark(Y, A, X, LightPink, radius = Radius4);
AngleMark(X, B, Y, LightPink, radius = Radius4);
AngleMark(X, C, Y, LightPink, radius = Radius4);
AngleMark(Y, D, X, LightPink, radius = Radius4);

BaseEdges();
Draw(A, Y);
Draw(B, Y);
Draw(C, X);
Draw(D, X);

BaseDots();
