include "angles-square-equilateral-shared.asy";

BaseFills();

real r = Radius4;
pen p = Font2;

AngleMark(X, A, D, LightGreen, "30^\circ", radius = r, labelFraction = 1.5, labelPen = p);
AngleMark(B, A, X, LightPurple, "60^\circ", radius = r, labelFraction = 1.5, labelPen = p);
AngleMark(A, D, Y, LightGreen, "30^\circ", radius = r, labelFraction = 1.5, labelPen = p);
AngleMark(Y, D, X, LightPink, radius = r);
AngleMark(D, X, A, LightBlue, "75^\circ", radius = r, labelFraction = 1.5, labelPen = p);

BaseEdges();
Draw(D, X);

BaseDots();