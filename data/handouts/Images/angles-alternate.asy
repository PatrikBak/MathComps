import _common;

real sep = 50, theta = 45;
real upperLeftPad = 70, lowerRightPad = 80;
pair L = (0, 0);
pair U = (sep / tan(radians(theta)), sep);
pair Lleft = U + (-upperLeftPad, 0);
pair Rright = L + (lowerRightPad, 0);

AngleMark(Lleft, U, L, LightRed);
AngleMark(Rright, L, U, LightRed);

Draw(Lleft, U);
Draw(L, Rright);
Draw(L, U);

ParallelMark(Lleft, U);
ParallelMark(L, Rright);
