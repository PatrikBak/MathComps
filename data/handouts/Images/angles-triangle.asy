import _common;

real base = 150, alphaB = 70, gammaC = 40;
pair B = (0, 0);
pair C = (base, 0);
pair A = extension(B, Polar(B, alphaB, 1), C, Polar(C, 180 - gammaC, 1));

real apexLeftPad = 40, apexRightPad = 60;
pair Hleft = (A.x - apexLeftPad, A.y);
pair Hright = (A.x + apexRightPad, A.y);

AngleMark(C, B, A, LightRed, "\beta");
AngleMark(A, C, B, LightPink, "\gamma");
AngleMark(B, A, C, LightBlue, "\alpha");
AngleMark(Hleft, A, B, LightRed, "\beta");
AngleMark(C, A, Hright, LightPink, "\gamma", labelFraction=1.4);

Draw(B, A);
Draw(A, C);
Draw(B, C);
Draw(Hleft, A);
Draw(A, Hright);

ParallelMark(B, C);
ParallelMark(A, Hright, placement=0.7);

LabeledDot(A, "A", N);
LabeledDot(B, "B", SW);
LabeledDot(C, "C", SE);
LabeledDot(O, "O", S);
