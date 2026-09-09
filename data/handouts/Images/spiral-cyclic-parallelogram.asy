import _common;

real R = 72;
real thetaA = 191.04;
real thetaB = 140.54;
real thetaC = 94.84;
real thetaD = 30.72;

pair A = R*dir(thetaA);
pair B = R*dir(thetaB);
pair C = R*dir(thetaC);
pair D = R*dir(thetaD);

pair S = extension(A, C, B, D);
pair F = extension(A, B, D, C);

// ABDE is a parallelogram, so its diagonals AD and BE share a midpoint.
pair E = A + D - B;

// G is the fixed point of the spiral similarity z -> ratio*z + translation
// sending A to C and B to D; solving G = ratio*G + translation gives it directly.
pair ratio = (C - D)/(A - B);
pair translation = C - ratio*A;
pair G = translation/(1 - ratio);

AngleMark(A, F, S, LightYellow, radius = Radius3);
AngleMark(E, C, D, LightYellow, radius = Radius3);

Circle((0, 0), R, LightBlue);
CircleThrough(A, C, F, LightBlue);
DashedDraw(F, G, Purple);
Draw(A, B, Green);
Draw(C, D, Red);

Draw(B, C);
Draw(D, A);
Draw(A, C);
Draw(B, D);
Draw(B, F);
Draw(C, F);
Draw(A, E);
Draw(D, E);
Draw(C, E);
Draw(A, G, vertexPen);
Draw(C, G, vertexPen);

LabeledDot(A, "A", SW);
LabeledDot(B, "B", W);
LabeledDot(C, "C", NE);
LabeledDot(D, "D", (0.91, 0.41));
LabeledDot(S, "S", SE);
LabeledDot(F, "F", NW);
LabeledDot(E, "E", SE, 1);
LabeledDot(G, "G", (1, -0.2));
