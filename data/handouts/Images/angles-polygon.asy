import _common;

real S = 1.8;
pair A1 = S * (0, 0);
pair A2 = S * (-1, 22);
pair A3 = S * (18, 39);
pair A4 = S * (48, 40);
pair A5 = S * (55, 20);
pair A6 = S * (45, 0);


AngleMark(A5, A1, A2, LightPink, radius=Radius2);
AngleMark(A1, A2, A3, LightPink, radius=Radius2);
AngleMark(A2, A3, A4, LightPink, radius=Radius2);
AngleMark(A3, A4, A5, LightPink, radius=Radius2);
AngleMark(A4, A5, A1, LightPink, radius=Radius2);

AngleMark(A6, A1, A5, LightBlue, radius=Radius2);
AngleMark(A1, A5, A6, LightBlue, radius=Radius2);
AngleMark(A5, A6, A1, LightBlue, radius=Radius2);

Draw(A1, A6, Blue);
Draw(A6, A5, Blue);
Draw(A1, A2, Purple);
Draw(A2, A3, Purple);
Draw(A3, A4, Purple);
Draw(A4, A5, Purple);
Draw(A1, A5);

LabeledDot(A1, "A_1", SW);
LabeledDot(A2, "A_2", W);
LabeledDot(A3, "A_3", N);
LabeledDot(A4, "A_4", NE);
LabeledDot(A5, "A_5", E);
LabeledDot(A6, "A_6", SE);
