# Decisions

- Next.js App Router and strict TypeScript are used for the local UI prototype.
- PostgreSQL/Supabase DDL is stored only as timestamped migrations.
- Inventory is stored by physical package level, never by a normalized total.
- The source workbook and extracted artifacts remain in `private-import/`, which Git ignores.
- Import classification is conservative: unknown IP or package interpretation is `NEEDS_REVIEW`.
- RLS is enabled in the migration. Browser access policies and secure login functions remain deferred until staff authentication is implemented.
- Product images are stored in the private `product-images` bucket. No browser storage policy is granted before staff authentication exists.
