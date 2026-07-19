# GitHub 同步指南

## 第一次上传

当前项目已经是本地 Git 仓库，但尚未连接 GitHub。推荐创建 **Private** 仓库。

1. 登录 GitHub，右上角 `+` → `New repository`。
2. Repository name 填 `harmmy-inventory`。
3. Visibility 选择 `Private`。
4. 不要勾选 Add a README、`.gitignore` 或 License；本地已有这些文件，GitHub 同时创建会增加合并冲突。
5. 点击 `Create repository`，复制页面显示的 HTTPS 地址，例如：

```text
https://github.com/YOUR-NAME/harmmy-inventory.git
```

6. 在项目目录执行：

```powershell
git status
git branch -M main
git remote add origin https://github.com/YOUR-NAME/harmmy-inventory.git
git push -u origin main
```

如果 GitHub 要求登录，按浏览器提示授权 Git Credential Manager。GitHub 不再接受账户密码作为命令行 Git 密码；如不能使用浏览器授权，应创建 Personal Access Token，并像密码一样保密。

上传后打开 GitHub 仓库，确认看不到以下内容：

- `.env.local` 或任何真实密钥/密码；
- `副本-EAKI Products 2026.xlsx`；
- `private-import/`；
- `.next/`、`node_modules/`、`.vercel/`。

## 连接现有 Vercel 项目

项目已经部署在 Vercel，不要再 Import 成第二个项目。可以在本地 remote 设置好后执行：

```powershell
pnpm dlx vercel@latest git connect
```

也可以进入 Vercel 项目 Settings → Git → Connect Git Repository，选择刚创建的 GitHub 仓库。Production Branch 选择 `main`。

## 以后日常同步

```powershell
git status
pnpm lint
pnpm test
pnpm build
git add <本次修改的文件>
git commit -m "说明做了什么"
git push
```

查看本地是否已经和 GitHub 同步：

```powershell
git status
git log --oneline -5
git remote -v
```

`git status` 显示 `Your branch is up to date with 'origin/main'` 且工作区干净，即表示同步完成。

## 推荐协作方式

只有自己维护时可以直接 push 到 `main`。多人开发后建议：

1. 从最新 `main` 创建功能分支；
2. push 分支并创建 Pull Request；
3. 等 GitHub Actions 和 Vercel Preview 通过；
4. 人工检查后合并到 `main`，触发生产部署。

不要用 `git push --force` 覆盖共享的 `main` 历史。
