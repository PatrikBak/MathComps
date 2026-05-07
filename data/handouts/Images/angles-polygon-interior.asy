import _common;

pen LightOrange = rgb(1, 0.75, 0.5);
pen Orange = rgb(1, 0.5, 0);

real scale = 1.8;
pair A1 = scale * (0, 0);
pair A2 = scale * (-1, 22);
pair A3 = scale * (18, 39);
pair A4 = scale * (48, 40);
pair A5 = scale * (55, 20);
pair A6 = scale * (45, 0);

pair O = (A1 + A2 + A3 + A4 + A5 + A6) / 6;

AngleMark(A2, O, A1, LightBlue, radius=Radius2);
AngleMark(O, A1, A2, LightBlue, radius=Radius2);
AngleMark(A1, A2, O, LightBlue, radius=Radius2);

AngleMark(A3, O, A2, LightRed, radius=Radius2);
AngleMark(O, A2, A3, LightRed, radius=Radius2);
AngleMark(A2, A3, O, LightRed, radius=Radius2);

AngleMark(A4, O, A3, LightGreen, radius=Radius2);
AngleMark(O, A3, A4, LightGreen, radius=Radius2);
AngleMark(A3, A4, O, LightGreen, radius=Radius2);

AngleMark(A5, O, A4, LightPurple, radius=Radius2);
AngleMark(O, A4, A5, LightPurple, radius=Radius2);
AngleMark(A4, A5, O, LightPurple, radius=Radius2);

AngleMark(A6, O, A5, LightPink, radius=Radius2);
AngleMark(O, A5, A6, LightPink, radius=Radius2);
AngleMark(A5, A6, O, LightPink, radius=Radius2);

AngleMark(A1, O, A6, LightOrange, radius=Radius2);
AngleMark(O, A6, A1, LightOrange, radius=Radius2);
AngleMark(A6, A1, O, LightOrange, radius=Radius2);

Draw(A1, A2, Blue);
Draw(A2, A3, Red);
Draw(A3, A4, Green);
Draw(A4, A5, Purple);
Draw(A5, A6, Pink);
Draw(A6, A1, Orange);

Draw(O, A1);
Draw(O, A2);
Draw(O, A3);
Draw(O, A4);
Draw(O, A5);
Draw(O, A6);

LabeledDot(A1, "A_1", SW);
LabeledDot(A2, "A_2", W);
LabeledDot(A3, "A_3", N);
LabeledDot(A4, "A_4", NE);
LabeledDot(A5, "A_5", E);
LabeledDot(A6, "A_6", SE);
LabeledDot(O, "O", S, offset=(-1,2.5));
