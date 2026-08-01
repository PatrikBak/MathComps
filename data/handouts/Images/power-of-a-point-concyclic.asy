import _common;

real r1 = 34;
real r2 = 28;
real halfSeparation = 26;
real crossingHeight = 41;
real secantAngleK = 224;
real secantAngleL = 310;
real axisOverhang = 16;

pair O1 = (-halfSeparation, 0);
pair O2 = (halfSeparation, 0);

// The crossing X is put on the radical axis, so its two powers agree and the
// four secant points come out concyclic on their own — the figure shows the
// theorem rather than being fitted to it.
pair[] axis = RadicalAxis(O1, r1, O2, r2, crossingHeight);
pair X = axis[0];

pair[] hitsK = LineCircleIntersections(X, Polar(X, secantAngleK, 1), O1, r1);
pair K1 = hitsK[0];
pair K2 = hitsK[1];

pair[] hitsL = LineCircleIntersections(X, Polar(X, secantAngleL, 1), O2, r2);
pair L1 = hitsL[0];
pair L2 = hitsL[1];

pair S = Circumcenter(K1, K2, L1);

Circle(O1, r1, LightBlue);
Circle(O2, r2, LightBlue);
Circle(S, abs(K1 - S), LightPurple);

Draw(ExtendPast(axis[1], axis[0], axisOverhang), ExtendPast(axis[0], axis[1], axisOverhang), Red);

Draw(X, K2, Green);
Draw(X, L2, Green);

VertexDot(X);

LabeledDot(K1, "K_1", NW);
LabeledDot(K2, "K_2", SW);
LabeledDot(L1, "L_1", NE);
LabeledDot(L2, "L_2", SE);
