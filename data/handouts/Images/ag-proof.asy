import _common;

real xLeft = 15;
real xRight = 925;
unitsize(7.4cm / (xRight - xLeft));

real yTop = 235;
real yBot = 85;
real xMid = 470;
real xOuterL = 95;
real xOuterR = 800;
real xInnerL = 415;
real xBlueL = 280;
real xBlueR = 740;
real xBblueR = 550;

Draw((xLeft, yTop), (xRight, yTop));
Draw((xLeft, yBot), (xRight, yBot));

pair T_outerL = (xOuterL, yTop);
pair T_outerR = (xOuterR, yTop);
pair T_innerL = (xInnerL, yTop);
pair T_blueL = (xBlueL, yTop);
pair T_blueR = (xBlueR, yTop);
pair T_p = (xMid, yTop);

pair B_outerL = (xOuterL, yBot);
pair B_outerR = (xOuterR, yBot);
pair B_innerL = (xInnerL, yBot);
pair B_blueR = (xBblueR, yBot);
pair B_p = (xMid, yBot);

real yArrow = 275;
real shaftHalf = 3;
real headHalf = 10;
real headLen = 30;

real xRshaftStart = T_blueL.x;
real xRshaftEnd = xMid - headLen;
real xRapex = xMid;
path arrowR = (xRshaftStart, yArrow + shaftHalf)
              -- (xRshaftEnd, yArrow + shaftHalf)
              -- (xRshaftEnd, yArrow + headHalf)
              -- (xRapex, yArrow)
              -- (xRshaftEnd, yArrow - headHalf)
              -- (xRshaftEnd, yArrow - shaftHalf)
              -- (xRshaftStart, yArrow - shaftHalf)
              -- cycle;
fill(arrowR, Blue + opacity(0.698));

real xLapex = xMid;
real xLshaftStart = xMid + headLen;
real xLshaftEnd = T_blueR.x;
path arrowL = (xLapex, yArrow)
              -- (xLshaftStart, yArrow + headHalf)
              -- (xLshaftStart, yArrow + shaftHalf)
              -- (xLshaftEnd, yArrow + shaftHalf)
              -- (xLshaftEnd, yArrow - shaftHalf)
              -- (xLshaftStart, yArrow - shaftHalf)
              -- (xLshaftStart, yArrow - headHalf)
              -- cycle;
fill(arrowL, Blue + opacity(0.698));

real diamR = 10;
path diamondTop = T_p + (0, diamR) -- T_p + (-diamR, 0)
                  -- T_p + (0, -diamR) -- T_p + (diamR, 0) -- cycle;
path diamondBot = B_p + (0, diamR) -- B_p + (-diamR, 0)
                  -- B_p + (0, -diamR) -- B_p + (diamR, 0) -- cycle;
fill(diamondTop, Red);
draw(diamondTop, Red + linewidth(1.104));
fill(diamondBot, Red);
draw(diamondBot, Red + linewidth(1.104));

real dotR = 7;
for (pair P : new pair[] {T_outerL, T_innerL, T_outerR,
                          B_outerL, B_innerL, B_outerR}) {
    fill(circle(P, dotR), black);
    draw(circle(P, dotR), black + linewidth(0.736));
}
VertexDots(new pair[] {T_blueL, T_blueR, B_blueR}, dotR);

label("$p$", T_p + (0, -20), S, black);
label("$p$", B_p + (0, -20), S, black);
