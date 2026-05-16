import _common;

real alpha = 100;
real lenBC = 50;
real lenDE = 50;
real lenAB = lenBC + lenDE;

pair A = (0, 0);
pair B = A + lenAB * dir(-90 - alpha/2);
pair E = A + lenAB * dir(-90 + alpha/2);
pair C = B + lenBC * (rotate(-alpha) * unit(A - B));
pair D = E + lenDE * (rotate(alpha) * unit(A - E));
pair P = A + (lenBC / lenAB) * (B - A);
pair Q = A + (lenDE / lenAB) * (E - A);

fill(P -- B -- C -- cycle, LightYellow + opacity(0.5));
fill(Q -- A -- P -- cycle, LightYellow + opacity(0.5));
fill(D -- E -- Q -- cycle, LightYellow + opacity(0.5));

AngleMark(C, B, A, LightBlue, radius = Radius2);
AngleMark(B, A, E, LightBlue, radius = Radius2);
AngleMark(A, E, D, LightBlue, radius = Radius2);

Draw(A, P, Green);
Draw(P, B, Red);
Draw(B, C, Green);
Draw(C, D);
Draw(D, E, Red);
Draw(E, Q, Green);
Draw(Q, A, Red);
Draw(C, P);
Draw(P, Q);
Draw(Q, D);

LabeledDot(A, "A", N);
LabeledDot(B, "B", W);
LabeledDot(C, "C", SW);
LabeledDot(D, "D", SE);
LabeledDot(E, "E", (1, 0));
LabeledDot(P, "P", NW);
LabeledDot(Q, "Q", NE);
