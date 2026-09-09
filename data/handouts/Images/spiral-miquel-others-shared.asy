import _common;

// ABCD sits on a circle of radius circumRadius centred at O, placed by arc
// lengths: AB spans 2 * halfAB with its midpoint straight below O, so AB is
// horizontal; C follows B by arcBC and D precedes A by arcDA.
real circumRadius = 53.5;
real halfAB = 67;
real arcBC = 46.2;
real arcDA = 143.9;

pair O = (0, 0);
pair A = Polar(O, 270 - halfAB, circumRadius);
pair B = Polar(O, 270 + halfAB, circumRadius);
pair C = Polar(O, 270 + halfAB + arcBC, circumRadius);
pair D = Polar(O, 270 - halfAB - arcDA, circumRadius);

pair P = extension(A, C, B, D);
pair Q = extension(A, B, C, D);
pair R = extension(A, D, B, C);

//
// Draws the circumcircle and the four sides of ABCD, with the pair of sides
// that meets at Q run out to it and the other pair left as plain sides.
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
// The mirror image of BaseEdgesThroughQ: AD and BC run out to R, and AB and CD
// stay sides.
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
// Labels the four vertices, in the same place in both figures. P, the outer
// point and the spiral centre are left to each figure, since they depend on
// which circles it draws.
//
void BaseDots()
{
    LabeledDot(A, "A", (-0.93, -0.37), 4);
    LabeledDot(B, "B", (0.5, -0.87), 4);
    LabeledDot(C, "C", (0.88, 0.47), 4);
    LabeledDot(D, "D", (-0.03, 1), 4);
}
