include "equal-tangents-excircle-shared.asy";

BaseEdges();

Draw(A, F, Green);
Draw(A, E, Green);

EdgeLabel(A, F, "s", W, color = Green, fontScale = Font2);
// Compass `E` is shadowed by the local pair `E` (tangent point), so pass the
// east unit vector explicitly.
EdgeLabel(A, E, "s", (1, 0), color = Green, fontScale = Font2);

BaseDots();
