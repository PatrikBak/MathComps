import _common;

real r = 27;

// P at 270° puts the tangent at P horizontal, so side AB is horizontal.
// Other angles chosen so A, B, C, D land counter-clockwise.
real angleP = 270;
real angleQ = 355;
real angleR = 110;
real angleS = 190;

pair I = (0, 0);

pair P = r * dir(angleP);
pair Q = r * dir(angleQ);
pair R = r * dir(angleR);
pair S = r * dir(angleS);

// The tangent at the point r*dir(θ) on the incircle runs perpendicular to the
// radius, i.e. in direction dir(θ+90°). Picking two points on each tangent line
// lets `extension(...)` recover the vertices as adjacent-tangent intersections.
pair Pdir = dir(angleP + 90);
pair Qdir = dir(angleQ + 90);
pair Rdir = dir(angleR + 90);
pair Sdir = dir(angleS + 90);

pair A = extension(S, S + Sdir, P, P + Pdir);
pair B = extension(P, P + Pdir, Q, Q + Qdir);
pair C = extension(Q, Q + Qdir, R, R + Rdir);
pair D = extension(R, R + Rdir, S, S + Sdir);

Circle(I, r, LightBlue);

Draw(A, P, Green);
Draw(A, S, Green);
Draw(B, P, Red);
Draw(B, Q, Red);
Draw(C, Q, Purple);
Draw(C, R, Purple);
Draw(D, R, Yellow);
Draw(D, S, Yellow);

real tangentPointDotRadius = 1.5;
VertexDot(P, Blue, radius = tangentPointDotRadius);
VertexDot(Q, Blue, radius = tangentPointDotRadius);
VertexDot(R, Blue, radius = tangentPointDotRadius);
VertexDot(S, Blue, radius = tangentPointDotRadius);

LabeledDot(A, "A", SW);
LabeledDot(B, "B", SE);
LabeledDot(C, "C", NE);
LabeledDot(D, "D", NW);
