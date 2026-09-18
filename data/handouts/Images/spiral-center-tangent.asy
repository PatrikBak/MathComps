import _common;

// The circles ABY and CDY touch at Y, so Y is the centre of the homothety
// AB -> CD: C and D sit on rays YA and YB reflected through Y, scaled by
// homothetyRatio. |YA| and |YB| are kept close so the circles' common tangent
// at Y bisects angle AYB.
real distYA = 68;
real distYB = 60;
real angleYA = 185;
real angleYB = 265;
real homothetyRatio = 0.8;

pair Y = (0, 0);
pair A = Polar(Y, angleYA, distYA);
pair B = Polar(Y, angleYB, distYB);
pair C = Y - homothetyRatio * (A - Y);
pair D = Y - homothetyRatio * (B - Y);

pair O1 = Circumcenter(A, B, Y);
pair O2 = Circumcenter(C, D, Y);

Circle(O1, abs(A - O1), LightBlue);
Circle(O2, abs(C - O2), LightBlue);

Draw(A, B, Green);
Draw(C, D, Red);

Draw(A, C);
Draw(B, D);

LabeledDot(A, "A", W, offset = (-0.7, 6.5));
LabeledDot(B, "B", S);
LabeledDot(C, "C", E);
LabeledDot(D, "D", N, offset = (-4, 1.8));
LabeledDot(Y, "Y", SW, 1);
