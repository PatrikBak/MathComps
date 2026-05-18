import _common;

real halfBase = 45;
real apexHeight = 80;

pair A = (-halfBase, 0);
pair B = (halfBase, 0);
pair M = (0, 0);
pair X = (0, apexHeight);

RightAngleMark(B, M, X, color = LightBlue);

Draw(A, B);
Draw(X, M);
Draw(X, A, Red + dashedPen);
Draw(X, B, Red + dashedPen);

LabeledDot(A, "A", SW);
LabeledDot(B, "B", SE);
LabeledDot(M, "M", S);
LabeledDot(X, "X", N);
