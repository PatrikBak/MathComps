import _common;

real ang1 = 35, ang2 = 140, len = 50;
pair I = (0, 0);
pair A = Polar(I, ang1 + 180, len);
pair B = Polar(I, ang1, len);
pair D = Polar(I, ang2, len);
pair C = Polar(I, ang2 + 180, len);

AngleMark(B, I, D, LightRed, radius=Radius2);
AngleMark(A, I, C, LightRed, radius=Radius2);

Draw(A, B);
Draw(D, C);
