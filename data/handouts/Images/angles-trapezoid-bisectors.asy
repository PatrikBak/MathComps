import _common;

pair A = (0, 0);
pair B = (210, 0);
pair D = (54, 72);
pair C = (114, 72);
pair P = (90, 0);

AngleMark(A, D, P, LightBlue, radius = Radius3);
AngleMark(P, D, C, LightBlue, radius = Radius2);
AngleMark(D, C, P, LightGreen, radius = Radius2);
AngleMark(P, C, B, LightGreen, radius = Radius3);
AngleMark(D, P, A, LightBlue, radius = Radius3);
AngleMark(B, P, C, LightGreen, radius = Radius3);

Draw(A, B);
Draw(B, C);
Draw(C, D);
Draw(D, A);
Draw(D, P, black + dashedPen);
Draw(C, P, black + dashedPen);

LabeledDot(A, "A", SW);
LabeledDot(B, "B", SE);
LabeledDot(C, "C", NE);
LabeledDot(D, "D", NW);
LabeledDot(P, "P", S);
