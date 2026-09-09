import _common;

// Right triangle ABC with the right angle at A; its legs run along baseAngle and baseAngle + 90.
real legAB = 108;
real legAC = 84;

// BC lies horizontally below A: rotate the legs until C - B points along +x.
real baseAngle = -degrees(legAC * dir(90) - legAB * dir(0));

// AB'C' is the image of ABC under the direct similarity centred at A -- a rotation by
// spiralAngle composed with a scaling by spiralScale, applied to both B and C alike.
real spiralAngle = 145;
real spiralScale = 0.72;

pair A = (0, 0);
pair B = A + legAB * dir(baseAngle);
pair C = A + legAC * dir(baseAngle + 90);
pair Bp = A + spiralScale * (rotate(spiralAngle) * (B - A));
pair Cp = A + spiralScale * (rotate(spiralAngle) * (C - A));

// Unnamed in the solution: where line BB' meets line CC'. The conclusion is that
// the angle there is right.
pair X = extension(B, Bp, C, Cp);

RightAngleMark(B, A, C, Radius2, LightBlue);
RightAngleMark(Bp, A, Cp, Radius2, LightBlue);
RightAngleMark(C, X, Bp, Radius1, LightBlue);

Draw(B, Bp, Green);
Draw(C, Cp, Red);

Draw(A, B);
Draw(A, C);
Draw(B, C);
Draw(A, Bp);
Draw(A, Cp);
Draw(Bp, Cp);

LabeledDot(A, "A", NW);
LabeledDot(B, "B", SW);
LabeledDot(C, "C", SE);
LabeledDot(Bp, "B'", E);
LabeledDot(Cp, "C'", N);
