include "spiral-miquel-point-shared.asy";

// Scaled down slightly so the circle (QBC), the widest thing drawn, fits the frame.
real figureScale = 0.98;
transform rescale = scale(figureScale);
A = rescale * A;
B = rescale * B;
C = rescale * C;
D = rescale * D;
Q = rescale * Q;
R = rescale * R;
M = rescale * M;

CircleThrough(R, A, B, LightBlue);
CircleThrough(R, D, C, LightBlue);
CircleThrough(Q, A, D, LightBlue);
CircleThrough(Q, B, C, LightBlue);

BaseEdges();

BaseDots();
LabeledDot(M, "M", N);
