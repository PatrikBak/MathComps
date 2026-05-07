import _common;

real base = 85, theta = 70, rayLen = 50;
pair Lleft = (0, 0);
pair Lright = (base, 0);
pair V = Midpoint(Lleft, Lright);
pair Rtop = Polar(V, theta, rayLen);

AngleMark(Lright, V, Rtop, LightRed);
AngleMark(Rtop, V, Lleft, LightBlue);

Draw(Lleft, Lright);
Draw(Rtop, V);
