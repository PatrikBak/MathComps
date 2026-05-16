import _common;

real s = 160;
pair A = (0, 0);
pair B = (s, 0);
pair C = (s, s);
pair D = (0, s);
pair X = EquilateralTriangle(A, B);
pair Y = EquilateralTriangle(C, D);

void BaseFills()
{
    fill(A -- B -- X -- cycle, LightBlue + opacity(0.3));
    fill(C -- D -- Y -- cycle, LightGreen + opacity(0.3));
}

void BaseEdges()
{
    Draw(A, B);
    Draw(B, C);
    Draw(C, D);
    Draw(D, A);
    Draw(A, X);
    Draw(B, X);
    Draw(C, Y);
    Draw(D, Y);
}

void BaseDots()
{
    LabeledDot(A, "A", SW);
    LabeledDot(B, "B", SE);
    LabeledDot(C, "C", NE);
    LabeledDot(D, "D", NW);
    LabeledDot(X, "X", N);
    LabeledDot(Y, "Y", S);
}
