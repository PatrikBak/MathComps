import _common;

real sep = 55, theta = 70, apexExtra = 35;
real lowerRightPad = 75, upperRightPad = 65;
pair D = (0, 0);
pair A = (sep / tan(radians(theta)), sep);
pair Atop = ExtendPast(D, A, apexExtra);
pair Dright = (lowerRightPad, 0);
pair B = A + (upperRightPad, 0);

AngleMark(Dright, D, A, LightRed, "\alpha", labelFraction=1.25);
AngleMark(D, A, B, LightBlue, "\beta", labelFraction=1.3);
AngleMark(B, A, Atop, LightRed, "\alpha", labelFraction=1.3);

Draw(D, A);
Draw(A, Atop);
Draw(D, Dright);
Draw(A, B);

ParallelMark(D, Dright);
ParallelMark(A, B);

VertexDots(new pair[] {D, A, B});
PointLabel(D, "D", SW);
PointLabel(A, "A", NW);
PointLabel(B, "B", E);
