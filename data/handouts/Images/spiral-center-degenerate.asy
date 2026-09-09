import _common;

// X = D: the point D lies on AC, so C sits past D on ray AD. The circle CDX
// degenerates to the circle through C and D tangent to line BD at D.
real lenAB = 104;
real xD = 33;
real yD = 58;
real ratioAC = 2;
real tangentOverhang = 30;

pair A = (0, 0);
pair B = (lenAB, 0);
pair D = (xD, yD);
pair C = A + ratioAC * (D - A);

pair O1 = Circumcenter(A, B, D);

// The tangent circle's centre lies on the perpendicular to BD at D and on the
// perpendicular bisector of CD.
pair Mcd = Midpoint(C, D);
pair O2 = extension(D, D + rotate(90) * (D - B), Mcd, Mcd + rotate(90) * (D - C));

pair O = ReflectAcross(D, O1, O2);

// Line BD drawn a little past D so the tangency at D is visible.
pair Dpast = ExtendPast(B, D, tangentOverhang);

Circle(O1, abs(A - O1), LightBlue);
Circle(O2, abs(D - O2), LightBlue);

Draw(A, B, Green);
Draw(C, D, Red);

DashedDraw(O, A);
DashedDraw(O, B);
DashedDraw(O, C);
DashedDraw(O, D);

Draw(A, D);
Draw(B, Dpast);

LabeledDot(A, "A", SW);
LabeledDot(B, "B", SE);
LabeledDot(C, "C", N);
LabeledDot(D, "D", S, 5);
LabeledDot(O, "O", S + 0.2left, 5);
