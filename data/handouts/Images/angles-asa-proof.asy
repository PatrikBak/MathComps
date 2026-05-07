import _common;

real base = 120, height = 65;
pair B = (0, 0);
pair C = (base, 0);
pair A = (base / 2, height);
pair Ap = ReflectAcross(A, B, C);

AngleMark(C, B, A, LightBlue, "\alpha");
AngleMark(Ap, B, C, LightBlue, "\alpha");
AngleMark(A, C, B, LightRed, "\beta");
AngleMark(B, C, Ap, LightRed, "\beta");

Draw(B, C, Green);
Draw(B, A);
Draw(A, C);
Draw(B, Ap);
Draw(Ap, C);

LabeledDot(B, "B", W, Blue);
LabeledDot(C, "C", E, Red);
LabeledDot(A, "A", N, Green);
LabeledDot(Ap, "A'", S, Green);
