include "spiral-miquel-others-shared.asy";

real pastM1 = 12;

pair Opab = Circumcenter(P, A, B);
pair Opcd = Circumcenter(P, C, D);

// Circles (PAB) and (PCD) both pass through P, so their second common point is
// the mirror image of P across their line of centres. It lies on (QAC) and
// (QBD) too, and, because ABCD is cyclic, on line PQ.
pair M1 = ReflectAcross(P, Opab, Opcd);

CircleThrough(P, A, B, LightBlue);
CircleThrough(P, C, D, LightBlue);
CircleThrough(Q, A, C, LightBlue);
CircleThrough(Q, B, D, LightBlue);

BaseEdgesThroughQ();
Draw(A, C);
Draw(B, D);
Draw(Q, ExtendPast(Q, M1, pastM1));

BaseDots();
LabeledDot(P, "P", (-0.34, -0.94), 3, halo = true);
LabeledDot(M1, "M_1", (-0.59, -0.72), 3);
LabeledDot(Q, "Q", (0.91, -0.41), 3);
