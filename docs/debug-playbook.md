# 安的爽调试手册

这份手册的目标是让任何接手这个项目的人或编程工具，在不了解历史上下文的情况下，也能快速完成：

- 本地开发
- 联调 Cloudflare Pages Functions
- 调试登录 / 本地账号 / 邀请码 / 后台
- 查询 D1 数据
- 部署到 Cloudflare Pages
- 验证自定义域名与安全规则
- 排查常见问题

---

## 1. 项目结构

项目目录：`E:\Document\Desktop\安的爽\andeshuang`

重点目录：

- `src/`
  前端页面和组件
- `functions/`
  Cloudflare Pages Functions
- `migrations/`
  D1 migration
- `public/`
  静态资源与预置下载包
- `scripts/`
  本地开发和下载构建脚本
- `docs/`
  项目文档

重点文件：

- `src/App.vue`
- `src/components/AdminDashboard.vue`
- `src/utils/adminApi.js`
- `src/utils/sessionApi.js`
- `functions/_shared/local-auth.js`
- `functions/_shared/admin.js`
- `functions/_shared/session.js`
- `functions/api/session.js`
- `functions/api/admin/overview.js`
- `functions/api/auth/local/register.js`
- `functions/api/auth/local/login.js`
- `wrangler.jsonc`
- `.dev.vars`

---

## 2. 运行方式

### 2.1 纯前端预览

```bash
npm run dev
```

说明：

- 只适合看前端界面
- 不会带上 `functions/` 里的接口
- 登录、后台、D1、Cloudflare Functions 相关逻辑不会完整工作

### 2.2 Cloudflare Pages Functions 联调

```bash
npm run dev:cf
```

说明：

- 这是本项目最常用的本地调试方式
- 会同时启动：
  - `vite build --watch`
  - `wrangler pages dev dist --port 8788`
- 默认本地地址：`http://127.0.0.1:8788`

对应脚本：

- `scripts/dev-cloudflare.mjs`

这个脚本会做的事：

1. 先执行 `npm run build:downloads`
2. 用 `vite build --watch` 持续生成 `dist/`
3. 用 `wrangler pages dev dist --port 8788` 启动本地 Pages + Functions
4. 监听 `src/data`、`src/utils`、`scripts` 的变化，自动重建下载包

---

## 3. 构建与部署

### 3.1 构建

```bash
npm run build
```

实际执行：

```bash
npm run build:downloads && vite build
```

输出目录：

- `dist/`

### 3.2 部署到 Cloudflare Pages

```bash
npm run deploy:cf
```

实际执行：

```bash
npm run build && wrangler pages deploy dist
```

部署结果：

- 会生成一个新的 Pages deployment
- 会同时上传：
  - `dist/` 静态资源
  - `functions/` Functions bundle

验证当前线上包版本：

```bash
Invoke-WebRequest -UseBasicParsing 'https://andeshuang.pages.dev'
```

观察其中引用的：

- `/assets/index-xxxx.js`
- `/assets/index-xxxx.css`

---

## 4. 环境变量与本地 Secrets

本地开发主要看：

- `.dev.vars`
- `.dev.vars.example`

常用项：

- `LINUXDO_CLIENT_ID`
- `LINUXDO_CLIENT_SECRET`
- `LINUXDO_REDIRECT_URI`
- `SESSION_SECRET`
- `LINUXDO_ADMIN_USERNAMES`
- `LOCAL_AUTH_REGISTRATION_MODE`
- `LOCAL_AUTH_INVITE_CODES`
- `LOCAL_AUTH_REGISTRATION_LIMIT`

说明：

- `.dev.vars` 是本地真实调试配置，不提交
- `.dev.vars.example` 是模板
- `wrangler pages dev` 会读取这些变量

---

## 5. 认证与会话链路

### 5.1 会话接口

- `GET /api/session`

代码位置：

- `functions/api/session.js`

作用：

