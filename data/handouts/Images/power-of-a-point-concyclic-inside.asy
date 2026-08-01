import _common;

real r1 = 46;
real r2 = 38;
real halfSeparation = 22;
real crossingHeight = 9.5;
real chordAngleK = 150;
real chordAngleL = 32;
real axisHalfLength = 57;

pair O1 = (-halfSeparation, 0);
pair O2 = (halfSeparation, 0);

// The crossing X sits on the radical axis again, but this time between the two
// circle intersections, so it lies inside both circles and the two secants meet
// as crossing chords rather than as rays from an outside point.
pair[] axis = RadicalAxis(O1, r1, O2, r2, axisHalfLength);
pair[] crossing = RadicalAxis(O1, r1, O2, r2, crossingHeight);
pair X = crossing[0];

pair[] hitsK = LineCircleIntersections(X, Polar(X, chordAngleK, 1), O1, r1);
pair K1 = hitsK[0];
pair K2 = hitsK[1];

pair[] hitsL = LineCircleIntersections(X, Polar(X, chordAngleL, 1), O2, r2);
pair L1 = hitsL[0];
pair L2 = hitsL[1];

pair S = Circumcenter(K1, K2, L1);

Circle(O1, r1, LightBlue);
Circle(O2, r2, LightBlue);
Circle(S, abs(K1 - S), LightPurple);

Draw(axis[0], axis[1], Red);

Draw(K1, K2, Green);
Draw(L1, L2, Green);

VertexDot(X);

LabeledDot(K1, "K_1", SE);
LabeledDot(K2, "K_2", NW);
LabeledDot(L1, "L_1", SW);
LabeledDot(L2, "L_2", NE);
