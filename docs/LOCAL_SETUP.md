# 本地开发

## 环境要求

- Node.js 20+
- pnpm 10+
- Python 3.11+ 与 Pillow（只在重新检查 Excel/提取图片时需要）
- 已有 Supabase 项目的 Project URL 和 Publishable Key

## 安装

```powershell
pnpm install
Copy-Item .env.example .env.local
```

填写 `.env.local`：

```text
NEXT_PUBLIC_SUPABASE_URL=https://你的项目.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=你的_publishable_key
```

如需运行受控 Best Seller 导入，另外填写专用启用员工的邮箱和密码。不要使用或暴露 Service Role Key。

## 启动和检查

```powershell
pnpm dev
```

打开 <http://localhost:3000/login>。

提交前运行：

```powershell
pnpm lint
pnpm test
pnpm build
```

## Excel 检查与导入

原文件和所有中间结果必须保存在 Git 忽略的 `private-import/`。项目根目录中的 `副本-EAKI Products 2026.xlsx` 也已明确忽略。

```powershell
pnpm inspect:products
pnpm import:best-sellers -- --preflight
pnpm import:best-sellers
```

只有审核状态为 PASS、中文名和图片齐全且总数严格为 38 的 Best Seller 文件才能通过导入脚本。

## Supabase CLI

项目已包含 `supabase/config.toml` 和迁移。新电脑需先登录并链接对应项目，再执行迁移命令。不要把 Access Token 写入脚本或 Git。

```powershell
pnpm supabase login
pnpm supabase link --project-ref <PROJECT_REF>
pnpm supabase migration list
```
