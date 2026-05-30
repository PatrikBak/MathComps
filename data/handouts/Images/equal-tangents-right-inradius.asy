import _common;

real legBC = 160;
real legCA = 120;
real r = 40;

pair C = (0, 0);
pair B = (legBC, 0);
pair A = (0, legCA);

pair I = (r, r);
pair D = (r, 0);
pair E = (0, r);
pair F = Foot(I, A, B);

// Square C D I E: the two tangent segments from the right-angle vertex and the
// two radii to the leg-tangent points, all equal to r.
fill(C -- D -- I -- E -- cycle, LightYellow);

RightAngleMark(B, C, A, radius = Radius1);
RightAngleMark(C, D, I, radius = Radius1);
RightAngleMark(I, E, C, radius = Radius1);
RightAngleMark(D, I, E, radius = Radius1);
RightAngleMark(I, F, B, radius = Radius1);

Circle(I, r, LightBlue);

Draw(C, D, Green);
Draw(C, E, Green);
Draw(I, D, Green);
Draw(I, E, Green);
Draw(I, F, Green);

Draw(D, B);
Draw(E, A);
Draw(A, B);

LabeledDot(A, "A", NW);
LabeledDot(B, "B", SE);
LabeledDot(C, "C", SW);
LabeledDot(I, "I", N);

VertexDot(D);
VertexDot(E);
VertexDot(F);

EdgeLabel(C, D, "r", S, color = Green, fontScale = Font2);
EdgeLabel(E, C, "r", W, color = Green, fontScale = Font2);
// Compass `E` is shadowed by the local pair `E` (tangent point), so pass the
// east unit vector explicitly.
EdgeLabel(D, I, "r", (1, 0), color = Green, fontScale = Font2);
EdgeLabel(I, E, "r", N, color = Green, fontScale = Font2);
EdgeLabel(I, F, "r", (0.8, -0.6), color = Green, fontScale = Font2);
