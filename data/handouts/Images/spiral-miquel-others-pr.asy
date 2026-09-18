include "spiral-miquel-others-shared.asy";

real pastM2 = 12;

pair Opad = Circumcenter(P, A, D);
pair Opcb = Circumcenter(P, C, B);

// Circles (PAD) and (PCB) both pass through P, so their second common point is
// the mirror image of P across their line of centres. It lies on (RAC) and
// (RDB) too, and, because ABCD is cyclic, on line PR.
pair M2 = ReflectAcross(P, Opad, Opcb);

CircleThrough(P, A, D, LightOrange);
CircleThrough(P, C, B, LightOrange);
CircleThrough(R, A, C, LightPurple);
CircleThrough(R, D, B, LightPurple);

BaseEdgesThroughR();
Draw(A, C);
Draw(B, D);
Draw(R, ExtendPast(R, M2, pastM2));

BaseDots();
LabeledDot(A, "A", SW, 1);
LabeledDot(B, "B", S, 1, offset = (0.5, -1.4));
LabeledDot(P, "P", NW, 1, (0, -4.7));
LabeledDot(M2, "M_2", W, 3, halo = true, offset = (0, 1.5));
LabeledDot(R, "R", NE, 1, (-2.5, 2.3));
