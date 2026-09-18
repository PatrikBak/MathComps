import _common;

// Same quadrilateral as the statement figure.
pair A = (0, 0);
pair B = (115, 0);
pair C = (155, 68);
pair D = (27, 99);

// X is the image of D under the spiral similarity centred at A that takes C
// to B: scale by |AB| / |AC| and rotate by the angle from AC to AB.
real spiralScale = abs(B - A) / abs(C - A);
real spiralAngle = degrees(B - A) - degrees(C - A);
pair X = A + spiralScale * (rotate(spiralAngle) * (D - A));

// Green: CD and its image BX under the first similarity. Red: CB and its image
// DX under the paired one.
Draw(C, D, Green);
Draw(B, X, Green);
Draw(B, C, Red);
Draw(D, X, Red);
Draw(A, B);
Draw(D, A);
Draw(B, D);
Draw(A, X);
DashedDraw(A, C);
LabeledDot(A, "A", SW, 1);
LabeledDot(B, "B", SE, 1);
LabeledDot(C, "C", NE, 1);
LabeledDot(D, "D", NW, 1);
LabeledDot(X, "X", S, offset = (-13.1, 14.9));
EdgeLabel(A, B, "a", S, 1, offset = (1.3, 2.5));
EdgeLabel(B, C, "b", E, 1, offset = (-0.5, -3.5));
EdgeLabel(C, D, "c", N, 1, offset = (-0.1, 2));
EdgeLabel(D, A, "d", W, 1);
EdgeLabel(A, C, "e", S, 2, 0.75, offset = (-11.8, 13.4));
EdgeLabel(B, D, "f", E, 2, 0.667, offset = (4.2, -3.2));
