import _common;

real ang1 = 30, ang2 = 135, len = 55;
pair X = (0, 0);
pair L1a = Polar(X, ang1 + 180, len);
pair L1b = Polar(X, ang1, len);
pair L2a = Polar(X, ang2 + 180, len);
pair L2b = Polar(X, ang2, len);

AngleMark(L1b, X, L2b, LightRed, "\alpha");
AngleMark(L2b, X, L1a, LightBlue, "\beta");
AngleMark(L1a, X, L2a, LightRed, "\gamma");
AngleMark(L2a, X, L1b, LightBlue, "\delta");

Draw(L1a, L1b);
Draw(L2a, L2b);
