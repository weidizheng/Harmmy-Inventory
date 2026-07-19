# 员工账号维护

所有启用员工目前拥有相同业务权限。`staff.role` 暂时统一为 `admin`；真正的访问条件是已登录并且关联的 `staff.is_active = true`。

## 当前姓名映射

网站只显示姓名，内部使用以下 Supabase Auth 邮箱登录：

| 姓名 | Auth 邮箱 |
| --- | --- |
| Henry | `henryma107@yahoo.com` |
| Terrence | `weidihaobang@gmail.com` |
| Harmmy | `info@harmmyanime.com` |

密码只由账号本人和 Supabase Auth 管理，不写进本文档或代码。

## 新增员工

1. Supabase Dashboard → Authentication → Users → Add user。
2. 填写内部邮箱和不同的强密码；手动创建的内部账号可选择 Auto Confirm User。
3. 创建 Auth 用户后，数据库 Trigger 会自动在 `public.staff` 创建一条停用记录。
4. Table Editor → `staff`：确认 `auth_user_id` 对应，设置正确 `display_name`、`role = admin`、`is_active = true`。
5. 在 `components/login-form.tsx` 的 `staffAccounts` 中添加姓名和同一个 Auth 邮箱。
6. 运行 `pnpm lint`、`pnpm test`、`pnpm build`，提交并部署。
7. 用该员工姓名和密码实际登录一次，并确认日志显示正确姓名。

员工页面显示的 `staff.id` 和 Authentication 页的 User UID 不是同一个 ID；关联时必须检查 `staff.auth_user_id = auth.users.id`。

## 停用员工

1. 先在 `staff` 表设置 `is_active = false`，账号会立即无法进入受保护页面。
2. 从登录页 `staffAccounts` 移除该姓名并部署。
3. 如确认不再使用，再在 Supabase Auth 禁用或删除账号。

不要删除历史 `activity_logs`；旧日志应继续显示原操作人。

## 安全行为

- 未登录用户会被重定向到 `/login`。
- 已登录但没有启用 staff 记录的用户也无法进入系统。
- 每个业务表的 insert/update/delete 由数据库 Trigger 写入 `activity_logs`。
- Secret/Service Role Key 绝不能放进客户端代码、GitHub 或员工设备。