- 返回当前登录状态
- 返回当前用户
- 返回是否管理员
- 返回本地账号注册策略 `localAuth`

### 5.2 LinuxDO 登录

关键接口：

- `GET /api/auth/linuxdo/login`
- `GET /api/auth/linuxdo/callback`

依赖：

- LinuxDO OAuth 配置
- `SESSION_SECRET`

### 5.3 本地账号注册 / 登录

关键接口：

- `POST /api/auth/local/register`
- `POST /api/auth/local/login`

关键逻辑：

- 密码哈希：PBKDF2 + salt
- 用户库：D1
- 注册策略：
  - `public`
  - `invite_only`
  - `disabled`

关键代码：

- `functions/_shared/local-auth.js`
- `functions/api/auth/local/register.js`
- `functions/api/auth/local/login.js`

---

## 6. 邀请码与后台账号管理

### 6.1 后台功能

当前后台已经支持：

- 查看总注册人数
- 查看近 7 天注册数
- 查看启用中账号数
- 查看可用邀请码数量
- 切换注册模式
- 设置注册名额上限
- 生成邀请码
- 为邀请码设置可用次数
- 停用 / 恢复邀请码
- 停用 / 恢复本地账号
- 删除本地账号

### 6.2 关键接口

后台概览：

- `GET /api/admin/overview`

后台写操作：

- `POST /api/admin/auth/settings`
- `POST /api/admin/auth/users`
- `POST /api/admin/auth/users/delete`
- `POST /api/admin/auth/invites/generate`
- `POST /api/admin/auth/invites/update`

前端调用：

- `src/utils/adminApi.js`

### 6.3 邀请码数据表

表名：

- `local_auth_invites`

作用：

- 存邀请码
- 存备注名
- 存最大可用次数
- 存已使用次数
- 存启用状态
- 存最近使用时间

相关 migration：

- `migrations/0003_local_auth_invites.sql`

---

## 7. D1 调试方法

数据库绑定：

- `AUTH_DB`

数据库名：

- `andeshuang-auth`

数据库 ID：

- `a9d1b5b8-3015-443b-8df1-5fd22374900d`

### 7.1 查询远程 D1

示例：

```bash
npx wrangler d1 execute andeshuang-auth --remote --command "SELECT * FROM local_users;"
```

查询邀请码：

```bash
npx wrangler d1 execute andeshuang-auth --remote --command "SELECT * FROM local_auth_invites;"
```

查询注册策略：

```bash
npx wrangler d1 execute andeshuang-auth --remote --command "SELECT * FROM local_auth_settings;"
```

### 7.2 删除测试账号

示例：

```bash
npx wrangler d1 execute andeshuang-auth --remote --command "DELETE FROM local_users WHERE id IN (2,3);"
```

### 7.3 本地 D1

如果要打本地数据库，去掉 `--remote` 即可。

---

## 8. Cloudflare 调试方法

### 8.1 当前登录身份

```bash
npx wrangler whoami
```

用来检查：

- 当前登录的是哪个 Cloudflare 账号
- 有哪些 API 权限

### 8.2 查看 Pages 项目

```bash
npx wrangler pages project list
```

### 8.3 查看部署历史

```bash
npx wrangler pages deployment list --project-name andeshuang
```

### 8.4 自定义域名验证

当前自定义域名：

- `andeshuang.me`

验证是否已通：

```bash
Invoke-WebRequest -UseBasicParsing 'https://andeshuang.me'
```

返回 `200` 说明域名已经能访问。

---

## 9. Cloudflare 安全规则

### 9.1 已配置内容

当前已在 `andeshuang.me` 这个 zone 上配置：

1. 自定义方法白名单规则
2. 认证入口合并限流规则

注意：

- 这些规则作用在 `andeshuang.me`
- 不自动作用在 `andeshuang.pages.dev`

### 9.2 当前套餐限制

本轮实际调试中，Cloudflare API 返回了这些限制：

