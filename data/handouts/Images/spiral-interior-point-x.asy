import _common;

// Triangle ADX has base AD and base angles alpha (at A) and delta (at D); X is
// its apex. lenAD sets the whole figure's scale.
real lenAD = 94;
real alpha = 75;   // |angle DAX| = |angle CBX|
real delta = 42;   // |angle ADX| = |angle BCX|

// B, C are the images of A, D under the indirect similarity centred at X: it
// reflects the local frame at X (via conj), then scales by mirrorScale and
// rotates by mirrorAngle. Being orientation-reversing, it turns BCX into a
// mirror-similar copy of ADX with A -> B, D -> C, X -> X, so the angle
// hypotheses at B and C hold automatically, for any choice of the two reals.
real mirrorScale = 0.80;
real mirrorAngle = 25;

pair A0 = (0, 0);
pair D0 = (lenAD, 0);
pair X0 = extension(A0, A0 + dir(alpha), D0, D0 + dir(180 - delta));

pair mirrorCoeff = mirrorScale * dir(mirrorAngle);
pair B0 = X0 + mirrorCoeff * conj(A0 - X0);
pair C0 = X0 + mirrorCoeff * conj(D0 - X0);

// The construction above lists A, B, C, D clockwise. Reflecting it across the
// x-axis first makes them counterclockwise, so that the turn putting AB along
// the bottom leaves the quadrilateral standing above AB instead of hanging
// below it. Every AngleMark below has its sweep reversed to match.
transform layout = rotate(degrees(B0 - A0)) * reflect((0, 0), (1, 0));
pair A = layout * A0;
pair B = layout * B0;
pair C = layout * C0;
pair D = layout * D0;
pair X = layout * X0;

pair M = Midpoint(A, B);
pair midCD = Midpoint(C, D);
pair Y = extension(M, M + rotate(90) * (B - A), midCD, midCD + rotate(90) * (D - C));

// T is the image of X under the spiral similarity centred at A sending D -> Y,
// via complex division/multiplication: that spiral's ratio and angle are
// outputs of the construction (through Y), not free parameters to plug into
// rotate()/scale.
pair T = A + (X - A) * (Y - A) / (D - A);

pen deltaPen = LightGreen;
pen alphaPen = LightYellow;
pen anglePen = Red + Font2;

AngleMark(A, D, X, deltaPen, "\delta", radius = Radius2, labelPen = anglePen);
AngleMark(X, C, B, deltaPen, "\delta", radius = Radius2, labelPen = anglePen);
// The two wedges at Y share ray YM.
AngleMark(A, Y, M, deltaPen, "\delta", radius = Radius1, labelOffset = 2, labelPen = anglePen);
AngleMark(M, Y, B, deltaPen, "\delta", radius = Radius1Nudged, labelOffset = 2, labelPen = anglePen);
AngleMark(X, A, D, alphaPen, "\alpha", radius = Radius2, labelPen = anglePen, offset = (-4, 1.8));
AngleMark(C, B, X, alphaPen, "\alpha", radius = Radius2, labelPen = anglePen, offset = (3.1, 0.1));

// The perpendicular bisector of CD, carried a little past CD.
DashedDraw(ExtendPast(Y, midCD, 12), Y, Purple);

// T lies on ray YM, so the image segment YT covers the AB-bisector's Y-to-M stretch.
Draw(Y, T, Red);

Draw(D, X, Green);
Draw(A, T);

Draw(A, B);
Draw(B, C);
Draw(C, D);
Draw(D, A);
Draw(A, X);
Draw(B, X);
Draw(C, X);
Draw(A, Y);
Draw(B, Y);

LabeledDot(A, "A", SW, 1);
LabeledDot(B, "B", SE, 1);
LabeledDot(C, "C", NE, 1);
LabeledDot(D, "D", NW, 1);
LabeledDot(X, "X", S);
LabeledDot(Y, "Y", W, offset = (2.5, 3.5));
LabeledDot(M, "M", SW, 1);
LabeledDot(T, "T", SW, 1);
