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
// Labels C and D, in the same place in both figures. A, B, P, the outer point
// and the spiral centre are left to each figure, since the circles it draws
// pass through them.
//
void BaseDots()
{
    LabeledDot(C, "C", E, 1, halo = true);
    LabeledDot(D, "D", N, 3);
}
