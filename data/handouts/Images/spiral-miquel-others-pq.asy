include "spiral-miquel-others-shared.asy";

real pastM1 = 12;

pair Opab = Circumcenter(P, A, B);
pair Opcd = Circumcenter(P, C, D);

// Circles (PAB) and (PCD) both pass through P, so their second common point is
// the mirror image of P across their line of centres. It lies on (QAC) and
// (QBD) too, and, because ABCD is cyclic, on line PQ.
pair M1 = ReflectAcross(P, Opab, Opcd);

CircleThrough(P, A, B, LightPurple);
CircleThrough(P, C, D, LightPurple);
CircleThrough(Q, A, C, LightOrange);
CircleThrough(Q, B, D, LightOrange);

BaseEdgesThroughQ();
Draw(A, C);
Draw(B, D);
Draw(Q, ExtendPast(Q, M1, pastM1));

BaseDots();
LabeledDot(A, "A", W, 3);
LabeledDot(B, "B", SE, 1, offset = (-3.2, -3.3));
LabeledDot(P, "P", S, 2, offset = (-4.6, -0.6));
LabeledDot(M1, "M_1", SW, 2, offset = (2.4, -0.9));
LabeledDot(Q, "Q", E, 3, (0, -3));
