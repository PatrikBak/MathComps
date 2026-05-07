import _common;

real sep = 40, theta = 70;
real lowerRightPad = 70, upperRightPad = 60;
pair B = (0, 0);
pair A = (sep / tan(radians(theta)), sep);
pair lowerRight = (lowerRightPad, 0);
pair upperRight = A + (upperRightPad, 0);

AngleMark(lowerRight, B, A, LightRed, radius=Radius2);
AngleMark(B, A, upperRight, LightBlue, radius=Radius2);

Draw(B, lowerRight);
Draw(A, upperRight);
Draw(B, A);

ParallelMark(B, lowerRight);
ParallelMark(A, upperRight);

VertexDots(new pair[] {B, A});

PointLabel(B, "B", SW);
PointLabel(A, "A", N);
