import _common;

real sep = 40, theta = 40;
real upperLeftPad = 32, upperRightPad = 50, lowerRightPad = 75;
pair Plower = (0, 0);
pair Pupper = (sep / tan(radians(theta)), sep);
pair Tup = Polar(Pupper, theta, 32);
pair Hupper_left = Pupper + (-upperLeftPad, 0);
pair Hupper_right = Pupper + (upperRightPad, 0);
pair Hlower_left = Plower;
pair Hlower_right = Plower + (lowerRightPad, 0);

AngleMark(Hupper_right, Pupper, Tup, LightRed, "\alpha");
AngleMark(Hlower_right, Plower, Tup, LightRed, "\gamma");
AngleMark(Hupper_left, Pupper, Plower, LightRed, "\beta");

Draw(Hupper_left, Hupper_right);
Draw(Hlower_left, Hlower_right);
Draw(Plower, Tup);

ParallelMark(Hupper_left, Hupper_right, placement = 0.7);
ParallelMark(Hlower_left, Hlower_right);
