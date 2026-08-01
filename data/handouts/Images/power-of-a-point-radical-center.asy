import _common;

// Every circle is given the SAME power `commonPower` with respect to the origin,
// which is exactly what makes the origin the radical centre: |O_i|^2 - r_i^2 is
// then equal for all three, so r_i = sqrt(spread_i^2 - commonPower).
//
// The power has to stay well away from zero. At power 0 all three circles pass
// through the radical centre, and the figure reads as "three circles with a
// common point" -- the concurrency then looks like a property of the circles
// rather than of their chordály.
real commonPower = -900;

real spread1 = 34;
real spread2 = 31;
real spread3 = 20;
real angle1 = 187;
real angle2 = 320;
real angle3 = 92;
real axisOverhang = 12;

pair radicalCenter = (0, 0);
pair O1 = Polar(radicalCenter, angle1, spread1);
pair O2 = Polar(radicalCenter, angle2, spread2);
pair O3 = Polar(radicalCenter, angle3, spread3);

real r1 = sqrt(spread1 * spread1 - commonPower);
real r2 = sqrt(spread2 * spread2 - commonPower);
real r3 = sqrt(spread3 * spread3 - commonPower);

pair[] axis12 = RadicalAxis(O1, r1, O2, r2);
pair[] axis13 = RadicalAxis(O1, r1, O3, r3);
pair[] axis23 = RadicalAxis(O2, r2, O3, r3);

pair[] chord12 = LineCircleIntersections(axis12[0], axis12[1], O1, r1);
pair[] chord13 = LineCircleIntersections(axis13[0], axis13[1], O1, r1);
pair[] chord23 = LineCircleIntersections(axis23[0], axis23[1], O2, r2);

Circle(O1, r1, LightBlue);
Circle(O2, r2, LightBlue);
Circle(O3, r3, LightBlue);

Draw(ExtendPast(chord12[1], chord12[0], axisOverhang), ExtendPast(chord12[0], chord12[1], axisOverhang), Red);
Draw(ExtendPast(chord13[1], chord13[0], axisOverhang), ExtendPast(chord13[0], chord13[1], axisOverhang), Red);
Draw(ExtendPast(chord23[1], chord23[0], axisOverhang), ExtendPast(chord23[0], chord23[1], axisOverhang), Red);

VertexDot(radicalCenter);
