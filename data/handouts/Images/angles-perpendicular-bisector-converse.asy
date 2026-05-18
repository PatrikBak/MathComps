import _common;

real halfBase = 45;
real apexHeight = 70;
real apexOffset = 30;
real bisectorBelow = 35;
real bisectorAbove = 90;

pair A = (-halfBase, 0);
pair B = (halfBase, 0);
pair M = (0, 0);
pair X = (-halfBase - apexOffset, apexHeight);

// Y is the intersection of XB with the perpendicular bisector of AB through M.
pair Y = extension(X, B, M, M + (0, 1));

AngleMark(B, A, X, LightGreen, radius = Radius3);
AngleMark(X, B, A, Green, radius = Radius3);
AngleMark(B, A, Y, Green, radius = Radius2);

Draw(A, B);
Draw(X, A);
Draw(X, B);
DashedDraw(M + (0, -bisectorBelow), M + (0, bisectorAbove));
Draw(Y, A, Red);
Draw(Y, B, Red);

LabeledDot(A, "A", SW);
LabeledDot(B, "B", SE);
LabeledDot(M, "M", SE);
LabeledDot(X, "X", NW);
LabeledDot(Y, "Y", NE);
