import _common;

real S = 1.8;
pair A1 = S * (0, 0);
pair A2 = S * (-1, 22);
pair A3 = S * (18, 39);
pair A4 = S * (48, 40);
pair A5 = S * (55, 20);
pair A6 = S * (45, 0);

AngleMark(A3, A1, A2, LightBlue, radius=Radius2);
AngleMark(A1, A2, A3, LightBlue, radius=Radius2);
AngleMark(A2, A3, A1, LightBlue, radius=Radius2);

AngleMark(A4, A1, A3, LightRed, radius=Radius2);
AngleMark(A1, A3, A4, LightRed, radius=Radius2);
AngleMark(A3, A4, A1, LightRed, radius=Radius2);

AngleMark(A5, A1, A4, LightGreen, radius=Radius2);
AngleMark(A1, A4, A5, LightGreen, radius=Radius2);
AngleMark(A4, A5, A1, LightGreen, radius=Radius2);

AngleMark(A6, A1, A5, LightPurple, radius=Radius2);
AngleMark(A1, A5, A6, LightPurple, radius=Radius2);
AngleMark(A5, A6, A1, LightPurple, radius=Radius2);

Draw(A1, A2, Blue);
Draw(A2, A3, Blue);
Draw(A3, A4, Red);
Draw(A4, A5, Green);
Draw(A5, A6, Purple);
Draw(A6, A1, Purple);

Draw(A1, A3);
Draw(A1, A4);
Draw(A1, A5);

LabeledDot(A1, "A_1", SW);
LabeledDot(A2, "A_2", W);
LabeledDot(A3, "A_3", N);
LabeledDot(A4, "A_4", NE);
LabeledDot(A5, "A_5", E);
LabeledDot(A6, "A_6", SE);
