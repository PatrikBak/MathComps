import _common;

real r1 = 36;
real r2 = 42;
real separation = 90;
real lineExtension = 18;

pair O1 = (-separation / 2, 0);
pair O2 = (separation / 2, 0);

pair[] top = CommonExternalTangent(O1, r1, O2, r2, -1);
pair A = top[0];
pair B = top[1];

pair[] bottom = CommonExternalTangent(O1, r1, O2, r2, +1);
pair C = bottom[0];
pair D = bottom[1];

pair[] internal = CommonInternalTangent(O1, r1, O2, r2, +1);
pair K = internal[0];
pair L = internal[1];

pair X = extension(A, B, K, L);
pair Y = extension(C, D, K, L);

pair Atip = ExtendPast(B, A, lineExtension);
pair Btip = ExtendPast(A, B, lineExtension);
pair Ctip = ExtendPast(D, C, lineExtension);
pair Dtip = ExtendPast(C, D, lineExtension);
pair Xtip = ExtendPast(Y, X, lineExtension);
pair Ytip = ExtendPast(X, Y, lineExtension);

Circle(O1, r1, LightBlue);
Circle(O2, r2, LightBlue);

Draw(Atip, A, vertexPen);
Draw(B, Btip, vertexPen);
Draw(Ctip, Dtip, vertexPen);
Draw(Xtip, X, vertexPen);
Draw(Y, Ytip, vertexPen);

// Green segments are collinear with the black extensions on the same lines,
// so they're drawn after (rather than before) to stay visible where they
// share pixels with the black continuation.
Draw(A, B, Green);
Draw(X, Y, Green);

LabeledDot(A, "A", NW);
LabeledDot(B, "B", N);
LabeledDot(C, "C", S);
LabeledDot(D, "D", S);
LabeledDot(X, "X", NE);
LabeledDot(Y, "Y", SW);
