import _common;

real lenAB = 70;
real lenAC = 50;
real angleA = 58;

// Hang the legs off A along the x-axis first, then turn them so that BC runs
// horizontally below A.
pair A = (0, 0);
pair B0 = A + lenAB * dir(0);
pair C0 = A + lenAC * dir(angleA);
real baseAngle = -degrees(C0 - B0);
pair B = rotate(baseAngle) * B0;
pair C = rotate(baseAngle) * C0;

// ABKL sits outward across AB, away from C; ACMN sits outward across AC, away from B.
pair nAB = rotate(-90) * unit(B - A);
pair nAC = rotate(90) * unit(C - A);

pair K = B + lenAC * nAB;
pair L = A + lenAC * nAB;
pair M = C + lenAB * nAC;
pair N = A + lenAB * nAC;

pair X = extension(B, N, K, M);

// omega1, omega2: the circumcircles the solution routes the whole argument through.

CircleThrough(A, B, K, LightBlue);
CircleThrough(A, C, M, LightBlue);

Draw(B, N, Green);
Draw(K, M, Red);
DashedDraw(C, L, Purple);

Draw(A, B);
Draw(B, C);
Draw(C, A);
Draw(B, K);
Draw(K, L);
Draw(L, A);
Draw(C, M);
Draw(M, N);
Draw(N, A);
Draw(A, K, vertexPen);

LabeledDot(A, "A", (0.9, -0.42), distanceOffset = 6);
LabeledDot(B, "B", SW);
LabeledDot(C, "C", S);
LabeledDot(K, "K", SW);
LabeledDot(L, "L", NW);
LabeledDot(M, "M", SE);
LabeledDot(N, "N", NE);
LabeledDot(X, "X", (-0.4, -0.9), distanceOffset = 6, halo = true);
