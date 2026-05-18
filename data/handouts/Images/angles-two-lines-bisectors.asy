import _common;

real lineHalfLength = 90;
real bisectorHalfLength = 75;
real pointDistance = 50;
real crossAngle = 30;
real markRadius = 12;
real smallDot = 1.2;

pair A = (0, 0);

pair L1a = lineHalfLength * dir(crossAngle);
pair L1b = lineHalfLength * dir(180 + crossAngle);
pair L2a = lineHalfLength * dir(180 - crossAngle);
pair L2b = lineHalfLength * dir(-crossAngle);

pair B1a = bisectorHalfLength * dir(90);
pair B1b = bisectorHalfLength * dir(270);
pair B2a = bisectorHalfLength * dir(0);
pair B2b = bisectorHalfLength * dir(180);

pair P1 = pointDistance * dir(90);
pair P2 = pointDistance * dir(270);
pair P3 = pointDistance * dir(0);
pair P4 = pointDistance * dir(180);

pair F1a = Foot(P1, A, L1a);
pair F1b = Foot(P1, A, L2a);
pair F2a = Foot(P2, A, L1a);
pair F2b = Foot(P2, A, L2a);
pair F3a = Foot(P3, A, L1a);
pair F3b = Foot(P3, A, L2a);
pair F4a = Foot(P4, A, L1a);
pair F4b = Foot(P4, A, L2a);

RightAngleMark(A, F1a, P1, radius = markRadius);
RightAngleMark(A, F1b, P1, radius = markRadius);
RightAngleMark(A, F2a, P2, radius = markRadius);
RightAngleMark(A, F2b, P2, radius = markRadius);
RightAngleMark(A, F3a, P3, radius = markRadius);
RightAngleMark(A, F3b, P3, radius = markRadius);
RightAngleMark(A, F4a, P4, radius = markRadius);
RightAngleMark(A, F4b, P4, radius = markRadius);

Draw(P1, F1a, LightGreen);
Draw(P1, F1b, LightGreen);
Draw(P2, F2a, LightGreen);
Draw(P2, F2b, LightGreen);
Draw(P3, F3a, LightPink);
Draw(P3, F3b, LightPink);
Draw(P4, F4a, LightPink);
Draw(P4, F4b, LightPink);

Draw(L1a, L1b);
Draw(L2a, L2b);
Draw(B1a, B1b, black + dashedPen);
Draw(B2a, B2b, black + dashedPen);

VertexDot(A);
VertexDot(P1, radius = smallDot);
VertexDot(P2, radius = smallDot);
VertexDot(P3, radius = smallDot);
VertexDot(P4, radius = smallDot);
