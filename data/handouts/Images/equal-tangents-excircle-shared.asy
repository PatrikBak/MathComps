import _common;

real apexX = 10;
real apexY = 75;
real leftX = -30;
real rightX = 70;
real baseY = -20;

pair A = (apexX, apexY);
pair B = (leftX, baseY);
pair C = (rightX, baseY);

real extensionLength = 55;
pair Y = ExtendPast(A, B, extensionLength);
pair X = ExtendPast(A, C, extensionLength);

pair dirA = unit(B - A) + unit(C - A);
pair dirBext = unit(B - A) + unit(C - B);

pair Ia = extension(A, A + dirA, B, B + dirBext);
real ra = abs(Ia - Foot(Ia, B, C));

pair D = Foot(Ia, B, C);
pair E = Foot(Ia, A, X);
pair F = Foot(Ia, A, Y);

void BaseEdges() {
    Arc(Ia, F, D, E, bufferDeg = 25, LightBlue);
    Draw(A, B);
    Draw(B, C);
    Draw(C, A);
    Draw(F, Y, vertexPen);
    Draw(E, X, vertexPen);
}

void BaseDots() {
    LabeledDot(A, "A", N);
    LabeledDot(B, "B", NW);
    LabeledDot(C, "C", NE);
    LabeledDot(D, "D", N);
    // Compass `E` is shadowed by the local pair `E` (tangent point), so pass
    // the east unit vector explicitly.
    LabeledDot(E, "E", (1, 0));
    LabeledDot(F, "F", SW);
    LabeledDot(Ia, "I_a", W);
}
