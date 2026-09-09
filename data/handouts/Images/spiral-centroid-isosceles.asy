import _common;

real lenBC = 172;
real apexAlong = 0.32;
real apexHeight = 121;

pair B = (0, 0);
pair C = (lenBC, 0);
pair A = (apexAlong * lenBC, apexHeight);

//
// Apex of the right isosceles triangle with hypotenuse PQ and the right
// angle at the apex: the median from the apex to the hypotenuse of a right
// triangle is half the hypotenuse, and the two legs' equality puts the apex on
// the perpendicular bisector of PQ. Returns the apex on whichever side of line
// PQ holds refPoint, matching the problem's "half-plane" condition.
//
pair RightIsoscelesApex(pair P, pair Q, pair refPoint)
{
    pair mid = Midpoint(P, Q);
    pair hypDir = unit(Q - P);
    pair hypPerp = (-hypDir.y, hypDir.x);
    real half = abs(Q - P) / 2;
    pair candidate = mid + half * hypPerp;
    return dot(refPoint - mid, hypPerp) >= 0 ? candidate : mid - half * hypPerp;
}

pair T = (A + B + C) / 3;
pair D = Midpoint(B, C);
pair K = RightIsoscelesApex(T, B, C);
pair L = RightIsoscelesApex(T, C, A);
pair E = Midpoint(K, L);

RightAngleMark(T, K, B, radius = Radius2);
RightAngleMark(T, L, C, radius = Radius2);
RightAngleMark(T, E, D, radius = Radius1);

Draw(B, C, Green);
Draw(K, L, Red);

Draw(A, B);
Draw(A, C);
Draw(A, D);
Draw(D, E);
Draw(T, E);
Draw(T, B);
Draw(T, C);
Draw(T, K);
Draw(T, L);
Draw(B, K);
Draw(C, L);

LabeledDot(A, "A", N);
LabeledDot(B, "B", SW);
LabeledDot(C, "C", SE);
LabeledDot(D, "D", S);
LabeledDot(T, "T", NW);
LabeledDot(K, "K", S);
LabeledDot(L, "L", NE);
LabeledDot(E, "E", SE);
