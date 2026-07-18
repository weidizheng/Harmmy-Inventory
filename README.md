# Harmmy Inventory

Local-first inventory-management foundation for Harmmy. This phase includes a Next.js prototype, PostgreSQL/Supabase migrations, workbook inspection, and tested package-level inventory rules. It does **not** connect to Supabase, upload images, import products, deploy, or create a remote Git repository.

## Local start

1. Install Node.js 20+ and Python 3.11+ (with Pillow).
2. Run `pnpm install`.
3. Run `pnpm inspect:products` to create local preview reports.
4. Run `pnpm test` and `pnpm lint`.
5. Run `pnpm dev`, then open `http://localhost:3000`.

See [docs/LOCAL_SETUP.md](docs/LOCAL_SETUP.md) for the full local workflow.
