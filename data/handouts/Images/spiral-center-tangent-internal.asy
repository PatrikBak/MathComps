import _common;

// The circles ABY and CDY touch at Y from the inside: C and D sit on the rays
// YA and YB at homothetyRatio of the way, so the homothety AB -> CD has centre
// Y and a positive coefficient, and it carries circle ABY onto circle CDY.
real distYA = 100;
real distYB = 88;
real angleYA = 185;
real angleYB = 265;
real homothetyRatio = 0.5;

pair Y = (0, 0);
pair A = Polar(Y, angleYA, distYA);
pair B = Polar(Y, angleYB, distYB);
pair C = Y + homothetyRatio * (A - Y);
pair D = Y + homothetyRatio * (B - Y);

pair O1 = Circumcenter(A, B, Y);
pair O2 = Circumcenter(C, D, Y);

Circle(O1, abs(A - O1), LightBlue);
Circle(O2, abs(C - O2), LightBlue);

Draw(A, B, Green);
Draw(C, D, Red);

Draw(A, Y);
Draw(B, Y);

LabeledDot(A, "A", W, offset = (1.7, 8.2));
LabeledDot(B, "B", S, offset = (1.9, 0.7));
LabeledDot(C, "C", NW, 1, offset = (3.3, 3.4));
LabeledDot(D, "D", E, offset = (-3.2, -0.8));
LabeledDot(Y, "Y", NE, 1, offset = (-2.4, 9.1));
