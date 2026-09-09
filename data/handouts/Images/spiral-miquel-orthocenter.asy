include "spiral-miquel-shared.asy";

// Feet of the altitudes of PQR. The angle at P is obtuse, so the feet from
// Q and R fall on the extensions of PR and PQ past P, and the orthocentre O
// sits beyond P: the altitude from P is drawn from O through P to its foot,
// the other two from their vertex through the foot on to O.
pair footP = Foot(P, Q, R);
pair footQ = Foot(Q, P, R);
pair footR = Foot(R, P, Q);

BaseFills();
RightAngleMark(P, footP, Q, Radius1, LightBlue);
RightAngleMark(Q, footQ, P, Radius1, LightBlue);
RightAngleMark(R, footR, P, Radius1, LightBlue);

BaseEdges();
DashedDraw(O, footP);
DashedDraw(Q, O);
DashedDraw(R, O);
Draw(A, C);
Draw(B, D);
Draw(Q, R);
Draw(R, footQ);
Draw(Q, footR);

BaseDots();
LabeledDot(C, "C", (0.74, 0.67), 2);
LabeledDot(P, "P", E, 3, (0,-1), halo = true, haloPad=0.8);
LabeledDot(O, "O", SW, 0, halo = true);
