import _common;

// The segment AB that every figure of the definition series transforms, placed
// relative to the centre O. A sits below the horizontal through O and B above
// it, so the images under the series' transformations land on distinct sides.
real distOA = 66;
real distOB = 90;
real angleOA = -25;
real angleOB = 20;

pair O = (0, 0);
pair A = Polar(O, angleOA, distOA);
pair B = Polar(O, angleOB, distOB);

//
// Returns the image of P under the spiral similarity centred at O with the
// oriented rotation angle `phi` (degrees, counter-clockwise) and coefficient
// `k`. The homothety with coefficient -k is `phi = 180` with a positive `k`.
//
// Used global variables: O
//
pair SpiralImage(
    pair P,
    real phi,
    real k)
{
    return O + k * (rotate(phi) * (P - O));
}
