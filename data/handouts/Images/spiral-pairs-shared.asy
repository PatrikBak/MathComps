import _common;

// The spiral similarity centred at O takes A to Ap and B to Bp: a rotation by
// spiralAngle composed with a scaling by spiralScale. AB is long enough to
// carry a marked interior point, and the angle is large enough that the
// image triangle O-Ap-Bp clears the original OAB.
real spiralAngle = 50;
real spiralScale = 0.8;
real distOA = 62;
real distOB = 120;
real angleOA = -8;
real angleOB = 18;

pair O = (0, 0);
pair A = Polar(O, angleOA, distOA);
pair B = Polar(O, angleOB, distOB);
pair Ap = O + spiralScale * (rotate(spiralAngle) * (A - O));
pair Bp = O + spiralScale * (rotate(spiralAngle) * (B - O));

void BaseEdges()
{
    DashedDraw(O, A);
    DashedDraw(O, B);
    DashedDraw(O, Ap);
    DashedDraw(O, Bp);
}

// Every dot but Ap: the free side of Ap differs per figure.
void BaseDots()
{
    LabeledDot(O, "O", W);
    LabeledDot(A, "A", S);
    LabeledDot(B, "B", E);
    LabeledDot(Bp, "B'", N);
}
