import _common;

pair O = (0, 0);
real R = 75;

pair A = R * dir(100);
pair B = R * dir(215);
pair C = R * dir(325);

pair Mab = Midpoint(A, B);
pair Mac = Midpoint(A, C);
pair Mbc = Midpoint(B, C);

real pastMidpoint = 12;
real pastO = 22;

Circle(O, R, LightBlue);

Draw(A, B);
Draw(B, C);
Draw(C, A);

Draw(ExtendPast(O, Mab, pastMidpoint), ExtendPast(Mab, O, pastO), Green + dashedPen);
Draw(ExtendPast(O, Mac, pastMidpoint), ExtendPast(Mac, O, pastO), Green + dashedPen);
Draw(ExtendPast(O, Mbc, pastMidpoint), ExtendPast(Mbc, O, pastO), Red + dashedPen);

Draw(O, A, Green);
Draw(O, B, Green);
Draw(O, C, Green);

LabeledDot(A, "A", N);
LabeledDot(B, "B", SW);
LabeledDot(C, "C", SE);
LabeledDot(O, "O", NW, offset=(2,1.5));
