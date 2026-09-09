import _common;

real R = 74;
real angleA = 100;
real angleB = 205;
real angleC = 335;

// A1 sits on BC a fraction fracA1 of the way from B to C; B1 sits on CA a
// fraction fracB1 of the way from C to A; C1 sits on AB a fraction fracC1 of
// the way from A to B.
real fracA1 = 0.32;
real fracB1 = 0.25;
real fracC1 = 0.35;

pair O = (0, 0);
pair A = Polar(O, angleA, R);
pair B = Polar(O, angleB, R);
pair C = Polar(O, angleC, R);

pair A1 = (1 - fracA1) * B + fracA1 * C;
pair B1 = (1 - fracB1) * C + fracB1 * A;
pair C1 = (1 - fracC1) * A + fracC1 * B;

// Circle (AB1C1) meets omega again at A2. Both circles pass through A, so the
// line through their centres O, O2 is the perpendicular bisector of A and A2.
pair O2 = Circumcenter(A, B1, C1);
real r2 = abs(O2 - A);
pair A2 = ReflectAcross(A, O, O2);

// B3, C3: reflections of B1, C1 in the midpoints of CA, AB.
pair B3 = 2 * Midpoint(C, A) - B1;
pair C3 = 2 * Midpoint(A, B) - C1;

void BaseEdges()
{
    Circle(O, R, LightBlue);
    Draw(A, B);
    Draw(B, C);
    Draw(C, A);
}

void BaseDots()
{
    LabeledDot(A, "A", N);
    LabeledDot(B, "B", SW);
    LabeledDot(C, "C", SE);
}
