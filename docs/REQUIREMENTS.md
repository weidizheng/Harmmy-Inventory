# Finalized requirements

This system maintains a complete product catalog separately from physical warehouse balances. Products may be `NOT_ENABLED`, `OUT_OF_STOCK`, `IN_STOCK`, `INACTIVE`, or `ARCHIVED`; the first three inventory states are calculated, not stored as an IP category.

The current phase is entirely local. Do not connect to or modify a production Supabase project, upload assets, import production data, deploy a site, create a remote repository, or create real staff credentials.

The catalog must support at least 1,000 SKUs. IP, product type, catalog status, and inventory status are independent dimensions. Default catalog ordering is pinned first, then descending stored weight, then products with stock, then product name.
