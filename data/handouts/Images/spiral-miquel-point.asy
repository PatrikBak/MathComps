import _common;

// Convex ABCD with AB horizontal, chosen so that Q = AB ∩ CD lands just past B
// and R = AD ∩ BC just above the quadrilateral: all four Miquel circles then fit
// the frame. D sits well off the circle ABC, so nothing is cyclic.
real lenAB = 85.3;
real xC = 55.9;
real yC = 39.2;
real xD = 7.8;
real yD = 58.8;

pair A = (0, 0);
pair B = (lenAB, 0);
pair C = (xC, yC);
pair D = (xD, yD);

pair Q = extension(A, B, C, D);
pair R = extension(A, D, B, C);

// Circles (RAB) and (RDC) share R, so their other common point, the Miquel
// point M, is the mirror image of R across their line of centres.
pair M = ReflectAcross(R, Circumcenter(R, A, B), Circumcenter(R, D, C));

CircleThrough(R, A, B, LightPurple);
CircleThrough(R, D, C, LightPurple);
CircleThrough(Q, A, D, LightOrange);
CircleThrough(Q, B, C, LightOrange);

Draw(A, Q);
Draw(D, Q);
Draw(A, R);
Draw(B, R);

LabeledDot(A, "A", SW, 1);
LabeledDot(B, "B", S);
LabeledDot(C, "C", N+(0.35,0), 2);
LabeledDot(D, "D", W);
LabeledDot(Q, "Q", SE, 1);
LabeledDot(R, "R", NW, 1);
LabeledDot(M, "M", N);
