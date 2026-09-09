import _common;

// Base triangle ABC, chosen freely and scalene.
real lenAB = 108;
real lenAC = 97;
real angleA = 45;

// Spiral similarity centered at A with B -> X, C -> E: sigma(z) = A + spiralAtA*(z - A).
real spiralRatio = 0.6;
real spiralAngle = 95;

pair A = (0, 0);
pair B = (lenAB, 0);
pair C = A + lenAC * dir(angleA);

pair spiralAtA = spiralRatio * dir(spiralAngle);
pair X = A + spiralAtA * (B - A);
pair E = A + spiralAtA * (C - A);

// The direct similarity sending A -> C and C -> E is pinned down by those two
// correspondences (complex division solves for its multiplier); applying it
// to B places D so that CDE is directly similar to ABC.
pair cdeRatio = (E - C) / (C - A);
pair D = C + cdeRatio * (B - A);

DashedDraw(A, C, Purple);
DashedDraw(A, X, Purple);
DashedDraw(C, E, Purple);
DashedDraw(C, X, Purple);

Draw(B, C, Green);
Draw(X, E, Red);

Draw(A, B);
Draw(C, D);
Draw(D, E);
Draw(E, A);
Draw(B, X);
Draw(D, X);

LabeledDot(A, "A", S);
LabeledDot(B, "B", SE);
LabeledDot(C, "C", NE);
LabeledDot(D, "D", NW);
LabeledDot(E, "E", W);
LabeledDot(X, "X", (0.35, 1));

ParallelMark(B, X);
ParallelMark(C, D);
ParallelMark(B, C, count = 1);
ParallelMark(D, X, count = 1);
