import _common;

// A convex quadrilateral with AB along the bottom. The four sides are pairwise
// unequal and D falls well inside the circle ABC, so the drawing carries no
// hint of the cyclic case where the inequality becomes an equality.
pair A = (0, 0);
pair B = (115, 0);
pair C = (155, 68);
pair D = (27, 99);

Draw(A, B);
Draw(B, C);
Draw(C, D);
Draw(D, A);
Draw(A, C);
Draw(B, D);

LabeledDot(A, "A", SW);
LabeledDot(B, "B", SE);
LabeledDot(C, "C", NE);
LabeledDot(D, "D", NW);

EdgeLabel(A, B, "a", S, 1);
EdgeLabel(B, C, "b", E, 1);
EdgeLabel(C, D, "c", N, 1);
EdgeLabel(D, A, "d", W, 1);

// The diagonals cross at 0.54 along AC and 0.37 along BD; both labels sit away
// from that crossing.
EdgeLabel(A, C, "e", S, 2, 0.4);
EdgeLabel(B, D, "f", E, 2.2, 0.6);