- `http_ratelimit` phase 只能创建 `1` 条规则
- 可用 `period` 只有 `10`
- 当前套餐不能在 rate limiting 中使用 `managed_challenge`
- `mitigation_timeout` 只能用 `10`

因此当前实际生效的限流是：

- 作用路径：
  - `/api/auth/local/register`
  - `/api/auth/local/login`
  - `/api/auth/linuxdo/login`
- 限制：
  - 同一 IP 在 10 秒内超过 8 次时触发 `block`

### 9.3 推荐后续策略

如果后面升级套餐，可改成更细粒度规则：

- `register`
- `login`
- `linuxdo login`
- `session`

并尽量改成 challenge 而不是 block。

---

## 10. 域名调试方法

当前域名：

- `andeshuang.me`

域名接入流程：

1. 域名在 Namecheap 购买
2. nameserver 切到 Cloudflare：
   - `lorna.ns.cloudflare.com`
   - `stanley.ns.cloudflare.com`
3. Cloudflare zone 变成 `Active`
4. Pages 项目添加自定义域名
5. Pages 中状态从 `Verifying` 变成可访问

### 10.1 常见域名问题

#### 问题：Cloudflare 还在等 nameserver 生效

现象：

- `Waiting for your registrar to propagate your new nameservers`

处理：

- 等 5 到 60 分钟
- 最慢 24 小时内都算正常

#### 问题：Pages 里域名显示 `Verifying`

处理：

- 继续等 DNS 同步
- 用 `https://andeshuang.me` 实测是否返回 `200`

---

## 11. 常见排错

### 11.1 明明改了代码，页面还是旧的

先看是否是线上缓存或打开了旧域名：

- 强刷：`Ctrl + F5`
- 检查当前打开的是：
  - `https://andeshuang.me`
  - 还是 `https://andeshuang.pages.dev`

再检查线上资源包名：

```bash
Invoke-WebRequest -UseBasicParsing 'https://andeshuang.pages.dev'
```

看引用的：

- `/assets/index-xxxx.js`

### 11.2 本地看到的新页面，线上没有

说明只改了本地，没部署。

执行：

```bash
npm run deploy:cf
```

### 11.3 账号总数和表格不一致

先直接查 D1：

```bash
npx wrangler d1 execute andeshuang-auth --remote --command "SELECT id, username, display_name, created_at, last_login_at, is_enabled FROM local_users ORDER BY created_at DESC;"
```

### 11.4 邀请码模式下不能注册

检查：

1. `local_auth_settings`
2. `local_auth_invites`
3. `registration_mode`
4. 是否还有可用邀请码
5. 邀请码是否已用完

### 11.5 后台接口 401 / 403

检查：

- 当前会话是否有效
- `LINUXDO_ADMIN_USERNAMES` 是否包含当前用户名
- `/api/session` 是否能返回 `isAdmin: true`

---

## 12. 可安全清理的目录

这些目录是生成物，可随时删：

- `dist/`
- `.wrangler/`

这些目录先不要乱删：

- `node_modules/`
- `ui-backups/`

其中：

- `ui-backups/` 更像是人为备份，不建议自动清理

---

## 13. 线上是否依赖本机开机

不依赖。

说明：

- 线上站点运行在 Cloudflare Pages / Functions
- 部署完成后，访问由 Cloudflare 提供
- 你的电脑关机不会影响线上访问

只有本地调试地址，例如：

- `http://127.0.0.1:8788`

才依赖你本机开着。

---

## 14. 交接建议

如果换新的编程工具或新对话，至少先读这两个文件：

- `docs/handoff-2026-03-14.md`
- `docs/debug-playbook.md`

建议新接手者先做：

1. 看 `package.json` 的脚本
2. 看 `scripts/dev-cloudflare.mjs`
3. 看 `functions/_shared/local-auth.js`
4. 看 `src/components/AdminDashboard.vue`
5. 跑一次 `npm run build`
