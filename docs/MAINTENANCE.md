# 部署与日常维护

## 每次修改代码

```powershell
git status
pnpm lint
pnpm test
pnpm build
git add <本次修改的文件>
git commit -m "简短说明本次修改"
git push
```

只添加本次相关文件，不使用会误收敏感文件的通配命令。GitHub Actions 通过后，再检查 Vercel Preview 或 Production。

## Vercel 部署

生产地址固定为 <https://harmmy-inventory.vercel.app>。

推荐将现有 Vercel 项目连接到 GitHub：Vercel Dashboard → `harmmy-inventory` → Settings → Git → Connect Git Repository。将 Production Branch 设为 `main`。连接后：

- push 到 `main`：自动生产部署；
- push 到其他分支或 Pull Request：自动生成预览部署；
- 不要重新创建第二个 Vercel 项目。

Vercel 项目必须保留以下 Production/Preview 环境变量：

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

修改 Vercel 环境变量后必须 Redeploy，新值才会进入新部署。

## 数据库结构变更

1. 不编辑已经推送过的迁移。
2. 在 `supabase/migrations/` 新建更晚时间戳的 SQL 文件。
3. 先阅读 SQL，确认没有误删表、批量清空数据或放宽 RLS。
4. 执行本地检查并提交 Git。
5. 使用已链接的 Supabase CLI：

```powershell
pnpm supabase migration list
pnpm supabase db push
```

6. 在 Supabase Table Editor、日志页和网页完成一次小范围验证。

数据库迁移可能不可逆。涉及删除字段、修改箱规或批量库存时，应先导出备份并安排维护窗口。

## 员工维护

新增账号、停用账号和登录页姓名映射见 [STAFF_ONBOARDING.md](STAFF_ONBOARDING.md)。不要共享密码，不要在聊天、README、Git commit 或截图中暴露密码和 Access Token。

## 商品与图片维护

- 新商品优先从网页“新产品”录入，图片自动进入私有 `product-images` bucket。
- SKU 必须唯一并保持大写。
- 中文名是主名称，英文名是辅助名称。
- 修改箱规前先核对 `中盒件数 × 每箱中盒 = 原表 Quantity/Carton`；箱规会影响折合库存和排序。
- 不直接删除已经参与库存操作的商品；优先改为停用/归档。

## 日常检查建议

每周：

- 查看系统“日志”中是否有异常的大额库存调整或未知操作人；
- 检查 Vercel 最近部署状态和运行错误；
- 检查 Supabase Database、Auth、Storage 用量。

每月及重要导入前：

- 在 Supabase Dashboard 确认最近备份状态；Free 方案若不提供需要的自动备份能力，应手动导出数据库；
- 抽查几件商品，核对实际箱/端/盒与系统余额；
- 检查 Auth 用户和 `staff` 表，只保留仍需访问的启用账号。

## 故障处理

### 网页无法登录

1. 确认选择了正确姓名和密码。
2. Supabase Authentication 中确认用户存在且已确认邮箱。
3. `staff` 表确认 `auth_user_id` 对应且 `is_active = true`。
4. 确认 `components/login-form.tsx` 的邮箱映射与 Auth 邮箱完全一致。

### 部署失败

先查看 Vercel Build Logs，再在本地运行 `pnpm lint`、`pnpm test`、`pnpm build`。不要用跳过测试的方式强行上线。

### 新版本出现严重问题

Vercel Deployments 可将上一个健康部署重新提升为 Production。代码端同时用新的修复 commit 或 revert commit 恢复，保留完整历史；不要使用 `git reset --hard` 删除已经共享的历史。

### 库存数据有误

不要直接删除已确认操作或修改日志。创建一笔有原因说明的调整/纠正操作，让库存回到正确物理数量，并保留审计轨迹。
