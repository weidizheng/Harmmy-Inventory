# Import standard v1

The source workbook at `private-import/source/products.xlsx` is read-only. Inspection output is preview-only and is ignored by Git.

SKU values are trimmed and normalized to uppercase in the proposed database value; file and image paths use lowercase. The inspector reports blanks, duplicates, unknown image anchors, price discrepancies, and package data that cannot be reconciled.

`middle box`, `middle tray`, `inner box`, and `display box` are normalized to `inner`. Supplier `design` counts are treated as the corresponding physical small-box count when validating carton packaging. A parse is valid when `units_per_inner × inners_per_carton` equals the source carton quantity; if only the inner count is stated, the matching outer count may be derived from that carton quantity. Bonus-pack wording remains `NEEDS_REVIEW`.

Before a production import, the primary Chinese product name must be transcribed from the matched product image into `product_name_zh`. The original workbook name is retained as `product_name_en`; no machine translation is used as a final catalog name.
