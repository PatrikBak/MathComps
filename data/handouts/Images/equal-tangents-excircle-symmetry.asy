import _common;

// Triangle obtuse at C, keeping |D - M| = |M - D'| large enough to read.
real halfBase = 37.5;
real apexX = 55;
real apexY = 90;

pair B = (-halfBase, 0);
pair C = (halfBase, 0);
pair A = (apexX, apexY);

pair dirA = unit(B - A) + unit(C - A);
pair dirBext = unit(B - A) + unit(C - B);
pair Ia = extension(A, A + dirA, B, B + dirBext);
real ra = abs(Ia - Foot(Ia, B, C));
pair D = Foot(Ia, B, C);

pair F = Foot(Ia, A, B);
pair E = Foot(Ia, A, C);
real extensionBuffer = 10;
pair Yex = ExtendPast(A, F, extensionBuffer);
pair Xex = ExtendPast(A, E, extensionBuffer);

pair dirBin = unit(A - B) + unit(C - B);
pair dirCin = unit(A - C) + unit(B - C);
pair Iin = extension(B, B + dirBin, C, C + dirCin);
real rin = abs(Iin - Foot(Iin, B, C));
pair Din = Foot(Iin, B, C);

pair M = Midpoint(B, C);

Circle(Ia, ra, LightBlue);
Circle(Iin, rin, LightBlue);

Draw(A, B);
Draw(B, C);
Draw(C, A);
Draw(B, Yex, vertexPen);
Draw(C, Xex, vertexPen);

// Din, M, D all lie on segment BC, so the red segments overlap the black BC
// edge. Drawn after BC (rather than before, per the usual colored-before-black
// order) so the red stays visible instead of being overpainted.
Draw(Din, M, Red);
Draw(M, D, Red);
ParallelMark(Din, M, count = 1);
ParallelMark(M, D, count = 1);

LabeledDot(A, "A", N);
LabeledDot(B, "B", W);
LabeledDot(C, "C", (1,0));
LabeledDot(D, "D", N, halo = true);
LabeledDot(Din, "D'", N, halo = true);
LabeledDot(M, "M", S, halo = true);
LabeledDot(Iin, "I", N);
LabeledDot(Ia, "I_a", W);
