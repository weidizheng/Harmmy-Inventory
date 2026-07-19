# Harmmy Inventory

[![CI](https://github.com/weidizheng/Harmmy-Inventory/actions/workflows/ci.yml/badge.svg)](https://github.com/weidizheng/Harmmy-Inventory/actions/workflows/ci.yml)

Harmmy 的手机友好型仓库库存系统。系统以中文商品名为主、英文名为辅，支持按 SKU、中文名、英文名和 IP 搜索；员工可按“箱 / 端（中盒）/ 盒”调整库存，所有数据变更都会留下操作日志。

- 线上地址：<https://harmmy-inventory.vercel.app>
- GitHub：<https://github.com/weidizheng/Harmmy-Inventory>
- 当前仓库：`Montery Park`（按业务现有拼写保留）
- 当前目录：38 个 Best Seller 商品及其私有图片
- 当前账号：Henry、Terrence、Harmmy（密码由 Supabase Auth 管理，不存放在本仓库）

## 已实现功能

- Supabase 员工密码登录、启用状态检查和统一权限
- 商品卡片、私有签名图片及中英文/IP/SKU 搜索
- 按箱、端、盒批量增加或扣减库存，提交前统一汇总核对
- 原子库存事务：任一商品会变成负数时，整次操作全部拒绝
- 手机端新增商品、压缩图片并上传至私有 Storage
- 操作日志：人员、时间、商品、库存差异与分页筛选
- 当前登录人、登录时长、本次会话操作数及退出登录
- Excel Best Seller 清洗、图片提取和受控导入脚本

## 技术栈

- Next.js 15 App Router、React 19、TypeScript
- Supabase Auth、PostgreSQL、Row Level Security、Storage
- Vercel Production
- Vitest（当前 28 项自动测试）

## 本地启动

需要 Node.js 20+ 和 pnpm 10+。

```powershell
git clone <你的 GitHub 仓库地址>
cd Harmmy_Inventory
pnpm install
Copy-Item .env.example .env.local
pnpm dev
```

在 `.env.local` 填入 Supabase Project URL 和 Publishable Key，然后打开 <http://localhost:3000/login>。完整步骤见 [本地开发](docs/LOCAL_SETUP.md)。

## 开发检查

```powershell
pnpm lint
pnpm test
pnpm build
```

每次准备上传或部署前都应执行以上三项。GitHub Actions 也会在每次 push 和 pull request 时自动执行。

## 文档

- [系统架构](docs/ARCHITECTURE.md)
- [数据库结构](docs/DATA_MODEL.md)
- [库存计算与操作规则](docs/INVENTORY_RULES.md)
- [部署与日常维护](docs/MAINTENANCE.md)
- [首次同步和日常上传 GitHub](docs/GITHUB_SYNC.md)
- [员工账号维护](docs/STAFF_ONBOARDING.md)
- [Excel 导入规范](docs/IMPORT_STANDARD_V1.md)
- [当前范围与后续计划](docs/REQUIREMENTS.md)
- [主要技术决策](docs/DECISIONS.md)

## 安全要求

- 仓库应设为 **Private**。
- 永远不要提交 `.env.local`、Supabase Secret/Service Role Key、员工密码、原始 Excel、导出数据或 `private-import/`。
- 浏览器只允许使用 `NEXT_PUBLIC_SUPABASE_URL` 和 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`。
- 数据库结构只通过 `supabase/migrations/` 中按时间排序的迁移更新，不直接修改旧迁移。

本仓库不包含真实密码、密钥、原始 Excel 和导入中间文件。
