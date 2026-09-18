include "spiral-tangents-b-c-shared.asy";

BaseFills();

// BaseEdges is split around the angle marks instead of called: the dashed AT
// has to come before them so the halo behind the alpha at C paints over it,
// and omega after them so it crosses visibly over the wedges at B and C.
DashedDraw(A, T, Purple);

AngleMark(T, B, C, LightYellow, "\alpha", radius = Radius2, labelFraction = 1.7, labelPen = Font2, offset = (-4.5, 5.4));
AngleMark(B, C, T, LightYellow, "\alpha", radius = Radius2, labelFraction = 1.7, labelPen = Font2, offset = (4.6, 5.8), halo = true);
AngleMark(B, T, B1, LightGreen, "\theta_1", labelFraction = 1.1, labelPen = Font2, offset = (-2.4, -0.3));
AngleMark(C1, T, C, LightBlue, "\theta_2", labelFraction = 1.4, labelPen = Font2, offset = (-2, -1.1));

Circle(O, R, LightBlue);
Draw(C, S, vertexPen);
Draw(S, C1, vertexPen);
Circle(T, r, LightBlue);
DashedDraw(A, S, Purple);
Draw(B1, C1, Green);
Draw(B, C, Red);

Draw(T, B);
Draw(T, C);
Draw(A, B);
Draw(A, C);

BaseDots();
LabeledDot(C, "C", (0, -1));
