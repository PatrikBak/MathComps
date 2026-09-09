include "spiral-pairs-shared.asy";

// The same centre carries AB to ApBp (solid) and A-Ap to B-Bp (dashed).
Draw(A, B, Green);
Draw(Ap, Bp, Red);
DashedDraw(A, Ap, Green);
DashedDraw(B, Bp, Red);

BaseEdges();

BaseDots();
LabeledDot(Ap, "A'", E);
