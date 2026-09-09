import _common;

real R = 86;
real angleA = 100;
real alpha = 25;
real fractionD = 0.4;
real fractionE = 0.6;
real fractionF = 0.35;

pair A = R * dir(angleA);
pair B = R * dir(180 + alpha);
pair C = R * dir(360 - alpha);

pair D = B + fractionD * (C - B);
pair E = C + fractionE * (A - C);
pair F = A + fractionF * (B - A);

// Circles (AEF) and (BFD) both pass through F, so their other common point,
// the Miquel point, is the mirror image of F across their line of centres.
// The third circle passes through it by the theorem.
pair M = ReflectAcross(F, Circumcenter(A, E, F), Circumcenter(B, F, D));

CircleThrough(A, E, F, LightBlue);
CircleThrough(B, F, D, LightBlue);
CircleThrough(C, D, E, LightBlue);

Draw(A, B);
Draw(B, C);
Draw(C, A);

LabeledDot(A, "A", N);
LabeledDot(B, "B", SW);
LabeledDot(C, "C", SE);
LabeledDot(D, "D", S, (-2,0));
LabeledDot(E, "E", NE);
LabeledDot(F, "F", NW);
LabeledDot(M, "M", SE, (0,2));
