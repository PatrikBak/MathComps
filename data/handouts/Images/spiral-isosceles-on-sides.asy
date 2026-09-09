include "spiral-isosceles-on-sides-shared.asy";

// Where PQ meets RT — also the RightAngleMark's vertex.
pair crossPt = extension(P, Q, R, T);
RightAngleMark(P, crossPt, R, Radius1, LightBlue);

// The equal diagonals.
Draw(A, C, Purple);
Draw(B, D, Purple);

BaseEdges();

Draw(P, A);
Draw(P, B);
Draw(R, B);
Draw(R, C);
Draw(Q, C);
Draw(Q, D);
Draw(T, D);
Draw(T, A);

BaseDots();
LabeledDot(S, "S", SW, (9,-2));
LabeledDot(Sprime, "S'", E, (-1,1));

ParallelMark(A, C, count = 1, placement = 0.85);
ParallelMark(B, D, count = 1, placement = 0.85);
