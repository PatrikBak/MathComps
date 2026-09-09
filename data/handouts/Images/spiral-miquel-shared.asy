import _common;

// ABCD sits on a circle of radius circumRadius centred at O, placed by arc
// lengths: AB spans 2 * halfAB with its midpoint straight below O, so AB is
// horizontal; C follows B by arcBC and D precedes A by arcDA.
real circumRadius = 40;
real halfAB = 77;
real arcBC = 51;
real arcDA = 87;

pair O = (0, 0);
pair A = Polar(O, 270 - halfAB, circumRadius);
pair B = Polar(O, 270 + halfAB, circumRadius);
pair C = Polar(O, 270 + halfAB + arcBC, circumRadius);
pair D = Polar(O, 270 - halfAB - arcDA, circumRadius);

pair Q = extension(A, B, C, D);
pair R = extension(A, D, B, C);
pair P = extension(A, C, B, D);

pair Orab = Circumcenter(R, A, B);
pair Ordc = Circumcenter(R, D, C);

// The Miquel point is the second common point of circles (RAB) and (RDC);
// both pass through R, so it is the mirror image of R across their line of
// centres. For a cyclic ABCD it lands on segment QR as the foot of O.
pair M = ReflectAcross(R, Orab, Ordc);

//
// Nothing is filled in the base configuration; the hook keeps the sibling
// figures' layering uniform.
//
void BaseFills()
{
}

//
// Draws the circumcircle and the four sides of ABCD, each run out along its
// line to the intersection point it helps define: AB and CD to Q, AD and BC
// to R.
//
void BaseEdges()
{
    Circle(O, circumRadius, LightBlue);
    Draw(A, Q);
    Draw(D, Q);
    Draw(A, R);
    Draw(B, R);
}

//
// Draws the circumcircle and the four sides of ABCD, with only the pair of
// sides that meets at Q run out to it.
//
void BaseEdgesThroughQ()
{
    Circle(O, circumRadius, LightBlue);
    Draw(A, Q);
    Draw(D, Q);
    Draw(A, D);
    Draw(B, C);
}

//
// The mirror image of BaseEdgesThroughQ: only AD and BC run out, to R, and
// AB and CD stay sides.
//
void BaseEdgesThroughR()
{
    Circle(O, circumRadius, LightBlue);
    Draw(A, R);
    Draw(B, R);
    Draw(A, B);
    Draw(C, D);
}

//
// Draws the four circles (RAB), (RDC), (QAD), (QBC) that all pass through
// the Miquel point M.
//
void MiquelCircles()
{
    CircleThrough(R, A, B, LightBlue);
    CircleThrough(R, D, C, LightBlue);
    CircleThrough(Q, A, D, LightBlue);
    CircleThrough(Q, B, C, LightBlue);
}

//
// Labels A, B, D and the two outer intersection points. C, O, P and M are
// left to each figure.
//
void BaseDots()
{
    LabeledDot(A, "A", W, 3);
    LabeledDot(B, "B", (0.62, -0.79), 5);
    LabeledDot(D, "D", NW, 3);
    LabeledDot(Q, "Q", S, 5);
    LabeledDot(R, "R", N, 4);
}
