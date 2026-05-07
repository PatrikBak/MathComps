import _common;

real sep = 30, theta = 40;
real lowerRightPad = 100, upperRightPad = 70;
pair L = (0, 0);
pair U = (sep / tan(radians(theta)), sep);
pair Ttop = Polar(U, theta, 50);
pair Lright = (lowerRightPad, 0);
pair Uright = U + (upperRightPad, 0);

AngleMark(Lright, L, U, LightRed);
AngleMark(Uright, U, Ttop, LightRed);

Draw(L, Lright);
Draw(U, Uright);
Draw(L, Ttop);

ParallelMark(U, Uright);
ParallelMark(L, Lright);
