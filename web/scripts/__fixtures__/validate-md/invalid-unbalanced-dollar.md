A missing `$` — `$K$, $L$` mistyped as `$K, $L$` — leaves an odd number of delimiters. remark-math pairs them greedily and renders wrong-but-valid math with no KaTeX error, so only the delimiter-parity check catches it.

Let $K, $L$ be points on the circle.
