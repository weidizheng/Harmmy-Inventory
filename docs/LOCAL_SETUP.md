# Local setup

Use Node.js 20+ and Python 3.11+ with Pillow. Keep the source workbook at `private-import/source/products.xlsx`; never overwrite it.

```powershell
pnpm install
pnpm inspect:products
pnpm test
pnpm lint
pnpm dev
```

Open `http://localhost:3000`. The UI uses mock data only. The inspector writes preview CSV/JSON/HTML files under `private-import/output` and `private-import/reports`, both ignored by Git.
