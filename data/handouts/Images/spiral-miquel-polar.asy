include "spiral-miquel-shared.asy";

real tangentPast = 14;

// The tangents at B and D meet at the pole of BD, which lies on the polar of
// P because P is on BD. The pair at A and C meets on line QR as well, but
// far above the figure; this pair lands on the segment QR itself.
pair T = extension(B, B + rotate(90) * (B - O), D, D + rotate(90) * (D - O));
pair tangentBEnd = ExtendPast(T, B, tangentPast);
pair tangentDEnd = ExtendPast(T, D, tangentPast);

BaseFills();

BaseEdges();
Draw(A, C);
Draw(B, D);
Draw(Q, R);
Draw(T, tangentBEnd);
Draw(T, tangentDEnd);

BaseDots();
LabeledDot(C, "C", (0.74, 0.67), 2);
LabeledDot(P, "P", S, 5);
VertexDot(T);
