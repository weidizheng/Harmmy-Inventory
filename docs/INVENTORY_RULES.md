# Inventory rules

Inventory records store the physical state only: `carton_qty`, `inner_qty`, and `unit_qty`. All quantities are non-negative. `unit` is the smallest box, `inner` is a middle/display/inner box or tray, and `carton` is a full carton.

Outbound requests affect only the exact requested level. A carton request deducts only cartons; an inner request deducts only inners; a unit request deducts only units. The system never auto-splits a carton, auto-splits an inner, or normalizes loose stock.

Splitting is a separate confirmed action:

- Split cartons: `carton -= N`, `inner += N × inners_per_carton`.
- Split inners: `inner -= N`, `unit += N × units_per_inner`.

One operation may contain many SKUs, but it is atomic: if any item cannot be fulfilled, none of the items change. A confirmed operation records before/after snapshots. Incorrect records are reversed, corrected, or adjusted with new records; confirmed records are never physically deleted.
