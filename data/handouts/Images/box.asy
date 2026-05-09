settings.prc = false;
settings.render = 0;
import three;
import _common;

real a = 12;
real x = 2;
real h = a/2;
real b = h - x;

unitsize(5.5cm / a);
currentprojection = orthographic(camera=(4, -6, 5), up=Z);
currentlight = nolight;

triple B00 = (-b, -b, 0), B10 = ( b, -b, 0),
       B11 = ( b,  b, 0), B01 = (-b,  b, 0);
triple T00 = (-b, -b, x), T10 = ( b, -b, x),
       T11 = ( b,  b, x), T01 = (-b,  b, x);

pen paperFill     = gray(0.745) + opacity(0.30);
pen wallFrontFill = rgb(0.647, 0.165, 0.165) + opacity(0.85);
pen wallBackFill  = rgb(0.647, 0.165, 0.165) + opacity(0.30);
pen topFill       = rgb(0.647, 0.165, 0.165) + opacity(0.50);
pen edgePen       = black + linewidth(ThinWidth);

path3 paper = (-b, -h, 0) -- ( b, -h, 0)
           -- ( b, -b, 0) -- ( h, -b, 0)
           -- ( h,  b, 0) -- ( b,  b, 0)
           -- ( b,  h, 0) -- (-b,  h, 0)
           -- (-b,  b, 0) -- (-h,  b, 0)
           -- (-h, -b, 0) -- (-b, -b, 0) -- cycle;

path3 boxBottom = B00 -- B10 -- B11 -- B01 -- cycle;
path3 boxTop    = T00 -- T10 -- T11 -- T01 -- cycle;
path3 wallFront = B00 -- B10 -- T10 -- T00 -- cycle;
path3 wallRight = B10 -- B11 -- T11 -- T10 -- cycle;
path3 wallBack  = B11 -- B01 -- T01 -- T11 -- cycle;
path3 wallLeft  = B01 -- B00 -- T00 -- T01 -- cycle;

// Back-to-front order so opacity layering reads correctly.
draw(surface(paper),     paperFill);      draw(paper,     edgePen);
draw(surface(wallBack),  wallBackFill);   draw(wallBack,  edgePen);
draw(surface(wallLeft),  wallBackFill);   draw(wallLeft,  edgePen);
draw(surface(boxBottom), paperFill);      draw(boxBottom, edgePen);
draw(surface(wallFront), wallFrontFill);  draw(wallFront, edgePen);
draw(surface(wallRight), wallFrontFill);  draw(wallRight, edgePen);
draw(surface(boxTop),    topFill);        draw(boxTop,    edgePen);
