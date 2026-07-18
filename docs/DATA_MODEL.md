# Data model

Core tables: `brands`, `ips`, `products`, `product_images`, `warehouses`, `inventory_balances`, `staff`, `staff_sessions`, `stock_operations`, `stock_operation_items`, `import_batches`, `import_batch_items`, and `product_audit_logs`.

`products` is the catalog. `inventory_balances` exists only after a formal receipt creates it and is unique on `(warehouse_id, product_id)`. `stock_operations` is one multi-SKU document; `stock_operation_items` stores every requested unit, delta, and before/after snapshot. Package ratios are saved per product and `units_per_carton` is generated from the other two ratios.

Staff login is deliberately modelled but not implemented in the browser during this phase. Password hashes and session token hashes are server-only data; production login must use a rate-limited server-side function.
