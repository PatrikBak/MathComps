include "spiral-miquel-others-shared.asy";

real pastM2 = 12;

pair Opad = Circumcenter(P, A, D);
pair Opcb = Circumcenter(P, C, B);

// Circles (PAD) and (PCB) both pass through P, so their second common point is
// the mirror image of P across their line of centres. It lies on (RAC) and
// (RDB) too, and, because ABCD is cyclic, on line PR.
pair M2 = ReflectAcross(P, Opad, Opcb);

CircleThrough(P, A, D, LightBlue);
CircleThrough(P, C, B, LightBlue);
CircleThrough(R, A, C, LightBlue);
CircleThrough(R, D, B, LightBlue);

BaseEdgesThroughR();
Draw(A, C);
Draw(B, D);
Draw(R, ExtendPast(R, M2, pastM2));

BaseDots();
LabeledDot(P, "P", (-0.5, 0.2), 3);
LabeledDot(M2, "M_2", (-0.99, 0.14), 3, halo = true);
LabeledDot(R, "R", (0.44, 0.9), 3);
