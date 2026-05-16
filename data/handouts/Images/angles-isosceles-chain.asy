import _common;

real s = 110;
pair A = (0, 0);
pair B = (s, 0);
real apexHeight = s/2 * tan(72 * pi / 180);
pair C = (s/2, apexHeight);
pair D = C + s * unit(B - C);
pair E = C + s * unit(A - C);

real r = Radius2;
pen p = Font2;

AngleMark(A, C, B, LightPink, "\gamma", radius = Radius3, labelFraction = 1.4, labelPen = p);
AngleMark(D, B, E, LightPink, "\gamma", radius = Radius3, labelFraction = 1.5, labelPen = p);
AngleMark(C, D, E, LightGreen, "2\gamma", radius = r, labelFraction = 1.6, labelPen = p);
AngleMark(D, E, C, LightGreen, "2\gamma", radius = r, labelFraction = 1.6, labelPen = p);
AngleMark(B, E, D, LightPink, "\gamma", radius = r, labelFraction = 1.9, labelPen = p);

Draw(A, B, Blue);
Draw(B, D, Red);
Draw(D, C, Blue);
Draw(C, E, Blue);
Draw(E, A, Red + dashedPen);
Draw(B, E, Blue);
Draw(D, E, Red);
Draw(A, D, Blue + dashedPen);

LabeledDot(A, "A", SW);
LabeledDot(B, "B", SE);
LabeledDot(C, "C", N);
LabeledDot(D, "D", (1, 0));
LabeledDot(E, "E", W);
