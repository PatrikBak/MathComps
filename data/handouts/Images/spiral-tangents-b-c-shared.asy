import _common;

real R = 46;               // radius of omega
real angleA = 15;          // position of A on omega, degrees from +x axis
real angleB = 224;         // position of B on omega
real angleC = 316;         // position of C on omega

// B and C sit symmetrically about the bottom of omega, so BC is horizontal and
// T lands straight below it. A cannot go much higher than this: S is where the
// perpendicular to AT at A meets line BC, and the closer A gets to the top of
// omega, the further along ray BC that meeting point runs off.
pair O = (0, 0);
pair A = Polar(O, angleA, R);
pair B = Polar(O, angleB, R);
pair C = Polar(O, angleC, R);

// T is where the tangents to omega at B and C meet; each tangent is
// perpendicular to its own radius, which pins down both tangent lines.
pair T = extension(B, B + rotate(90) * (B - O), C, C + rotate(90) * (C - O));

// S is where the perpendicular to AT at A crosses line BC.
pair S = extension(B, C, A, A + rotate(90) * (T - A));

// Equal tangent lengths give |TB| = |TC|, so this radius is both T's tangent
// length and the radius of gamma.
real r = abs(T - B);

// B1, C1 are the two points where gamma meets ray ST: the near one (distance
// |ST| - r from S) is C1, the far one (|ST| + r) is B1, matching the
// solution's order S, C1, T, B1 along that ray.
real dTS = abs(T - S);
pair dirST = unit(T - S);
pair C1 = S + (dTS - r) * dirST;
pair B1 = S + (dTS + r) * dirST;

//
// Marks the right angle at A between AT and AS. In the identification frame
// A, S and the new point X there turn out collinear, so this same corner
// also reads as TA perpendicular to line SX.
//
void BaseFills()
{
    RightAngleMark(T, A, S, Radius1, LightPurple);
}

//
// Draws omega and the dashed AT segment, common to every frame.
//
void BaseEdges()
{
    Circle(O, R, LightBlue);
    DashedDraw(A, T, Purple);
}

//
// Labels the points whose compass direction doesn't change between frames.
// C takes a different direction per frame and is labeled locally instead.
//
void BaseDots()
{
    // Point S shadows the compass constant, so south must be spelled out as a vector.
    LabeledDot(A, "A", NE);
    LabeledDot(B, "B", W);
    LabeledDot(T, "T", (-0.5, -0.85));
    LabeledDot(S, "S", E);
    LabeledDot(B1, "B_1", SW);
    LabeledDot(C1, "C_1", SE);
}
