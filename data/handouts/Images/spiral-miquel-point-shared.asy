import _common;

// Convex ABCD with AB horizontal, chosen so that Q = AB ∩ CD lands just past B
// and R = AD ∩ BC just above the quadrilateral: all four Miquel circles then fit
// the frame. D sits well off the circle ABC, so nothing is cyclic.
real lenAB = 87;
real xC = 57;
real yC = 40;
real xD = 8;
real yD = 60;

pair A = (0, 0);
pair B = (lenAB, 0);
pair C = (xC, yC);
pair D = (xD, yD);

pair Q = extension(A, B, C, D);
pair R = extension(A, D, B, C);

// Circles (RAB) and (RDC) share R, so their other common point, the Miquel
// point M, is the mirror image of R across their line of centres.
pair M = ReflectAcross(R, Circumcenter(R, A, B), Circumcenter(R, D, C));

//
// Draws the four sides of ABCD, each extended as one segment to the
// intersection point it reaches: AB and DC run to Q, AD and BC run to R.
//
void BaseEdges()
{
    Draw(A, Q);
    Draw(D, Q);
    Draw(A, R);
    Draw(B, R);
}

//
// Labels the six points of the complete quadrilateral. M is labeled locally.
//
void BaseDots()
{
    LabeledDot(A, "A", SW);
    LabeledDot(B, "B", S);
    LabeledDot(C, "C", SW);
    LabeledDot(D, "D", W);
    LabeledDot(Q, "Q", SE);
    LabeledDot(R, "R", NW);
}
