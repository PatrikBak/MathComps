import _common;

// Same configuration as the statement figure.
real R = 76;
real angleA = 112;
real alpha = 25;
real angleD = 246;

pair O = (0, 0);
pair A = Polar(O, angleA, R);
pair B = Polar(O, 180 + alpha, R);
pair C = Polar(O, 360 - alpha, R);
pair D = Polar(O, angleD, R);
pair X = Foot(D, A, B);
pair Y = Foot(D, A, C);
pair Z = Foot(D, B, C);

// P is the preimage of Z under the spiral similarity centred at D taking B to
// X: undo that similarity's scaling and rotation on Z.
real spiralScale = abs(X - D) / abs(B - D);
real spiralAngle = degrees(X - D) - degrees(B - D);
pair P = D + (rotate(-spiralAngle) * (Z - D)) / spiralScale;

// The three right triangles DXB, DYC, DZP are similar: one green angle each.
AngleMark(X, B, D, LightGreen, "", Radius1);
AngleMark(Y, C, D, LightGreen, "", Radius1);
AngleMark(Z, P, D, LightGreen, "", Radius1);
RightAngleMark(A, X, D, Radius1, LightBlue);
RightAngleMark(C, Y, D, Radius1, LightBlue);
RightAngleMark(B, Z, D, Radius1, LightBlue);
Circle(O, R, LightBlue);
DashedDraw(D, X);
DashedDraw(D, Y);
DashedDraw(D, Z);
Draw(A, X);
Draw(A, C);
Draw(B, C);
Draw(D, B);
Draw(D, C);
Draw(D, P);
Draw(X, Y);
LabeledDot(A, "A", N);
LabeledDot(B, "B", W);
LabeledDot(C, "C", E);
LabeledDot(D, "D", S);
LabeledDot(P, "P", SE, 1, offset = (-4.5, 1.2));
LabeledDot(X, "X", SW, distanceOffset = 1);
LabeledDot(Y, "Y", N);
LabeledDot(Z, "Z", N);
