A KaTeX error inside a GFM table cell must surface — confirms cell rendering does not silently drop math errors.

| Operation | Formula       |
| --------- | ------------- |
| valid     | $a + b$       |
| broken    | $\unknowncmd$ |
