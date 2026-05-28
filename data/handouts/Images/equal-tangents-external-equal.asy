import _common;

real r1 = 22;
real r2 = 38;
real separation = 110;
real lineExtension = 18;

pair O1 = (-separation / 2, 0);
pair O2 = (separation / 2, 0);

pair[] top = CommonExternalTangent(O1, r1, O2, r2, -1);
pair A = top[0];
pair B = top[1];

pair[] bottom = CommonExternalTangent(O1, r1, O2, r2, +1);
pair C = bottom[0];
pair D = bottom[1];

pair Atip = ExtendPast(B, A, lineExtension);
pair Btip = ExtendPast(A, B, lineExtension);
pair Ctip = ExtendPast(D, C, lineExtension);
pair Dtip = ExtendPast(C, D, lineExtension);

Circle(O1, r1, LightBlue);
Circle(O2, r2, LightBlue);

Draw(Atip, A, vertexPen);
Draw(B, Btip, vertexPen);
Draw(Ctip, C, vertexPen);
Draw(D, Dtip, vertexPen);

// Green tangent segments are collinear with the black `Atip-A`, `B-Btip` etc.
// extensions, so they're drawn after (rather than before) to stay visible
// where they share pixels with the black continuation.
Draw(A, B, Green);
Draw(C, D, Green);

LabeledDot(A, "A", N);
LabeledDot(B, "B", N);
LabeledDot(C, "C", S);
LabeledDot(D, "D", S);
