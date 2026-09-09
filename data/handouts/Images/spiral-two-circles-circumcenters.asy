import _common;

real r1 = 66;            // radius of omega_1
real r2 = 52;            // radius of omega_2
real centerDist = 89;    // distance between the centres of omega_1 and omega_2
real angleA1Deg = 190;   // angular position of A1 on omega_1, from the centre
real angleB1Deg = 95;   // angular position of B1 on omega_1, from the centre
real axisProbeLength = 50; // arbitrary positive length; only fixes a direction below

pair O1 = (0, 0);
pair O2 = (centerDist, 0);

// The radical axis of two intersecting circles is exactly the line through
// their two intersection points, so meeting it with omega_1 gives P and Q.
pair[] axisPts = RadicalAxis(O1, r1, O2, r2, axisProbeLength);
pair[] PQ = LineCircleIntersections(axisPts[0], axisPts[1], O1, r1);
pair P = PQ[0];
pair Q = PQ[1];

pair A1 = Polar(O1, angleA1Deg, r1);
pair B1 = Polar(O1, angleB1Deg, r1);

// Line A1P meets omega_2 again at A2; the other root of the intersection is
// P itself, since P lies on both circles by construction.
pair[] hitsA = LineCircleIntersections(A1, P, O2, r2);
pair A2 = OtherIntersection(hitsA, P);

pair[] hitsB = LineCircleIntersections(B1, P, O2, r2);
pair B2 = OtherIntersection(hitsB, P);

pair C = extension(A1, B1, A2, B2);

// O is the circumcentre of A1A2C; the solution's key lemma is that this
// circle also passes through Q.
pair O = Circumcenter(A1, A2, C);
real rO = abs(O - A1);

// Circle CB1B2, the second circle of the centre theorem applied at C. It is
// the circle QB1B2, which is why Q lies on it.
pair O2circle = Circumcenter(Q, B1, B2);
real r2circle = abs(O2circle - Q);

Circle(O1, r1, LightBlue);
Circle(O2, r2, LightBlue);
Circle(O, rO, LightBlue);
Circle(O2circle, r2circle, LightBlue);

// Triangle QA1O: the solution's whole argument is that its angles are fixed.
DashedDraw(Q, A1, Purple);
DashedDraw(Q, O, Purple);
DashedDraw(O, A1, Purple);

// The two remaining spokes from Q.
DashedDraw(Q, A2, Purple);
DashedDraw(Q, B1, Purple);

// The spiral similarity centred at Q takes A1A2 (green) to B1B2 (red);
// P sits strictly between the two named points on each segment.
Draw(A1, A2, Green);
Draw(B1, B2, Red);

Draw(A1, C);
Draw(C, B2);

LabeledDot(A1, "A_1", W);
LabeledDot(B1, "B_1", NW);
LabeledDot(P, "P", S);
LabeledDot(Q, "Q", S);
LabeledDot(A2, "A_2", NE);
LabeledDot(B2, "B_2", E);
LabeledDot(C, "C", N);
LabeledDot(O, "O", W, halo = true);
