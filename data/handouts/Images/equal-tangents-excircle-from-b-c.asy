include "equal-tangents-excircle-shared.asy";

BaseEdges();

Draw(B, F, Red);
Draw(B, D, Red);
Draw(C, D, Purple);
Draw(C, E, Purple);

EdgeLabel(B, D, "s - c", N, color = Red, fontScale = Font2);
EdgeLabel(B, F, "s - c", W, color = Red, fontScale = Font2);
EdgeLabel(C, D, "s - b", N, color = Purple, fontScale = Font2);
// Compass `E` is shadowed by the local pair `E` (tangent point), so pass the
// east unit vector explicitly.
EdgeLabel(C, E, "s - b", (1, 0), color = Purple, fontScale = Font2);

BaseDots();
