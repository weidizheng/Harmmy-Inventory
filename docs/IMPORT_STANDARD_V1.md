# Import standard v1

The source workbook at `private-import/source/products.xlsx` is read-only. Inspection output is preview-only and is ignored by Git.

SKU values are trimmed and normalized to uppercase in the proposed database value; file and image paths use lowercase. The inspector reports blanks, duplicates, unknown image anchors, price discrepancies, and package data that cannot be proven. It does not guess an IP or a package hierarchy.

`middle box`, `middle tray`, `inner box`, and `display box` are normalized to `inner`. A parse is valid only when `units_per_inner × inners_per_carton` equals the source carton quantity. A bare `boxes/carton` value is `NEEDS_REVIEW` because box level is ambiguous.
