include "spiral-pairs-shared.asy";

// X divides AB in the same ratio as Xp divides ApBp, so the spiral takes X to Xp.
real divisionRatio = 0.42;

pair X = A + divisionRatio * (B - A);
pair Xp = Ap + divisionRatio * (Bp - Ap);

// The three similar triangles O-A-Ap, O-X-Xp, O-B-Bp share the angle at A, X, B.
AngleMark(Ap, A, O, LightPurple, "", Radius2);
AngleMark(Xp, X, O, LightPurple, "", Radius2);
AngleMark(Bp, B, O, LightPurple, "", Radius2);

Draw(A, B, Green);
Draw(Ap, Bp, Red);
Draw(A, Ap, Purple);
Draw(X, Xp, Purple);
Draw(B, Bp, Purple);

BaseEdges();
DashedDraw(O, X);
DashedDraw(O, Xp);

BaseDots();
LabeledDot(Ap, "A'", (-0.42, -1.22), 5, offset = (1.2, 1.4));
LabeledDot(X, "X", S);
LabeledDot(Xp, "X'", NE, 3, offset = (-1.6, -0.7));
