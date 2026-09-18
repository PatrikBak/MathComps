import _common;

real lenAB = 63;
real lenAD = 87;
real angleBAD = 105;
real angleABC = 70;
real tM = 1.3;

// The triangle ABD is laid out with AB horizontal and then turned so that BD
// lies horizontal, D left of B, with A hanging below it and C above; every
// other point is derived from these three, so the turn carries the whole
// configuration.
pair A = (0, 0);
pair B = A + lenAB * dir(0);
pair D = A + lenAD * dir(angleBAD);
transform upright = rotate(180 - degrees(D - B));
B = upright * B;
D = upright * D;

// Rotating ray BA by -angleABC and ray DA by +angleABC (opposite signs) and
// meeting the results is what forces |<ABC| = |<ADC| = angleABC while keeping
// ABCD convex; matching signs instead sends C off past segment BD.
pair rayFromB = rotate(-angleABC) * (A - B);
pair rayFromD = rotate(angleABC) * (A - D);
pair C = extension(B, B + rayFromB, D, D + rayFromD);

// The bisector of |<BCD| swaps ray CB with ray CD, so reflecting M across it
// and re-meeting line AD gives exactly the N the statement wants: |<MCD| =
// |<NCB| and |<MCB| = |<NCD| both fall out of that swap for free.
pair bisectorPoint = C + unit(B - C) + unit(D - C);
pair M = A + tM * (B - A);
pair N = extension(C, ReflectAcross(M, C, bisectorPoint), A, D);

pair X = Foot(C, A, B);
pair Y = Foot(C, A, D);

pair Oamn = Circumcenter(A, M, N);
real Ramn = abs(A - Oamn);
pair Oabd = Circumcenter(A, B, D);
real Rabd = abs(A - Oabd);

// The radical axis of (AMN) and (ABD) is the line through both of their
// intersection points, so meeting it with (ABD) recovers {A, K}; K is
// whichever of the two isn't A.
pair[] radAxis = RadicalAxis(Oamn, Ramn, Oabd, Rabd);
pair[] circleHits = LineCircleIntersections(radAxis[0], radAxis[1], Oabd, Rabd);
pair K = OtherIntersection(circleHits, A);

real labelGap = 3;
pen ptPen = Blue;

//
// Draws the four sides of the quadrilateral ABCD.
//
void BaseEdges()
{
    Draw(A, B);
    Draw(B, C);
    Draw(C, D);
    Draw(D, A);
}

//
// Labels A, C and K. B and D are labelled by each figure separately.
//
void BaseDots()
{
    LabeledDot(A, "A", S, 1, color = ptPen);
    // Point N shadows the compass constant, so north is spelled out.
    LabeledDot(C, "C", (0, 1), 1, color = ptPen, offset = (0, 1.2));
    LabeledDot(K, "K", S, 1, color = ptPen);
}
