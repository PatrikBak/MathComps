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

Draw(S, A, vertexPen);
Draw(S, B, vertexPen);
Draw(S, C, vertexPen);
Draw(S, D, vertexPen);

BaseDots();
LabeledDot(S, "S", SW, 1, (11.6, -2));
LabeledDot(Sprime, "S'", E, (-1,1));
LabeledDot(X, "X", NE, 1);
LabeledDot(Y, "Y", NE, distanceOffset = 1);

EqualMark(A, C, placement = 0.85);
EqualMark(B, D, placement = 0.85);
