import _common;

// Convex ABCD with |AC| = |BD|: two diagonals of equal total length crossing
// at O, with A, C on opposite rays from O along dirAC and B, D on opposite
// rays along dirBD. Any two segments crossing like this give vertices in
// convex cyclic order A, B, C, D for free, as long as 0 < diagonalAngle < 180.
real diagonalAngle = 70;   // angle from diagonal AC to diagonal BD
real figureRotation = 20;  // whole-figure rotation, purely cosmetic

real lenOA = 91;
real lenOC = 39;
real lenOB = 71.5;
real lenOD = 58.5;

real apexAngle = 95; // shared apex angle of the four erected isosceles triangles

pair O = (0, 0);
pair dirAC = dir(0);
pair dirBD = dir(diagonalAngle);

pair A = rotate(figureRotation) * (O + lenOA * dirAC);
pair B = rotate(figureRotation) * (O + lenOB * dirBD);
pair C = rotate(figureRotation) * (O - lenOC * dirAC);
pair D = rotate(figureRotation) * (O - lenOD * dirBD);

// Apex of the isosceles triangle with apex angle angleDeg on directed side
// base -> tip, erected on the right of that direction — outward, given our
// counterclockwise A, B, C, D.
pair OuterApex(pair base, pair tip, real angleDeg)
{
    real height = (abs(tip - base) / 2) / tan(angleDeg * pi / 360);
    pair outward = rotate(-90) * unit(tip - base);
    return Midpoint(base, tip) + height * outward;
}

pair P = OuterApex(A, B, apexAngle);
pair R = OuterApex(B, C, apexAngle);
pair Q = OuterApex(C, D, apexAngle);
pair T = OuterApex(D, A, apexAngle);

// Centre of the direct similarity sending base -> image1 and tip -> image2,
// i.e. the fixed point of z*w + t with z the quotient of the two directions.
pair SpiralCenter(pair base, pair tip, pair image1, pair image2)
{
    pair z = (image2 - image1) / (tip - base);
    return (image1 - z * base) / ((1, 0) - z);
}

// S centres the rotation A -> B, C -> D; S' the rotation B -> C, D -> A.
pair S = SpiralCenter(A, C, B, D);
pair Sprime = SpiralCenter(B, D, C, A);

pair X = Midpoint(A, B);
pair M = Midpoint(B, C);
pair Y = Midpoint(C, D);
pair N = Midpoint(D, A);

//
// Draws PQ and RT (the pair every frame carries) and the black quadrilateral.
//
void BaseEdges()
{
    Draw(P, Q, Green);
    Draw(R, T, Red);
    Draw(A, B);
    Draw(B, C);
    Draw(C, D);
    Draw(D, A);
}

//
// Labels the quadrilateral's vertices and the four apexes, common to every frame.
//
void BaseDots()
{
    LabeledDot(A, "A", E);
    // B: compass N is shadowed by point N, so its align direction is spelled out.
    LabeledDot(B, "B", (0, 1));
    LabeledDot(C, "C", SW);
    // D: compass S is shadowed by point S, so its align direction is spelled out.
    LabeledDot(D, "D", (0, -1));
    LabeledDot(P, "P", NE);
    LabeledDot(R, "R", NW);
    LabeledDot(Q, "Q", SW);
    LabeledDot(T, "T", SE);
}
